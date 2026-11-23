import { z } from "zod";
import { api, body } from "@/lib/api";
import { submitGate, updateChecklist } from "@/lib/services/governance";
export const PATCH = api(async (req, ctx, p) => {
  const b = await body(req, z.object({ checklist: z.record(z.string(), z.boolean()).optional(), submit: z.boolean().optional() }));
  if (b.checklist) await updateChecklist(ctx, p.id, b.checklist);
  if (b.submit) return submitGate(ctx, p.id);
  return { ok: true };
});
