import { z } from "zod";
import { prisma } from "@/lib/db";
import { api, body } from "@/lib/api";
import { loadProject } from "@/lib/services/access";
import { audit } from "@/lib/audit";

export const GET = api(async (_r, ctx, p) => prisma.statusReport.findMany({ where: { projectId: (await loadProject(ctx, p.id)).id }, orderBy: { createdAt: "desc" } }));
export const POST = api(async (req, ctx, p) => {
  const project = await loadProject(ctx, p.id, { write: true });
  const b = await body(req, z.object({ health: z.enum(["GREEN", "AMBER", "RED"]), summary: z.string().trim().min(1).max(5000), achievements: z.string().max(5000).optional(), nextSteps: z.string().max(5000).optional() }));
  return prisma.$transaction(async (tx) => {
    const r = await tx.statusReport.create({ data: { ...b, projectId: project.id, authorId: ctx.user.id } });
    await tx.project.update({ where: { id: project.id }, data: { health: b.health } });
    await audit({ workspaceId: ctx.workspaceId, userId: ctx.user.id, eventType: "project.status_report", entityType: "Project", entityId: project.id, before: { health: project.health }, after: { health: b.health }, ip: ctx.ip }, tx);
    return r;
  });
});
