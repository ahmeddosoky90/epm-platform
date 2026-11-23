import { api, body } from "@/lib/api";
import { badRequest } from "@/lib/errors";
import { addDependency, depSchema, removeDependency } from "@/lib/services/plan";
export const POST = api(async (req, ctx, p) => addDependency(ctx, p.id, await body(req, depSchema)));
export const DELETE = api(async (req, ctx, p) => {
  const depId = new URL(req.url).searchParams.get("depId"); if (!depId) throw badRequest("depId is required");
  await removeDependency(ctx, p.id, depId); return { ok: true };
});
