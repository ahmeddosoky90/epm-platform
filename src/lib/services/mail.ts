import { z } from "zod";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { prisma } from "../db";
import { type Ctx } from "../auth";
import { audit } from "../audit";
import { AppError, badRequest, notFound } from "../errors";
import { decryptSecret, encryptSecret } from "../crypto";
import { putObject, validateUpload, safeName } from "../storage";
import { createIssue } from "./issues";

/**
 * Personal mailbox connection (IMAP). Each person links their own mailbox; the password is
 * encrypted at rest and only ever used server-side. Works with any IMAP server
 * (Exchange/Outlook with IMAP enabled, Gmail with an app password, Dovecot, …).
 */
export const mailAccountSchema = z.object({
  host: z.string().trim().min(1).max(253).regex(/^[A-Za-z0-9.\-]+$/, "Host name only"), port: z.number().int().min(1).max(65535).default(993),
  secure: z.boolean().default(true), user: z.string().trim().min(1).max(200), password: z.string().max(500).optional(), allowSelfSigned: z.boolean().default(false),
});
type Cfg = { host: string; port: number; secure: boolean; user: string; allowSelfSigned: boolean };

const why = (e: unknown) => { const x = e as { authenticationFailed?: boolean; responseText?: string; message?: string }; return x.authenticationFailed ? "the server rejected the username or password" : x.responseText || x.message || "unknown error"; };

const client = (cfg: Cfg, pass: string) => new ImapFlow({
  host: cfg.host, port: cfg.port, secure: cfg.secure, auth: { user: cfg.user, pass }, logger: false,
  tls: { rejectUnauthorized: !cfg.allowSelfSigned }, socketTimeout: 30_000, greetingTimeout: 15_000, connectionTimeout: 15_000,
});

async function account(ctx: Ctx) {
  return prisma.integrationAccount.findFirst({ where: { workspaceId: ctx.workspaceId, ownerId: ctx.user.id, kind: "IMAP" } });
}

export async function mailStatus(ctx: Ctx) {
  const a = await account(ctx);
  return a ? { connected: true, ...(a.config as Cfg) } : { connected: false };
}

async function withImap<T>(ctx: Ctx, fn: (c: ImapFlow) => Promise<T>) {
  const a = await account(ctx);
  if (!a?.secretEnc) throw badRequest("Connect your mailbox first");
  const c = client(a.config as Cfg, decryptSecret(a.secretEnc));
  try { await c.connect(); }
  catch (e) { throw new AppError(502, "MAIL_CONNECT", `Could not sign in to ${(a.config as Cfg).host}: ${why(e)}`); }
  try { return await fn(c); } finally { await c.logout().catch(() => {}); }
}

export async function saveMailAccount(ctx: Ctx, b: z.infer<typeof mailAccountSchema>) {
  const existing = await account(ctx);
  const pass = b.password || (existing?.secretEnc ? decryptSecret(existing.secretEnc) : "");
  if (!pass) throw badRequest("Password is required");
  const { password: _p, ...cfg } = b; void _p;
  // Verify before saving so people find out about wrong settings straight away
  const c = client(cfg, pass);
  try { await c.connect(); await c.logout(); }
  catch (e) { throw badRequest(`Sign-in failed: ${why(e)}. Check host, port, TLS and that IMAP is enabled for this mailbox.`); }
  const data = { config: cfg, secretEnc: encryptSecret(pass), name: `${cfg.user}@${cfg.host}` };
  const a = existing ? await prisma.integrationAccount.update({ where: { id: existing.id }, data }) : await prisma.integrationAccount.create({ data: { ...data, workspaceId: ctx.workspaceId, ownerId: ctx.user.id, kind: "IMAP" } });
  await audit({ workspaceId: ctx.workspaceId, userId: ctx.user.id, eventType: "integration.mail_connected", entityType: "IntegrationAccount", entityId: a.id, after: cfg, ip: ctx.ip });
  return { connected: true, ...cfg };
}

export async function disconnectMail(ctx: Ctx) {
  const a = await account(ctx);
  if (!a) return;
  await prisma.integrationAccount.delete({ where: { id: a.id } });
  await audit({ workspaceId: ctx.workspaceId, userId: ctx.user.id, eventType: "integration.mail_disconnected", entityType: "IntegrationAccount", entityId: a.id, ip: ctx.ip });
}

export async function listMessages(ctx: Ctx, opts: { folder?: string; q?: string; limit?: number } = {}) {
  return withImap(ctx, async (c) => {
    const folder = opts.folder || "INBOX";
    const lock = await c.getMailboxLock(folder);
    try {
      const box = c.mailbox as { exists: number } | false;
      const total = box ? box.exists : 0;
      if (!total) return { folder, total: 0, messages: [] };
      let uids: number[];
      if (opts.q) uids = ((await c.search({ or: [{ subject: opts.q }, { from: opts.q }, { body: opts.q }] }, { uid: true })) || []) as number[];
      else uids = ((await c.search({ all: true }, { uid: true })) || []) as number[];
      uids = uids.slice(-(opts.limit ?? 40));
      const out: { uid: number; subject: string; from: string; date: string | null; seen: boolean; hasAttachments: boolean }[] = [];
      if (uids.length) for await (const m of c.fetch(uids, { envelope: true, flags: true, bodyStructure: true }, { uid: true })) {
        const from = m.envelope?.from?.[0];
        const hasAtt = JSON.stringify(m.bodyStructure ?? {}).includes('"disposition":"attachment"');
        out.push({ uid: m.uid, subject: m.envelope?.subject ?? "(no subject)", from: from ? (from.name ? `${from.name} <${from.address}>` : from.address ?? "") : "", date: m.envelope?.date ? new Date(m.envelope.date).toISOString() : null, seen: !!m.flags?.has("\\Seen"), hasAttachments: hasAtt });
      }
      return { folder, total, messages: out.reverse() };
    } finally { lock.release(); }
  });
}

async function fetchParsed(c: ImapFlow, folder: string, uid: number) {
  const lock = await c.getMailboxLock(folder);
  try {
    const m = await c.fetchOne(String(uid), { source: true }, { uid: true });
    if (!m || !m.source) throw notFound("Message");
    return await simpleParser(m.source);
  } finally { lock.release(); }
}

const toText = (p: Awaited<ReturnType<typeof simpleParser>>) => (p.text ?? (typeof p.html === "string" ? p.html.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, "").replace(/<br\s*\/?>|<\/p>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">") : "")).trim();

/** Message as plain text only (HTML is converted, never rendered, so mail cannot inject script into the app). */
export async function readMessage(ctx: Ctx, uid: number, folder = "INBOX") {
  return withImap(ctx, async (c) => {
    const p = await fetchParsed(c, folder, uid);
    return { uid, subject: p.subject ?? "(no subject)", from: p.from?.text ?? "", to: Array.isArray(p.to) ? p.to.map((t) => t.text).join(", ") : p.to?.text ?? "", date: p.date?.toISOString() ?? null, text: toText(p).slice(0, 100_000), attachments: p.attachments.map((a) => ({ filename: a.filename ?? "attachment", size: a.size, contentType: a.contentType })) };
  });
}

export const emailToIssueSchema = z.object({ uid: z.number().int().positive(), folder: z.string().max(200).default("INBOX"), projectKey: z.string().min(2).max(10), typeId: z.string().uuid(), priority: z.enum(["Blocker", "Critical", "High", "Medium", "Low"]).default("Medium"), includeAttachments: z.boolean().default(true) });

/** Creates an issue from an email: subject → summary, body → description, attachments copied to the issue. */
export async function emailToIssue(ctx: Ctx, b: z.infer<typeof emailToIssueSchema>) {
  const p = await withImap(ctx, (c) => fetchParsed(c, b.folder, b.uid));
  const header = `From: ${p.from?.text ?? ""}\nDate: ${p.date?.toISOString() ?? ""}\nSubject: ${p.subject ?? ""}\n\n`;
  const issue = await createIssue(ctx, b.projectKey, { summary: (p.subject || "Email without subject").slice(0, 255), description: (header + toText(p)).slice(0, 50_000), typeId: b.typeId, priority: b.priority, labels: ["email"], dueDate: null, startDate: null });
  const skipped: string[] = [];
  if (b.includeAttachments) for (const a of p.attachments.slice(0, 20)) {
    const name = a.filename ?? "attachment.bin";
    try { validateUpload(name, a.content); } catch (e) { skipped.push(`${name}: ${(e as Error).message}`); continue; }
    const obj = await putObject(`issues/${issue.id}`, name, a.content, a.contentType || "application/octet-stream");
    await prisma.attachment.create({ data: { issueId: issue.id, fileName: safeName(name), mimeType: a.contentType || "application/octet-stream", sizeBytes: obj.size, storageKey: obj.key, uploadedById: ctx.user.id } });
  }
  await audit({ workspaceId: ctx.workspaceId, userId: ctx.user.id, eventType: "integration.email_to_issue", entityType: "Issue", entityId: issue.id, after: { key: issue.key, messageId: p.messageId, attachments: p.attachments.length, skipped }, ip: ctx.ip });
  return { key: issue.key, skipped };
}
