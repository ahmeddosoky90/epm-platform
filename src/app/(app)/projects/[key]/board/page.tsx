import Link from "next/link";
import { requireCtx, can } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { loadProject } from "@/lib/services/access";
import { BoardView } from "@/components/boards/board";

export default async function ProjectBoard({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<{ board?: string }> }) {
  const ctx = await requireCtx(); const p = await loadProject(ctx, (await params).key); const sp = await searchParams;
  const boards = await prisma.board.findMany({ where: { projectId: p.id }, orderBy: { createdAt: "asc" } });
  const statuses = await prisma.workflowStatus.findMany({ where: { workflowId: p.workflowId ?? "" }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } });
  const current = boards.find((b) => b.id === sp.board) ?? boards[0];
  if (!current) return <p className="muted text-sm">This project has no boards yet.</p>;
  return (<>
    <div className="flex gap-1 mb-4">{boards.map((b) => <Link key={b.id} href={`?board=${b.id}`} className={`btn-sm ${b.id === current.id ? "btn-primary" : "btn-secondary"}`}>{b.name}</Link>)}</div>
    <BoardView key={current.id} boardId={current.id} meId={ctx.user.id} canManage={can(ctx, "agile:manage") && !p.archivedAt} canCreate={can(ctx, "issue:create") && !p.archivedAt} statuses={statuses} />
  </>);
}
