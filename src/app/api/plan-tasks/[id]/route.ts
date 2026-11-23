import { api, body } from "@/lib/api";
import { deleteTask, taskPatchSchema, updateTask } from "@/lib/services/plan";
export const PATCH = api(async (req, ctx, p) => updateTask(ctx, p.id, await body(req, taskPatchSchema)));
export const DELETE = api(async (_r, ctx, p) => { await deleteTask(ctx, p.id); return { ok: true }; });
