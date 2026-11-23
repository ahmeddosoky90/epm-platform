import { api, body } from "@/lib/api";
import { deleteRole, roleSchema, updateRole } from "@/lib/services/admin";
export const PATCH = api(async (req, ctx, p) => updateRole(ctx, p.id, await body(req, roleSchema.partial())));
export const DELETE = api(async (_r, ctx, p) => { await deleteRole(ctx, p.id); return { ok: true }; });
