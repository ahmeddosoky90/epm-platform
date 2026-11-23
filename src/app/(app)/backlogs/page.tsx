import Link from "next/link";
import { requireCtx } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { projectScope } from "@/lib/services/access";
import { PageHeader, Empty } from "@/components/ui/bits";

export default async function Backlogs() {
  const ctx = await requireCtx();
  const projects = await prisma.project.findMany({ where: { AND: [projectScope(ctx), { archivedAt: null, methodology: { not: "WATERFALL" } }] }, select: { id: true, key: true, name: true }, orderBy: { name: "asc" } });
  const counts = await prisma.issue.groupBy({ by: ["projectId"], where: { projectId: { in: projects.map((p) => p.id) }, deletedAt: null, sprintId: null, status: { category: { not: "DONE" } }, type: { level: { lte: 2 } } }, _count: true, _sum: { storyPoints: true } });
  return (<><PageHeader title="Backlogs" subtitle="Unscheduled work (not in any sprint) for agile and hybrid projects" />
    {!projects.length ? <Empty title="No agile projects" /> : <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">{projects.map((p) => { const c = counts.find((x) => x.projectId === p.id); return <Link key={p.id} href={`/projects/${p.key}/backlog`} className="card p-4 hover:border-accent transition"><div className="font-medium">{p.name}</div><div className="text-sm muted">{p.key} · {c?._count ?? 0} items · {Number(c?._sum.storyPoints ?? 0)} points unscheduled</div></Link>; })}</div>}
  </>);
}
