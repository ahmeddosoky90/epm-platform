import { z } from "zod";
import { prisma } from "@/lib/db";
import { api, body } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { notFound } from "@/lib/errors";

const assumptions = z.array(z.object({ projectId: z.string().uuid(), included: z.boolean(), budgetOverride: z.string().regex(/^\d+(\.\d{1,2})?$/).nullable().optional(), priorityOverride: z.number().int().min(1).nullable().optional() }));
/** Scenarios are sandboxed copies of assumptions: they never modify live project data. */
export const GET = api(async (_r, ctx, p) => { requirePermission(ctx, "portfolio:view"); return prisma.scenario.findMany({ where: { portfolioId: p.id, portfolio: { workspaceId: ctx.workspaceId } }, orderBy: { createdAt: "desc" } }); });
export const POST = api(async (req, ctx, p) => {
  requirePermission(ctx, "portfolio:manage");
  const pf = await prisma.portfolio.findFirst({ where: { id: p.id, workspaceId: ctx.workspaceId } }); if (!pf) throw notFound("Portfolio");
  const b = await body(req, z.object({ id: z.string().uuid().optional(), name: z.string().min(1).max(80), description: z.string().max(1000).optional(), assumptions }));
  const s = b.id ? await prisma.scenario.update({ where: { id: b.id }, data: { name: b.name, description: b.description, assumptions: b.assumptions } })
    : await prisma.scenario.create({ data: { portfolioId: pf.id, name: b.name, description: b.description, assumptions: b.assumptions, createdById: ctx.user.id } });
  await audit({ workspaceId: ctx.workspaceId, userId: ctx.user.id, eventType: "portfolio.scenario_saved", entityType: "Scenario", entityId: s.id, after: b, ip: ctx.ip });
  return s;
});
