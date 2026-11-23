import { requireCtx, can } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { loadProject } from "@/lib/services/access";
import { raidSummary } from "@/lib/services/metrics";
import { RaidView } from "@/components/projects/raid";

export default async function Raid({ params }: { params: Promise<{ key: string }> }) {
  const ctx = await requireCtx(); const p = await loadProject(ctx, (await params).key);
  const [summary, risks, items, members] = await Promise.all([
    raidSummary(ctx, [p.id]),
    prisma.risk.findMany({ where: { projectId: p.id }, orderBy: [{ status: "asc" }, { score: "desc" }] }),
    prisma.raidItem.findMany({ where: { projectId: p.id }, orderBy: { createdAt: "desc" } }),
    prisma.workspaceMember.findMany({ where: { workspaceId: ctx.workspaceId }, include: { user: { select: { id: true, name: true } } } }),
  ]);
  const { band: _b, ...s } = summary; void _b;
  return <RaidView data={JSON.parse(JSON.stringify({ projectId: p.id, summary: s, risks, items, members: members.map((m) => m.user) }))} canEdit={can(ctx, "raid:manage") && !p.archivedAt} />;
}
