import { api } from "@/lib/api";
import { listMessages, readMessage } from "@/lib/services/mail";
import { badRequest } from "@/lib/errors";

export const GET = api(async (req, ctx) => {
  const u = new URL(req.url);
  const folder = (u.searchParams.get("folder") || "INBOX").slice(0, 200);
  const uid = u.searchParams.get("uid");
  if (uid) { const n = Number(uid); if (!Number.isInteger(n) || n <= 0) throw badRequest("Invalid message id"); return readMessage(ctx, n, folder); }
  return listMessages(ctx, { folder, q: u.searchParams.get("q")?.slice(0, 200) || undefined, limit: Math.min(100, Number(u.searchParams.get("limit") ?? 40) || 40) });
});
