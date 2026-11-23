import { prisma } from "../db";
import { requirePermission, type Ctx } from "../auth";
import { badRequest, conflict, notFound } from "../errors";
import { loadProject, projectScope } from "./access";
import { audit } from "../audit";
import { D, sum } from "../calc/money";

export async function loadSprint(ctx: Ctx, id: string) {
  const s = await prisma.sprint.findFirst({ where: { id, project: projectScope(ctx) }, include: { project: true } });
  if (!s) throw notFound("Sprint");
  return s;
}

export async function createSprint(ctx: Ctx, projectKey: string, input: { name?: string; goal?: string; startDate?: Date; endDate?: Date; capacityPoints?: number }) {
  requirePermission(ctx, "agile:manage");
  const p = await loadProject(ctx, projectKey);
  if (p.archivedAt) throw badRequest("Project is archived");
  const n = await prisma.sprint.count({ where: { projectId: p.id } });
  return prisma.sprint.create({ data: { projectId: p.id, name: input.name || `${p.key} Sprint ${n + 1}`, goal: input.goal, startDate: input.startDate, endDate: input.endDate, capacityPoints: input.capacityPoints != null ? D(input.capacityPoints) : null } });
}

export async function startSprint(ctx: Ctx, id: string, input: { startDate: Date; endDate: Date; goal?: string }) {
  requirePermission(ctx, "agile:manage");
  const s = await loadSprint(ctx, id);
  if (s.state !== "FUTURE") throw badRequest("Only a future sprint can be started");
  if (input.endDate <= input.startDate) throw badRequest("End date must be after start date");
  if (await prisma.sprint.findFirst({ where: { projectId: s.projectId, state: "ACTIVE" } })) throw conflict("Another sprint is already active in this project");
  const issues = await prisma.issue.findMany({ where: { sprintId: id, deletedAt: null }, include: { status: true } });
  if (!issues.length) throw badRequest("Add issues to the sprint before starting it");
  return prisma.$transaction(async (tx) => {
    // Scope baseline for burndown: re-stamp ADDED events at start for everything in the sprint
    await tx.sprintIssueEvent.deleteMany({ where: { sprintId: id } });
    await tx.sprintIssueEvent.createMany({ data: issues.map((i) => ({ sprintId: id, issueId: i.id, kind: "ADDED", points: i.storyPoints, createdAt: input.startDate })) });
    const committed = sum(issues.map((i) => i.storyPoints));
    const u = await tx.sprint.update({ where: { id }, data: { state: "ACTIVE", startDate: input.startDate, endDate: input.endDate, goal: input.goal ?? s.goal, committedPoints: committed } });
    await audit({ workspaceId: ctx.workspaceId, userId: ctx.user.id, eventType: "sprint.started", entityType: "Sprint", entityId: id, after: { committed: committed.toString(), issues: issues.length }, ip: ctx.ip }, tx);
    return u;
  });
}

/** Complete: incomplete issues move to the chosen sprint or the backlog; scope events record the removal. */
export async function completeSprint(ctx: Ctx, id: string, moveTo: string | null, cancel = false) {
  requirePermission(ctx, "agile:manage");
  const s = await loadSprint(ctx, id);
  if (s.state !== "ACTIVE" && !(cancel && s.state === "FUTURE")) throw badRequest(cancel ? "Only active or future sprints can be cancelled" : "Only the active sprint can be completed");
  if (moveTo) { const t = await loadSprint(ctx, moveTo); if (t.projectId !== s.projectId || t.state !== "FUTURE") throw badRequest("Target must be a future sprint in the same project"); }
  const issues = await prisma.issue.findMany({ where: { sprintId: id, deletedAt: null }, include: { status: true } });
  const done = issues.filter((i) => i.status.category === "DONE"), open = issues.filter((i) => i.status.category !== "DONE");
  return prisma.$transaction(async (tx) => {
    for (const i of open) {
      await tx.issue.update({ where: { id: i.id }, data: { sprintId: moveTo } });
      await tx.sprintIssueEvent.create({ data: { sprintId: id, issueId: i.id, kind: "REMOVED", points: i.storyPoints } });
      if (moveTo) await tx.sprintIssueEvent.create({ data: { sprintId: moveTo, issueId: i.id, kind: "ADDED", points: i.storyPoints } });
      await tx.issueHistory.create({ data: { issueId: i.id, userId: ctx.user.id, field: "sprintId", fromValue: s.name, toValue: moveTo ? "next sprint" : "backlog" } });
    }
    const completedPoints = sum(done.map((i) => i.storyPoints));
    const u = await tx.sprint.update({ where: { id }, data: { state: cancel ? "CANCELLED" : "CLOSED", completedAt: new Date(), completedPoints } });
    await audit({ workspaceId: ctx.workspaceId, userId: ctx.user.id, eventType: cancel ? "sprint.cancelled" : "sprint.completed", entityType: "Sprint", entityId: id, after: { done: done.length, carriedOver: open.length, completedPoints: completedPoints.toString() }, ip: ctx.ip }, tx);
    return { sprint: u, done: done.length, carriedOver: open.length };
  });
}
