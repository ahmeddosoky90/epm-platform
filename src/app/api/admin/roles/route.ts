import { prisma } from "@/lib/db";
import { api, body } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { createRole, roleSchema } from "@/lib/services/admin";
export const GET = api(async (_r, ctx) => { requirePermission(ctx, "admin:roles"); return prisma.role.findMany({ where: { workspaceId: ctx.workspaceId }, include: { _count: { select: { members: true } } }, orderBy: { name: "asc" } }); });
export const POST = api(async (req, ctx) => createRole(ctx, await body(req, roleSchema)));
