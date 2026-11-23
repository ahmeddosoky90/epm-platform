import path from "path";
import { z } from "zod";
import type { SFTPWrapper } from "ssh2";
import { prisma } from "../db";
import { requirePermission, type Ctx } from "../auth";
import { audit } from "../audit";
import { badRequest, notFound } from "../errors";
import { encryptSecret } from "../crypto";
import { issueTicket } from "../tech/tickets";
import { connectSsh } from "../tech/ssh";

// Hostnames or IPs only; blocks URLs, spaces and shell metacharacters.
const host = z.string().trim().min(1).max(253).regex(/^[A-Za-z0-9.\-:\[\]]+$/, "Enter a host name or IP address");
export const connectionSchema = z.object({
  name: z.string().trim().min(2).max(80), protocol: z.enum(["SSH", "RDP", "SFTP"]), host, port: z.number().int().min(1).max(65535),
  username: z.string().trim().min(1).max(120), authType: z.enum(["PASSWORD", "KEY"]).default("PASSWORD"), secret: z.string().max(20_000).optional(),
  domain: z.string().max(120).nullable().optional(), notes: z.string().max(1000).nullable().optional(), ignoreCert: z.boolean().optional(), resetHostKey: z.boolean().optional(),
});

/** Strip secrets before anything leaves the server. */
const safe = <T extends { secretEnc: string | null }>(c: T) => { const { secretEnc, ...rest } = c; return { ...rest, hasSecret: !!secretEnc }; };

export async function listConnections(ctx: Ctx) {
  requirePermission(ctx, "tech:access");
  const rows = await prisma.techConnection.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { name: "asc" } });
  return rows.map(safe);
}

export async function loadConnection(ctx: Ctx, id: string) {
  requirePermission(ctx, "tech:access");
  const c = await prisma.techConnection.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!c) throw notFound("Connection");
  return c;
}

export async function saveConnection(ctx: Ctx, b: z.infer<typeof connectionSchema>, id?: string) {
  requirePermission(ctx, "tech:manage");
  const { secret, resetHostKey, ...rest } = b;
  const data = { ...rest, ...(secret ? { secretEnc: encryptSecret(secret) } : {}), ...(resetHostKey ? { hostKeySha256: null } : {}) };
  const c = id
    ? await prisma.techConnection.update({ where: { id: (await loadConnection(ctx, id)).id }, data })
    : await prisma.techConnection.create({ data: { ...data, workspaceId: ctx.workspaceId, createdById: ctx.user.id } });
  await audit({ workspaceId: ctx.workspaceId, userId: ctx.user.id, eventType: id ? "tech.connection_updated" : "tech.connection_created", entityType: "TechConnection", entityId: c.id, after: { ...rest, secretChanged: !!secret, resetHostKey: !!resetHostKey }, ip: ctx.ip });
  return safe(c);
}

export async function deleteConnection(ctx: Ctx, id: string) {
  requirePermission(ctx, "tech:manage");
  const c = await loadConnection(ctx, id);
  await prisma.techConnection.delete({ where: { id } });
  await audit({ workspaceId: ctx.workspaceId, userId: ctx.user.id, eventType: "tech.connection_deleted", entityType: "TechConnection", entityId: id, before: { name: c.name, host: c.host, protocol: c.protocol }, ip: ctx.ip });
}

export async function terminalTicket(ctx: Ctx, id: string) {
  const c = await loadConnection(ctx, id);
  if (c.protocol !== "SSH") throw badRequest("Terminal sessions are for SSH connections");
  return { ticket: issueTicket({ userId: ctx.user.id, workspaceId: ctx.workspaceId, connectionId: c.id, ip: ctx.ip }) };
}

/** A standard .rdp file for the user's own Remote Desktop client. Passwords are never written into it. */
export async function rdpFile(ctx: Ctx, id: string) {
  const c = await loadConnection(ctx, id);
  if (c.protocol !== "RDP") throw badRequest("Not an RDP connection");
  await audit({ workspaceId: ctx.workspaceId, userId: ctx.user.id, eventType: "tech.rdp_file", entityType: "TechConnection", entityId: c.id, after: { host: c.host }, ip: ctx.ip });
  const lines = [
    `full address:s:${c.host}:${c.port}`, `username:s:${c.domain ? `${c.domain}\\` : ""}${c.username}`, "prompt for credentials:i:1", "authentication level:i:2",
    "enablecredsspsupport:i:1", "screen mode id:i:2", "use multimon:i:0", "audiomode:i:0", "redirectclipboard:i:1", "redirectdrives:i:0", "redirectprinters:i:0",
  ];
  return { name: `${c.name.replace(/[^\w.-]+/g, "_")}.rdp`, body: lines.join("\r\n") + "\r\n" };
}

// ───────── SFTP ─────────
async function withSftp<T>(ctx: Ctx, id: string, fn: (s: SFTPWrapper) => Promise<T>) {
  const c = await loadConnection(ctx, id);
  if (c.protocol !== "SFTP" && c.protocol !== "SSH") throw badRequest("File browsing needs an SSH or SFTP connection");
  const { client } = await connectSsh(c);
  try {
    const sftp = await new Promise<SFTPWrapper>((res, rej) => client.sftp((e, s) => (e ? rej(e) : res(s))));
    return await fn(sftp);
  } finally { client.end(); }
}
const clean = (p: string) => { const n = path.posix.normalize(p || "."); if (n.includes("\0")) throw badRequest("Bad path"); return n; };

export async function sftpList(ctx: Ctx, id: string, dir: string) {
  const d = clean(dir);
  return withSftp(ctx, id, async (s) => {
    const real = await new Promise<string>((res, rej) => s.realpath(d, (e, p) => (e ? rej(badRequest(e.message)) : res(p))));
    const list = await new Promise<{ filename: string; attrs: { size: number; mtime: number; mode: number } }[]>((res, rej) => s.readdir(real, (e, l) => (e ? rej(badRequest(`Cannot open ${real}: ${e.message}`)) : res(l as never))));
    return { path: real, entries: list.filter((f) => f.filename !== "." && f.filename !== "..").map((f) => ({ name: f.filename, size: f.attrs.size, mtime: f.attrs.mtime * 1000, dir: (f.attrs.mode & 0o170000) === 0o040000 })).sort((a, b) => Number(b.dir) - Number(a.dir) || a.name.localeCompare(b.name)) };
  });
}

export async function sftpDownload(ctx: Ctx, id: string, file: string) {
  const f = clean(file);
  const buf = await withSftp(ctx, id, (s) => new Promise<Buffer>((res, rej) => {
    s.stat(f, (e, st) => {
      if (e) return rej(badRequest(e.message));
      if (st.size > 100 * 1024 * 1024) return rej(badRequest("Files over 100 MB must be transferred with a desktop SFTP client"));
      const chunks: Buffer[] = []; const r = s.createReadStream(f);
      r.on("data", (c: Buffer) => chunks.push(c)); r.on("end", () => res(Buffer.concat(chunks))); r.on("error", (x: Error) => rej(badRequest(x.message)));
    });
  }));
  await audit({ workspaceId: ctx.workspaceId, userId: ctx.user.id, eventType: "tech.sftp_download", entityType: "TechConnection", entityId: id, after: { file: f, bytes: buf.length }, ip: ctx.ip });
  return { name: path.posix.basename(f), bytes: buf };
}

export async function sftpUpload(ctx: Ctx, id: string, dir: string, name: string, bytes: Buffer) {
  const target = path.posix.join(clean(dir), path.posix.basename(name));
  await withSftp(ctx, id, (s) => new Promise<void>((res, rej) => { const w = s.createWriteStream(target); w.on("close", () => res()); w.on("error", (x: Error) => rej(badRequest(x.message))); w.end(bytes); }));
  await audit({ workspaceId: ctx.workspaceId, userId: ctx.user.id, eventType: "tech.sftp_upload", entityType: "TechConnection", entityId: id, after: { file: target, bytes: bytes.length }, ip: ctx.ip });
  return { path: target };
}

/** Quick reachability/auth test (also pins the host key on first use). */
export async function testConnection(ctx: Ctx, id: string) {
  const c = await loadConnection(ctx, id);
  if (c.protocol === "RDP") {
    const net = await import("net");
    const ok = await new Promise<boolean>((res) => { const s = net.connect({ host: c.host, port: c.port, timeout: 5000 }, () => { s.destroy(); res(true); }); s.on("error", () => res(false)); s.on("timeout", () => { s.destroy(); res(false); }); });
    return { ok, detail: ok ? `TCP ${c.host}:${c.port} is reachable` : `Cannot reach ${c.host}:${c.port}` };
  }
  try { const { client, fingerprint, firstUse } = await connectSsh(c, 10_000); client.end(); return { ok: true, detail: `Signed in as ${c.username}. Host key SHA256:${fingerprint}${firstUse ? " (pinned now)" : " (matches pinned key)"}` }; }
  catch (e) { return { ok: false, detail: (e as Error).message }; }
}
