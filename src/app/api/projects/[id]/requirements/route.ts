import { api, body } from "@/lib/api";
import { requirementSchema, traceability, upsertRequirement } from "@/lib/services/documents";
export const GET = api(async (_r, ctx, p) => traceability(ctx, p.id));
export const POST = api(async (req, ctx, p) => upsertRequirement(ctx, p.id, await body(req, requirementSchema)));
export const PATCH = api(async (req, ctx, p) => upsertRequirement(ctx, p.id, await body(req, requirementSchema), req.nextUrl.searchParams.get("id") ?? undefined));
