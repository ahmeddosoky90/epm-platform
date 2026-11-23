import Link from "next/link";
import { requireCtx } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { projectScope } from "@/lib/services/access";
import { PageHeader, Chip, Empty } from "@/components/ui/bits";
export const metadata = { title: "Boards" };
export default async function Boards() {
  const ctx = await requireCtx();
  const boards = await prisma.board.findMany({ where: { project: { ...projectScope(ctx), archivedAt: null } }, include: { project: { select: { key: true, name: true } }, columns: true }, orderBy: [{ project: { name: "asc" } }, { createdAt: "asc" }] });
  return (<><PageHeader title="Boards" subtitle="Kanban and Scrum boards across your projects" />
    {boards.length === 0 ? <Empty title="No boards" /> : <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">{boards.map((b) => <Link key={b.id} href={`/projects/${b.project.key}/board?board=${b.id}`} className="card p-4 hover:border-accent transition"><div className="flex items-center gap-2 mb-1"><Chip color={b.kind === "SCRUM" ? "#5856d6" : "#0a84ff"}>{b.kind}</Chip><span className="font-medium">{b.name}</span></div><div className="text-sm muted">{b.project.name} · {b.columns.length} columns</div></Link>)}</div>}</>);
}
