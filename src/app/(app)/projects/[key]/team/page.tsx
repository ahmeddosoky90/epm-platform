import { requireCtx } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { loadProject, canManageProject } from "@/lib/services/access";
import { Card } from "@/components/ui/bits";
import { TeamEditor } from "@/components/projects/team";

export default async function TeamPage({ params }: { params: Promise<{ key: string }> }) {
  const ctx = await requireCtx();
  const p = await loadProject(ctx, (await params).key, { allowArchived: true });
  const [members, wsMembers, allocations] = await Promise.all([
    prisma.projectMember.findMany({ where: { projectId: p.id }, include: { user: { select: { id: true, name: true, email: true } } } }),
    prisma.workspaceMember.findMany({ where: { workspaceId: ctx.workspaceId, user: { isActive: true } }, include: { user: { select: { id: true, name: true } }, role: { select: { name: true } } } }),
    prisma.resourceAllocation.findMany({ where: { projectId: p.id }, include: { resource: { select: { name: true, jobTitle: true } } }, orderBy: { startDate: "asc" } }),
  ]);
  const roleOf = new Map(wsMembers.map((m) => [m.userId, m.role.name]));
  const memberIds = new Set(members.map((m) => m.userId));
  return (<>
    <TeamEditor projectKey={p.key} managerId={p.managerId} canEdit={canManageProject(ctx, p) && !p.archivedAt}
      members={members.map((m) => ({ userId: m.userId, name: m.user.name, email: m.user.email, projectRole: m.projectRole, workspaceRole: roleOf.get(m.userId) ?? "—" })).sort((a, b) => a.name.localeCompare(b.name))}
      candidates={wsMembers.filter((m) => !memberIds.has(m.userId)).map((m) => m.user).sort((a, b) => a.name.localeCompare(b.name))} />
    <Card title="Resource allocations" className="mt-6" pad={false}>
      {allocations.length ? <table className="table"><thead><tr><th>Resource</th><th>Role</th><th>Allocation</th><th>From</th><th>To</th><th className="text-end">Planned h</th><th className="text-end">Actual h</th></tr></thead>
        <tbody>{allocations.map((a) => <tr key={a.id}><td>{a.resource.name} <span className="text-xs muted">{a.resource.jobTitle}</span></td><td className="text-xs">{a.role ?? "—"}</td><td>{a.percent}%</td><td className="text-xs">{a.startDate.toISOString().slice(0, 10)}</td><td className="text-xs">{a.endDate.toISOString().slice(0, 10)}</td><td className="text-end text-xs">{Number(a.plannedHours)}</td><td className="text-end text-xs">{Number(a.actualHours)}</td></tr>)}</tbody></table>
        : <p className="p-4 text-sm muted">No resources are allocated. Allocate people from the Resources page.</p>}
    </Card>
  </>);
}
