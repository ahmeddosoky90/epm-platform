import { z } from "zod";
import { prisma } from "@/lib/db";
import { api, body } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { audit } from "@/lib/audit";
export const GET = api(async (_r, ctx) => { requirePermission(ctx, "portfolio:view"); return prisma.portfolio.findMany({ where: { workspaceId: ctx.workspaceId }, include: { programs: true, _count: { select: { projects: true } } } }); });
export const POST = api(async (req, ctx) => {
  requirePermission(ctx, "portfolio:manage");
  const b = await body(req, z.object({ name: z.string().trim().min(2).max(120), description: z.string().max(2000).optional() }));
  const p = await prisma.portfolio.create({ data: { ...b, workspaceId: ctx.workspaceId, ownerId: ctx.user.id } });
  await audit({ workspaceId: ctx.workspaceId, userId: ctx.user.id, eventType: "portfolio.created", entityType: "Portfolio", entityId: p.id, after: b, ip: ctx.ip });
  return p;
});
