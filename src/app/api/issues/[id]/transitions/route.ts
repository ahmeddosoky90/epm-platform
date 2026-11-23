import { z } from "zod";
import { api, body } from "@/lib/api";
import { availableTransitions, transitionIssue } from "@/lib/services/issues";
import { loadIssue } from "@/lib/services/access";

export const GET = api(async (_r, ctx, p) => availableTransitions((await loadIssue(ctx, p.id)).id));
export const POST = api(async (req, ctx, p) => transitionIssue(ctx, p.id, await body(req, z.object({
  transitionId: z.string().uuid().optional(), toStatusId: z.string().uuid().optional(), comment: z.string().max(10000).optional(),
  fields: z.object({ resolution: z.string().max(50).optional(), assigneeId: z.string().uuid().optional(), remainingEstimateMin: z.number().int().min(0).optional() }).optional(),
}).refine((v) => v.transitionId || v.toStatusId, "transitionId or toStatusId required"))));
