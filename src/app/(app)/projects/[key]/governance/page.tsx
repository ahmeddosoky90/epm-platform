import { requireCtx, can } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { loadProject, canManageProject } from "@/lib/services/access";
import { GateList } from "@/components/governance/gates";

export default async function ProjectGovernance({ params }: { params: Promise<{ key: string }> }) {
  const ctx = await requireCtx(); const p = await loadProject(ctx, (await params).key);
  const gates = await prisma.projectGate.findMany({ where: { projectId: p.id }, include: { stage: true, approvals: { orderBy: { step: "asc" }, include: { approver: { select: { name: true } } } } }, orderBy: { stage: { sortOrder: "asc" } } });
  const members = (await prisma.workspaceMember.findMany({ where: { workspaceId: ctx.workspaceId }, include: { user: { select: { id: true, name: true } } } })).map((m) => m.user);
  return <GateList gates={JSON.parse(JSON.stringify(gates))} canEdit={(can(ctx, "governance:manage") || canManageProject(ctx, p)) && !p.archivedAt} myRole={ctx.roleKey} isSuper={ctx.permissions.includes("*")} canApprove={can(ctx, "governance:approve")} members={members} tz={ctx.workspace.timezone} />;
}
