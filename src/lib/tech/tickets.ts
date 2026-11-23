import crypto from "crypto";

/**
 * One-time, 30-second tickets that authorise a WebSocket terminal. The HTTP API (which has the
 * full session, permission and audit context) issues them; the WebSocket server consumes them.
 * Both run in the same Node process (server.ts), so an in-memory map on globalThis is shared.
 * An RDP password typed by the user is held only here, in memory, for at most 30 seconds.
 */
type Ticket = { userId: string; workspaceId: string; connectionId: string; ip: string | null; expires: number; password?: string };
const g = globalThis as unknown as { __epmTickets?: Map<string, Ticket> };
const store = (g.__epmTickets ??= new Map());

export function issueTicket(t: Omit<Ticket, "expires">) {
  const id = crypto.randomBytes(24).toString("base64url");
  store.set(id, { ...t, expires: Date.now() + 30_000 });
  for (const [k, v] of store) if (v.expires < Date.now()) store.delete(k);
  return id;
}

export function consumeTicket(id: string): Ticket | null {
  const t = store.get(id);
  store.delete(id);
  if (!t || t.expires < Date.now()) return null;
  return t;
}
