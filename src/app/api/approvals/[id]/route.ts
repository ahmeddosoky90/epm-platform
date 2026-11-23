import { z } from "zod";
import { api, body } from "@/lib/api";
import { decide, delegate } from "@/lib/services/governance";
export const POST = api(async (req, ctx, p) => {
  const b = await body(req, z.object({ decision: z.enum(["APPROVED", "REJECTED"]).optional(), comment: z.string().max(4000).optional(), delegateTo: z.string().uuid().optional() }));
  if (b.delegateTo) return delegate(ctx, p.id, b.delegateTo);
  if (!b.decision) return { ok: false };
  return decide(ctx, p.id, b.decision, b.comment);
});
