import { z } from "zod";
import { api, body } from "@/lib/api";
import { moveIssue } from "@/lib/services/issues";
export const POST = api(async (req, ctx, p) => moveIssue(ctx, p.id, (await body(req, z.object({ projectKey: z.string().min(2) }))).projectKey));
