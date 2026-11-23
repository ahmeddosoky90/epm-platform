import { z } from "zod";
import { prisma } from "@/lib/db";
import { api, body } from "@/lib/api";
import { projectScope, loadProject } from "@/lib/services/access";
import { requirePermission } from "@/lib/auth";

export const GET = api(async (_r, ctx) => prisma.board.findMany({ where: { project: { ...projectScope(ctx), archivedAt: null } }, include: { project: { select: { key: true, name: true } } }, orderBy: { project: { name: "asc" } } }));
export const POST = api(async (req, ctx) => {
  requirePermission(ctx, "agile:manage");
  const b = await body(req, z.object({ projectId: z.string(), name: z.string().min(1).max(80), kind: z.enum(["KANBAN", "SCRUM"]) }));
  const p = await loadProject(ctx, b.projectId);
  const statuses = await prisma.workflowStatus.findMany({ where: { workflowId: p.workflowId ?? "" }, orderBy: { sortOrder: "asc" } });
  const cats = [["To Do", "TODO"], ["In Progress", "IN_PROGRESS"], ["Done", "DONE"]] as const;
  return prisma.board.create({ data: { projectId: p.id, name: b.name, kind: b.kind, columns: { create: cats.map(([name, c], i) => ({ name, sortOrder: i, statusIds: statuses.filter((s) => s.category === c).map((s) => s.id) })) } } });
});
