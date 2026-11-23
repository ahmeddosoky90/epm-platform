import { z } from "zod";
import { api } from "@/lib/api";
import { terminalTicket } from "@/lib/services/tech";
/** Body (optional, RDP only): { password } — used once for this session, never stored. */
export const POST = api(async (req, ctx, p) => {
  const text = await req.text();
  const b = text ? z.object({ password: z.string().max(500).optional() }).parse(JSON.parse(text)) : {};
  return terminalTicket(ctx, p.id, b.password);
});
