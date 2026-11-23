import { z } from "zod";
import { api, body } from "@/lib/api";
import { recordReview } from "@/lib/services/issues";
export const POST = api(async (req, ctx, p) => recordReview(ctx, p.id, (await body(req, z.object({ decision: z.enum(["APPROVED", "CHANGES_REQUESTED"]) }))).decision));
