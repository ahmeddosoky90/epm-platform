import { api, body } from "@/lib/api";
import { capacityGrid, createResource, resourceSchema } from "@/lib/services/resources";

export const GET = api(async (req, ctx) => {
  const u = new URL(req.url);
  return capacityGrid(ctx, Math.min(12, Number(u.searchParams.get("months") ?? 6) || 6), { departmentId: u.searchParams.get("departmentId") ?? undefined, skill: u.searchParams.get("skill") ?? undefined, q: u.searchParams.get("q") ?? undefined });
});
export const POST = api(async (req, ctx) => createResource(ctx, await body(req, resourceSchema)));
