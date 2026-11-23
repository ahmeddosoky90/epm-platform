/**
 * Custom server: Next.js app + WebSocket endpoint for browser SSH terminals.
 *   npm run dev   → development
 *   npm start     → production (after `npm run build`)
 * WebSocket: /ws/ssh?ticket=<one-time ticket from POST /api/tech/connections/:id/ticket>
 */
import { createServer, type IncomingMessage } from "http";
import { parse } from "url";
import next from "next";
import { WebSocketServer, type WebSocket } from "ws";
import { prisma } from "./src/lib/db";
import { consumeTicket } from "./src/lib/tech/tickets";
import { connectSsh } from "./src/lib/tech/ssh";
import { audit } from "./src/lib/audit";
import { hasPermission } from "./src/lib/rbac/permissions";

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT ?? 3000);
const IDLE_MS = Number(process.env.TECH_IDLE_MINUTES ?? 30) * 60_000;
const app = next({ dev });
const handle = app.getRequestHandler();

function originOk(req: IncomingMessage) {
  const origin = req.headers.origin; if (!origin) return false;
  const host = (req.headers["x-forwarded-host"] as string) ?? req.headers.host;
  try { return new URL(origin).host === host; } catch { return false; }
}

async function sshSession(ws: WebSocket, req: IncomingMessage, ticketId: string) {
  const ip = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0] ?? req.socket.remoteAddress ?? null;
  const t = consumeTicket(ticketId);
  if (!t) { ws.close(4401, "Invalid or expired ticket"); return; }
  // Re-check authorisation at connect time (role could have changed since the ticket was issued)
  const [user, member, conn] = await Promise.all([
    prisma.user.findUnique({ where: { id: t.userId } }),
    prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId: t.workspaceId, userId: t.userId } }, include: { role: true } }),
    prisma.techConnection.findFirst({ where: { id: t.connectionId, workspaceId: t.workspaceId } }),
  ]);
  const perms = user?.isPlatformAdmin ? ["*"] : member?.role.permissions ?? [];
  if (!user?.isActive || !conn || !hasPermission(perms, "tech:access")) { ws.close(4403, "Not allowed"); return; }

  const session = await prisma.techSession.create({ data: { connectionId: conn.id, userId: user.id, ip } });
  await audit({ workspaceId: t.workspaceId, userId: user.id, eventType: "tech.ssh_started", entityType: "TechConnection", entityId: conn.id, after: { sessionId: session.id, host: conn.host, user: conn.username }, ip });
  let bytesIn = 0, bytesOut = 0, outcome = "closed";
  const send = (o: unknown) => { if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(o)); };
  let ssh: Awaited<ReturnType<typeof connectSsh>> | null = null;
  let idle: NodeJS.Timeout | null = null;
  const touch = () => { if (idle) clearTimeout(idle); idle = setTimeout(() => { outcome = "idle-timeout"; send({ type: "status", text: "\r\n[Session closed after inactivity]\r\n" }); ws.close(1000); }, IDLE_MS); };
  const finish = async () => {
    if (idle) clearTimeout(idle);
    ssh?.client.end();
    await prisma.techSession.update({ where: { id: session.id }, data: { endedAt: new Date(), bytesIn, bytesOut, outcome } }).catch(() => {});
    await audit({ workspaceId: t.workspaceId, userId: user.id, eventType: "tech.ssh_ended", entityType: "TechConnection", entityId: conn.id, after: { sessionId: session.id, bytesIn, bytesOut, outcome }, ip }).catch(() => {});
  };
  ws.once("close", () => { void finish(); });

  try {
    send({ type: "status", text: `Connecting to ${conn.username}@${conn.host}:${conn.port}…\r\n` });
    ssh = await connectSsh(conn);
    if (ssh.firstUse) send({ type: "status", text: `Host key pinned: SHA256:${ssh.fingerprint}\r\n` });
    const url = parse(req.url ?? "", true);
    const cols = Math.min(500, Number(url.query.cols) || 120), rows = Math.min(200, Number(url.query.rows) || 32);
    ssh.client.shell({ term: "xterm-256color", cols, rows }, (err, stream) => {
      if (err) { outcome = "shell-error"; send({ type: "error", text: err.message }); ws.close(1011); return; }
      touch();
      stream.on("data", (d: Buffer) => { bytesOut += d.length; if (ws.readyState === ws.OPEN) ws.send(d); });
      stream.stderr.on("data", (d: Buffer) => { bytesOut += d.length; if (ws.readyState === ws.OPEN) ws.send(d); });
      stream.on("close", () => { outcome = "remote-closed"; ws.close(1000); });
      ws.on("message", (m: Buffer, isBinary: boolean) => {
        touch();
        if (isBinary) { bytesIn += m.length; stream.write(m); return; }
        try { const msg = JSON.parse(m.toString()); if (msg.type === "data") { bytesIn += msg.data.length; stream.write(msg.data); } else if (msg.type === "resize") stream.setWindow(Math.min(200, msg.rows), Math.min(500, msg.cols), 0, 0); } catch { /* ignore malformed */ }
      });
    });
  } catch (e) {
    outcome = "connect-failed";
    send({ type: "error", text: (e as Error).message });
    ws.close(1011);
  }
}

app.prepare().then(() => {
  const server = createServer((req, res) => handle(req, res, parse(req.url ?? "", true)));
  const wss = new WebSocketServer({ noServer: true, maxPayload: 1024 * 1024 });
  const nextUpgrade = app.getUpgradeHandler();
  server.on("upgrade", (req, socket, head) => {
    const { pathname, query } = parse(req.url ?? "", true);
    if (pathname === "/ws/ssh") {
      if (!originOk(req)) { socket.write("HTTP/1.1 403 Forbidden\r\n\r\n"); socket.destroy(); return; }
      wss.handleUpgrade(req, socket, head, (ws) => { void sshSession(ws, req, String(query.ticket ?? "")); });
      return;
    }
    nextUpgrade(req, socket, head); // Next.js dev HMR
  });
  server.listen(port, () => console.log(`> Lumen PMO ready on http://localhost:${port} (${dev ? "dev" : "production"})`));
});
