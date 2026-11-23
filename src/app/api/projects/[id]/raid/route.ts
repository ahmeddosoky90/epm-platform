import { z } from "zod";
import { prisma } from "@/lib/db";
import { api, body } from "@/lib/api";
import { loadProject } from "@/lib/services/access";
import { requirePermission } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { notFound } from "@/lib/errors";

const base = z.object({ kind: z.enum(["ISSUE", "ASSUMPTION", "DEPENDENCY", "ACTION"]), title: z.string().trim().min(2).max(200), description: z.string().max(5000).optional(), ownerId: z.string().uuid().nullable().optional(),
  severity: z.enum(["Critical", "High", "Medium", "Low"]).nullable().optional(), status: z.string().max(30).optional(), dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(), impact: z.string().max(2000).optional(), external: z.boolean().optional(), escalated: z.boolean().optional() });
export const POST = api(async (req, ctx, p) => {
  requirePermission(ctx, "raid:manage"); const project = await loadProject(ctx, p.id); const b = await body(req, base);
  const r = await prisma.raidItem.create({ data: { ...b, dueDate: b.dueDate ? new Date(b.dueDate) : null, projectId: project.id } });
  await audit({ workspaceId: ctx.workspaceId, userId: ctx.user.id, eventType: "raid.created", entityType: "RaidItem", entityId: r.id, after: r, ip: ctx.ip });
  return r;
});
export const PATCH = api(async (req, ctx, p) => {
  requirePermission(ctx, "raid:manage"); const project = await loadProject(ctx, p.id);
  const { id, ...b } = await body(req, base.partial().extend({ id: z.string().uuid() }));
  const r = await prisma.raidItem.findFirst({ where: { id, projectId: project.id } }); if (!r) throw notFound("RAID item");
  const u = await prisma.raidItem.update({ where: { id }, data: { ...b, dueDate: b.dueDate === undefined ? undefined : b.dueDate ? new Date(b.dueDate) : null } });
  await audit({ workspaceId: ctx.workspaceId, userId: ctx.user.id, eventType: "raid.updated", entityType: "RaidItem", entityId: id, before: r, after: u, ip: ctx.ip });
  return u;
});
