import { z } from "zod";
import { prisma } from "@/lib/db";
import { api, body } from "@/lib/api";
import { loadProject } from "@/lib/services/access";
import { requirePermission } from "@/lib/auth";
import { riskScore } from "@/lib/calc/risk";
import { audit } from "@/lib/audit";
import { notFound } from "@/lib/errors";

const base = z.object({ title: z.string().trim().min(2).max(200), description: z.string().max(5000).optional(), category: z.string().max(40), ownerId: z.string().uuid().nullable().optional(),
  probability: z.number().int().min(1).max(5), impact: z.number().int().min(1).max(5), response: z.enum(["AVOID", "MITIGATE", "TRANSFER", "ACCEPT"]), mitigation: z.string().max(5000).optional(),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(), status: z.enum(["OPEN", "MITIGATING", "CLOSED"]).optional() });

export const GET = api(async (_r, ctx, p) => prisma.risk.findMany({ where: { projectId: (await loadProject(ctx, p.id)).id }, orderBy: [{ status: "asc" }, { score: "desc" }] }));
export const POST = api(async (req, ctx, p) => {
  requirePermission(ctx, "raid:manage"); const project = await loadProject(ctx, p.id);
  const b = await body(req, base);
  const n = (await prisma.risk.aggregate({ where: { projectId: project.id }, _max: { number: true } }))._max.number ?? 0;
  const r = await prisma.risk.create({ data: { ...b, targetDate: b.targetDate ? new Date(b.targetDate) : null, projectId: project.id, number: n + 1, score: riskScore(b.probability, b.impact) } });
  await audit({ workspaceId: ctx.workspaceId, userId: ctx.user.id, eventType: "risk.created", entityType: "Risk", entityId: r.id, after: r, ip: ctx.ip });
  return r;
});
export const PATCH = api(async (req, ctx, p) => {
  requirePermission(ctx, "raid:manage"); const project = await loadProject(ctx, p.id);
  const { id, ...b } = await body(req, base.partial().extend({ id: z.string().uuid() }));
  const r = await prisma.risk.findFirst({ where: { id, projectId: project.id } }); if (!r) throw notFound("Risk");
  const prob = b.probability ?? r.probability, imp = b.impact ?? r.impact;
  const u = await prisma.risk.update({ where: { id }, data: { ...b, targetDate: b.targetDate === undefined ? undefined : b.targetDate ? new Date(b.targetDate) : null, score: riskScore(prob, imp) } });
  await audit({ workspaceId: ctx.workspaceId, userId: ctx.user.id, eventType: "risk.updated", entityType: "Risk", entityId: id, before: r, after: u, ip: ctx.ip });
  return u;
});
