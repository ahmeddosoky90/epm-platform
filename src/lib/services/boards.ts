import { prisma } from "../db";
import type { Ctx } from "../auth";
import { projectScope } from "./access";
import { notFound, badRequest } from "../errors";
import { transitionIssue, availableTransitions } from "./issues";
import { requirePermission } from "../auth";
import { loadIssue, assertProjectContributor } from "./access";

export async function loadBoard(ctx: Ctx, boardId: string) {
  const board = await prisma.board.findFirst({ where: { id: boardId, project: projectScope(ctx) }, include: { columns: { orderBy: { sortOrder: "asc" } }, project: true } });
  if (!board) throw notFound("Board");
  return board;
}

export async function boardData(ctx: Ctx, boardId: string) {
  const board = await loadBoard(ctx, boardId);
  const activeSprint = board.kind === "SCRUM" ? await prisma.sprint.findFirst({ where: { projectId: board.projectId, state: "ACTIVE" } }) : null;
  const statusIds = board.columns.flatMap((c) => c.statusIds);
  const issues = await prisma.issue.findMany({
    where: { projectId: board.projectId, deletedAt: null, statusId: { in: statusIds }, ...(board.kind === "SCRUM" ? { sprintId: activeSprint?.id ?? "__none__" } : {}),
      // Kanban hides done items older than 14 days to keep the board fast
      ...(board.kind === "KANBAN" ? { OR: [{ resolvedAt: null }, { resolvedAt: { gte: new Date(Date.now() - 14 * 86400000) } }] } : {}),
      type: { level: { lt: 3 } } },
    include: { type: true, status: true, assignee: { select: { id: true, name: true } }, parent: { select: { key: true, summary: true } }, linksIn: { where: { type: "BLOCKS", source: { status: { category: { not: "DONE" } }, deletedAt: null } }, select: { id: true } } },
    orderBy: { rank: "asc" },
  });
  return { board, activeSprint, issues: issues.map((i) => ({ ...i, blocked: i.linksIn.length > 0 || i.status.name === "Blocked" })) };
}

/** Move a card to a column: resolved into a workflow transition so drag-and-drop can't bypass workflow rules. */
export async function moveCard(ctx: Ctx, boardId: string, issueKey: string, columnId: string, beforeKey?: string | null) {
  const board = await loadBoard(ctx, boardId);
  const col = board.columns.find((c) => c.id === columnId);
  if (!col) throw badRequest("Unknown column");
  const issue = await loadIssue(ctx, issueKey);
  if (issue.projectId !== board.projectId) throw badRequest("Issue is not on this board");
  if (!col.statusIds.includes(issue.statusId)) {
    const options = await availableTransitions(issue.id);
    const t = options.find((o) => col.statusIds.includes(o.toStatusId));
    if (!t) throw badRequest(`The workflow has no transition from the current status into "${col.name}"`);
    await transitionIssue(ctx, issue.key, { transitionId: t.id });
  }
  // rank (ordering within column)
  requirePermission(ctx, "issue:edit");
  await assertProjectContributor(ctx, issue.projectId);
  if (beforeKey !== undefined) {
    const before = beforeKey ? await prisma.issue.findFirst({ where: { key: beforeKey, projectId: board.projectId } }) : null;
    let rank: number;
    if (before) {
      const prev = await prisma.issue.findFirst({ where: { projectId: board.projectId, rank: { lt: before.rank } }, orderBy: { rank: "desc" } });
      rank = prev ? (prev.rank + before.rank) / 2 : before.rank - 1000;
    } else {
      const max = await prisma.issue.aggregate({ where: { projectId: board.projectId }, _max: { rank: true } });
      rank = (max._max.rank ?? 0) + 1000;
    }
    await prisma.issue.update({ where: { id: issue.id }, data: { rank } });
  }
  return { ok: true };
}
