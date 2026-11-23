import { requireCtx, can } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { loadProject, canManageProject } from "@/lib/services/access";
import { ChangeList } from "@/components/governance/changes";

export default async function Changes({ params }: { params: Promise<{ key: string }> }) {
  const ctx = await requireCtx(); const p = await loadProject(ctx, (await params).key);
  const crs = await prisma.changeRequest.findMany({ where: { projectId: p.id }, include: { approvals: { orderBy: { step: "asc" }, include: { approver: { select: { name: true } } } } }, orderBy: { number: "desc" } });
  const users = Object.fromEntries((await prisma.user.findMany({ where: { id: { in: crs.map((c) => c.requesterId) } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]));
  return <ChangeList data={JSON.parse(JSON.stringify({ crs, users, project: { id: p.id, key: p.key, currency: p.currency } }))} canCreate={can(ctx, "change:create") && !p.archivedAt} canManage={canManageProject(ctx, p)} myRole={ctx.roleKey} isSuper={ctx.permissions.includes("*")} canApprove={can(ctx, "governance:approve")} />;
}
