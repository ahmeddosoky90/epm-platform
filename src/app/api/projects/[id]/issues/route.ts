import { prisma } from "@/lib/db";
import { api, body, pageParams } from "@/lib/api";
import { loadProject } from "@/lib/services/access";
import { createIssue, issueCreateSchema } from "@/lib/services/issues";

export const GET = api(async (req, ctx, p) => {
  const project = await loadProject(ctx, p.id);
  const { take, skip, page } = pageParams(req);
  const where = { projectId: project.id, deletedAt: req.nextUrl.searchParams.get("deleted") === "1" ? { not: null } : null };
  const [items, total] = await Promise.all([
    prisma.issue.findMany({ where, take, skip, orderBy: { number: "desc" }, include: { status: true, type: true, assignee: { select: { name: true } } } }),
    prisma.issue.count({ where }),
  ]);
  return { items, total, page, pageSize: take };
});
export const POST = api(async (req, ctx, p) => createIssue(ctx, p.id, await body(req, issueCreateSchema)));
