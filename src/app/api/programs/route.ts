import { z } from "zod";
import { prisma } from "@/lib/db";
import { api, body } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { badRequest } from "@/lib/errors";
export const GET = api(async (_r, ctx) => { requirePermission(ctx, "portfolio:view"); return prisma.program.findMany({ where: { workspaceId: ctx.workspaceId }, include: { portfolio: true, _count: { select: { projects: true } } } }); });
export const POST = api(async (req, ctx) => {
  requirePermission(ctx, "portfolio:manage");
  const b = await body(req, z.object({ name: z.string().trim().min(2).max(120), description: z.string().max(2000).optional(), portfolioId: z.string().uuid().nullable().optional() }));
  if (b.portfolioId && !(await prisma.portfolio.findFirst({ where: { id: b.portfolioId, workspaceId: ctx.workspaceId } }))) throw badRequest("Unknown portfolio");
  const p = await prisma.program.create({ data: { ...b, workspaceId: ctx.workspaceId, managerId: ctx.user.id } });
  await audit({ workspaceId: ctx.workspaceId, userId: ctx.user.id, eventType: "program.created", entityType: "Program", entityId: p.id, after: b, ip: ctx.ip });
  return p;
});
