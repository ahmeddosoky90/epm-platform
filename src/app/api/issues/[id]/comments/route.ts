import { z } from "zod";
import { api, body } from "@/lib/api";
import { addComment } from "@/lib/services/issues";
export const POST = api(async (req, ctx, p) => addComment(ctx, p.id, (await body(req, z.object({ body: z.string().trim().min(1).max(20000) }))).body));
