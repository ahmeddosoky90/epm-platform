import { z } from "zod";
import { prisma } from "@/lib/db";
import { api, body } from "@/lib/api";
import { boardData, loadBoard } from "@/lib/services/boards";
import { requirePermission } from "@/lib/auth";
import { badRequest } from "@/lib/errors";
import { audit } from "@/lib/audit";

export const GET = api(async (_r, ctx, p) => boardData(ctx, p.id));
/** Configure board: name, swimlane, columns (name, WIP limit, mapped statuses, order). */
export const PATCH = api(async (req, ctx, p) => {
  requirePermission(ctx, "agile:manage");
  const board = await loadBoard(ctx, p.id);
  const b = await body(req, z.object({
    name: z.string().min(1).max(80).optional(), swimlane: z.enum(["NONE", "ASSIGNEE", "EPIC", "PRIORITY"]).optional(),
    columns: z.array(z.object({ id: z.string().uuid().optional(), name: z.string().min(1).max(40), wipLimit: z.number().int().min(1).max(999).nullable().optional(), statusIds: z.array(z.string().uuid()) })).min(1).max(12).optional(),
  }));
  if (b.columns) {
    const valid = new Set((await prisma.workflowStatus.findMany({ where: { workflowId: board.project.workflowId ?? "" } })).map((s) => s.id));
    const all = b.columns.flatMap((c) => c.statusIds);
    if (all.some((s) => !valid.has(s))) throw badRequest("Columns can only map statuses from the project's workflow");
    if (new Set(all).size !== all.length) throw badRequest("A status can only be mapped to one column");
  }
  return prisma.$transaction(async (tx) => {
    await tx.board.update({ where: { id: board.id }, data: { name: b.name, swimlane: b.swimlane } });
    if (b.columns) {
      await tx.boardColumn.deleteMany({ where: { boardId: board.id } });
      await tx.boardColumn.createMany({ data: b.columns.map((c, i) => ({ boardId: board.id, name: c.name, wipLimit: c.wipLimit ?? null, statusIds: c.statusIds, sortOrder: i })) });
    }
    await audit({ workspaceId: ctx.workspaceId, userId: ctx.user.id, eventType: "board.configured", entityType: "Board", entityId: board.id, after: b, ip: ctx.ip }, tx);
    return tx.board.findUnique({ where: { id: board.id }, include: { columns: { orderBy: { sortOrder: "asc" } } } });
  });
});
