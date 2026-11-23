import { z } from "zod";
import { api, body } from "@/lib/api";
import { badRequest } from "@/lib/errors";
import { addAllocation, addLeave, allocationSchema, leaveSchema, removeAllocation, resourceSchema, updateResource } from "@/lib/services/resources";

export const PATCH = api(async (req, ctx, params) => updateResource(ctx, params.id, await body(req, resourceSchema.partial())));
/** POST { allocation: {...} } or { leave: {...} } */
export const POST = api(async (req, ctx, params) => {
  const id = params.id;
  const b = await body(req, z.object({ allocation: allocationSchema.optional(), leave: leaveSchema.optional() }));
  if (b.allocation) return addAllocation(ctx, id, b.allocation);
  if (b.leave) return addLeave(ctx, id, b.leave);
  throw badRequest("Nothing to add");
});
export const DELETE = api(async (req, ctx, params) => {
  const allocationId = new URL(req.url).searchParams.get("allocationId");
  if (!allocationId) throw badRequest("allocationId is required");
  await removeAllocation(ctx, params.id, allocationId);
  return { ok: true };
});
