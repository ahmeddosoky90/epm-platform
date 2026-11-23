import { prisma } from "@/lib/db";
import { api, body } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { createUser, userCreateSchema } from "@/lib/services/admin";
export const GET = api(async (_r, ctx) => {
  requirePermission(ctx, "admin:users");
  return prisma.workspaceMember.findMany({ where: { workspaceId: ctx.workspaceId }, include: { role: { select: { id: true, name: true, key: true } }, user: { select: { id: true, email: true, name: true, jobTitle: true, isActive: true, lockedUntil: true, lastLoginAt: true, mfaEnabled: true } } }, orderBy: { user: { name: "asc" } } });
});
export const POST = api(async (req, ctx) => createUser(ctx, await body(req, userCreateSchema)));
