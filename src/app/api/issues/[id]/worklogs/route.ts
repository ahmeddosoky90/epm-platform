import { z } from "zod";
import { api, body } from "@/lib/api";
import { logWork } from "@/lib/services/issues";
export const POST = api(async (req, ctx, p) => {
  const b = await body(req, z.object({ minutes: z.number().int().min(1).max(24 * 60), workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), note: z.string().max(2000).optional(), remainingEstimateMin: z.number().int().min(0).optional() }));
  return logWork(ctx, p.id, { ...b, workDate: new Date(b.workDate) });
});
