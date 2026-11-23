import { prisma } from "../db";
import type { Ctx } from "../auth";
import { compile, compileOrder, parse, EqlError } from "../jql";
import { projectScope } from "./access";
import { badRequest } from "../errors";

export async function runEql(ctx: Ctx, jql: string, take = 50, skip = 0) {
  const members = await prisma.workspaceMember.findMany({ where: { workspaceId: ctx.workspaceId }, include: { user: { select: { id: true, email: true, name: true } } } });
  const resolveUser = (s: string) => {
    const l = s.toLowerCase();
    return members.find((m) => m.user.email.toLowerCase() === l || m.user.email.split("@")[0].toLowerCase() === l || m.user.name.toLowerCase() === l)?.user.id ?? "00000000-0000-0000-0000-000000000000";
  };
  try {
    const parsed = parse(jql);
    const where = { AND: [compile(parsed.where, { userId: ctx.user.id, resolveUser }), { deletedAt: null }, { project: projectScope(ctx) }] };
    const [items, total] = await Promise.all([
      prisma.issue.findMany({ where, orderBy: compileOrder(parsed.orderBy), take, skip, include: { status: true, type: true, assignee: { select: { name: true } }, project: { select: { key: true } } } }),
      prisma.issue.count({ where }),
    ]);
    return { items, total };
  } catch (e) {
    if (e instanceof EqlError) throw badRequest(`Query error: ${e.message}`);
    throw e;
  }
}

/** Global quick search across entity types (authorised scope only). */
export async function quickSearch(ctx: Ctx, q: string) {
  const c = { contains: q, mode: "insensitive" as const };
  const scope = projectScope(ctx);
  const [issues, projects, users, portfolios, programs, milestones, risks, documents] = await Promise.all([
    prisma.issue.findMany({ where: { deletedAt: null, project: scope, OR: [{ summary: c }, { key: q.toUpperCase() }] }, take: 10, include: { status: true, type: true }, orderBy: { updatedAt: "desc" } }),
    prisma.project.findMany({ where: { AND: [scope, { OR: [{ name: c }, { key: q.toUpperCase() }] }] }, take: 8 }),
    prisma.user.findMany({ where: { memberships: { some: { workspaceId: ctx.workspaceId } }, OR: [{ name: c }, { email: c }] }, take: 8, select: { id: true, name: true, email: true, jobTitle: true } }),
    prisma.portfolio.findMany({ where: { workspaceId: ctx.workspaceId, name: c }, take: 5 }),
    prisma.program.findMany({ where: { workspaceId: ctx.workspaceId, name: c }, take: 5 }),
    prisma.milestone.findMany({ where: { project: scope, name: c }, take: 5, include: { project: { select: { key: true } } } }),
    prisma.risk.findMany({ where: { project: scope, title: c }, take: 5, include: { project: { select: { key: true } } } }),
    prisma.document.findMany({ where: { project: scope, title: c }, take: 5, include: { project: { select: { key: true } } } }),
  ]);
  return { issues, projects, users, portfolios, programs, milestones, risks, documents };
}
