import Link from "next/link";
import { requireCtx, pagePermission } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Chip } from "@/components/ui/bits";

export default async function WorkflowsPage() {
  const ctx = await requireCtx(); pagePermission(ctx, "admin:workflows");
  const wfs = await prisma.workflow.findMany({ where: { workspaceId: ctx.workspaceId }, include: { statuses: { orderBy: { sortOrder: "asc" } }, _count: { select: { transitions: true, projects: true } } } });
  return <div className="grid md:grid-cols-2 gap-4">{wfs.map((w) => <Link key={w.id} href={`/admin/workflows/${w.id}`} className="card p-4 hover:border-accent transition">
    <div className="flex items-center gap-2"><span className="font-medium">{w.name}</span>{w.isDefault && <Chip color="#0a84ff">default</Chip>}<span className="text-xs muted ms-auto">v{w.version}</span></div>
    <div className="text-sm muted mb-2">{w._count.projects} project(s) · {w._count.transitions} transitions</div>
    <div className="flex flex-wrap gap-1">{w.statuses.map((s) => <Chip key={s.id} color={s.color}>{s.name}</Chip>)}</div></Link>)}</div>;
}
