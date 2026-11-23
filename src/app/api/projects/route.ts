import { prisma } from "@/lib/db";
import { api, body, pageParams } from "@/lib/api";
import { projectScope } from "@/lib/services/access";
import { createProject, projectCreateSchema } from "@/lib/services/projects";
import type { Prisma } from "@prisma/client";

export const GET = api(async (req, ctx) => {
  const sp = req.nextUrl.searchParams; const { take, skip, page } = pageParams(req);
  const where: Prisma.ProjectWhereInput = { AND: [projectScope(ctx),
    sp.get("archived") === "1" ? { archivedAt: { not: null } } : { archivedAt: null },
    sp.get("status") ? { status: sp.get("status")! } : {}, sp.get("portfolioId") ? { portfolioId: sp.get("portfolioId")! } : {},
    sp.get("q") ? { OR: [{ name: { contains: sp.get("q")!, mode: "insensitive" } }, { key: { contains: sp.get("q")!.toUpperCase() } }] } : {}] };
  const sort = sp.get("sort") ?? "name";
  const [items, total] = await Promise.all([
    prisma.project.findMany({ where, take, skip, orderBy: { [["name", "key", "createdAt", "plannedEndDate", "progress"].includes(sort) ? sort : "name"]: sp.get("dir") === "desc" ? "desc" : "asc" }, include: { portfolio: { select: { name: true } }, program: { select: { name: true } }, lifecycleStage: { select: { name: true } } } }),
    prisma.project.count({ where }),
  ]);
  return { items, total, page, pageSize: take };
});

export const POST = api(async (req, ctx) => createProject(ctx, await body(req, projectCreateSchema)));
