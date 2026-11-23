import { z } from "zod";
import { prisma } from "@/lib/db";
import { api, body } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { loadProject } from "@/lib/services/access";
import { audit } from "@/lib/audit";
import { badRequest } from "@/lib/errors";

/** Set criterion scores and/or a manual ranking override (override requires justification). */
export const PUT = api(async (req, ctx, p) => {
  requirePermission(ctx, "portfolio:manage");
  const project = await loadProject(ctx, p.id);
  const b = await body(req, z.object({ scores: z.record(z.string().uuid(), z.number().int().min(0).max(10)).optional(), override: z.number().int().min(1).nullable().optional(), reason: z.string().max(1000).optional() }));
  if (b.override != null && !b.reason?.trim()) throw badRequest("A justification is required to override the calculated ranking");
  const crit = new Set((await prisma.priorityCriterion.findMany({ where: { workspaceId: ctx.workspaceId } })).map((c) => c.id));
  return prisma.$transaction(async (tx) => {
    for (const [criterionId, score] of Object.entries(b.scores ?? {})) {
      if (!crit.has(criterionId)) throw badRequest("Unknown criterion");
      await tx.projectScore.upsert({ where: { projectId_criterionId: { projectId: project.id, criterionId } }, create: { projectId: project.id, criterionId, score }, update: { score } });
    }
    if (b.override !== undefined) await tx.project.update({ where: { id: project.id }, data: { priorityOverride: b.override, priorityOverrideReason: b.override == null ? null : b.reason } });
    await audit({ workspaceId: ctx.workspaceId, userId: ctx.user.id, eventType: "portfolio.prioritisation_changed", entityType: "Project", entityId: project.id, before: { override: project.priorityOverride }, after: b, ip: ctx.ip }, tx);
    return { ok: true };
  });
});
