import { api, body } from "@/lib/api";
import { createTask, getPlan, taskSchema } from "@/lib/services/plan";
export const GET = api(async (_r, ctx, p) => getPlan(ctx, p.id));
export const POST = api(async (req, ctx, p) => createTask(ctx, p.id, await body(req, taskSchema)));
