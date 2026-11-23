import { requireCtx, can } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { loadProject } from "@/lib/services/access";
import { Backlog } from "@/components/boards/backlog";

export default async function BacklogPage({ params }: { params: Promise<{ key: string }> }) {
  const ctx = await requireCtx(); const p = await loadProject(ctx, (await params).key);
  const [sprints, issues, epics] = await Promise.all([
    prisma.sprint.findMany({ where: { projectId: p.id, state: { in: ["ACTIVE", "FUTURE"] } }, orderBy: [{ state: "asc" }, { createdAt: "asc" }] }),
    prisma.issue.findMany({ where: { projectId: p.id, deletedAt: null, type: { level: { lt: 3 } }, OR: [{ sprintId: null, status: { category: { not: "DONE" } } }, { sprint: { state: { in: ["ACTIVE", "FUTURE"] } } }] }, include: { type: true, status: true, assignee: { select: { name: true } }, parent: { select: { key: true, summary: true } } }, orderBy: { rank: "asc" } }),
    prisma.issue.findMany({ where: { projectId: p.id, deletedAt: null, type: { level: 3 } }, select: { id: true, key: true, summary: true } }),
  ]);
  return <Backlog data={JSON.parse(JSON.stringify({ project: { id: p.id, key: p.key }, sprints, issues, epics }))} canManage={can(ctx, "agile:manage") && !p.archivedAt} canEdit={can(ctx, "issue:edit") && !p.archivedAt} />;
}
