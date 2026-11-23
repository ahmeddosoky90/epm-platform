import { z } from "zod";
import { api, body } from "@/lib/api";
import { saveBaseline } from "@/lib/services/plan";
export const POST = api(async (req, ctx, p) => saveBaseline(ctx, p.id, (await body(req, z.object({ name: z.string().trim().min(1).max(80) }))).name));
