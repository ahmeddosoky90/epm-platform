import { api, body } from "@/lib/api";
import { connectionSchema, deleteConnection, saveConnection } from "@/lib/services/tech";
export const PATCH = api(async (req, ctx, p) => saveConnection(ctx, await body(req, connectionSchema), p.id));
export const DELETE = api(async (_r, ctx, p) => { await deleteConnection(ctx, p.id); return { ok: true }; });
