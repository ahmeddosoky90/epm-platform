import { prisma } from "@/lib/db";
import { api } from "@/lib/api";
import { projectScope } from "@/lib/services/access";

/** Lookup data for pickers (scoped to the caller's workspace and visible projects). */
export const GET = api(async (req, ctx) => {
  const projectId = req.nextUrl.searchParams.get("projectId");
  const [issueTypes, members, projects, sprints, epics, portfolios, programs, templates] = await Promise.all([
    prisma.issueType.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: [{ level: "desc" }, { name: "asc" }] }),
    prisma.workspaceMember.findMany({ where: { workspaceId: ctx.workspaceId, user: { isActive: true } }, include: { user: { select: { id: true, name: true, email: true } }, role: { select: { name: true } } }, orderBy: { user: { name: "asc" } } }),
    prisma.project.findMany({ where: { ...projectScope(ctx), archivedAt: null }, select: { id: true, key: true, name: true }, orderBy: { name: "asc" } }),
    projectId ? prisma.sprint.findMany({ where: { projectId, state: { in: ["FUTURE", "ACTIVE"] }, project: projectScope(ctx) }, select: { id: true, name: true, state: true } }) : [],
    projectId ? prisma.issue.findMany({ where: { projectId, deletedAt: null, type: { level: 3 }, project: projectScope(ctx) }, select: { id: true, key: true, summary: true } }) : [],
    prisma.portfolio.findMany({ where: { workspaceId: ctx.workspaceId }, select: { id: true, name: true } }),
    prisma.program.findMany({ where: { workspaceId: ctx.workspaceId }, select: { id: true, name: true, portfolioId: true } }),
    prisma.projectTemplate.findMany({ where: { workspaceId: ctx.workspaceId }, select: { id: true, name: true, methodology: true } }),
  ]);
  return { issueTypes, members: members.map((m) => ({ ...m.user, role: m.role.name })), projects, sprints, epics, portfolios, programs, templates, me: ctx.user.id, currency: ctx.workspace.currency };
});
