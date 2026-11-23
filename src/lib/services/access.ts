import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { can, type Ctx } from "../auth";
import { forbidden, notFound } from "../errors";

/** Where-clause restricting projects to what the caller may see (object-level authorization). */
export function projectScope(ctx: Ctx): Prisma.ProjectWhereInput {
  const base: Prisma.ProjectWhereInput = { workspaceId: ctx.workspaceId };
  if (can(ctx, "project:view_all")) return base;
  return { ...base, OR: [{ managerId: ctx.user.id }, { members: { some: { userId: ctx.user.id } } }] };
}

/** Load a project the caller may see by id or key. `write` additionally requires manage rights. */
export async function loadProject(ctx: Ctx, idOrKey: string, opts: { write?: boolean; allowArchived?: boolean } = {}) {
  const isUuid = /^[0-9a-f-]{36}$/i.test(idOrKey);
  const p = await prisma.project.findFirst({ where: { AND: [projectScope(ctx), isUuid ? { id: idOrKey } : { key: idOrKey.toUpperCase() }] } });
  if (!p) throw notFound("Project"); // 404 (not 403) so IDs from other workspaces are not disclosed
  if (opts.write) {
    if (p.archivedAt && !opts.allowArchived) throw forbidden("Project is archived and read-only");
    if (!canManageProject(ctx, p)) throw forbidden("Only the project manager or PMO can change this project");
  }
  return p;
}

export function canManageProject(ctx: Ctx, p: { managerId: string | null }) {
  return can(ctx, "project:edit_all") || p.managerId === ctx.user.id;
}

/** Can the caller do delivery work (issues) in this project? Members, managers, or view_all + issue perms. */
export async function assertProjectContributor(ctx: Ctx, projectId: string) {
  if (can(ctx, "project:edit_all")) return;
  const m = await prisma.projectMember.findUnique({ where: { projectId_userId: { projectId, userId: ctx.user.id } } });
  const p = await prisma.project.findUnique({ where: { id: projectId }, select: { managerId: true } });
  if (!m && p?.managerId !== ctx.user.id) throw forbidden("You are not a member of this project");
  if (m?.projectRole === "Viewer") throw forbidden("Project viewers cannot change work items");
}

export async function loadIssue(ctx: Ctx, idOrKey: string) {
  const isUuid = /^[0-9a-f-]{36}$/i.test(idOrKey);
  const issue = await prisma.issue.findFirst({
    where: { ...(isUuid ? { id: idOrKey } : { key: idOrKey.toUpperCase() }), project: projectScope(ctx) },
  });
  if (!issue) throw notFound("Issue");
  return issue;
}
