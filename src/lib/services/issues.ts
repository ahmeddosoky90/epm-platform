import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db";
import { can, requirePermission, type Ctx } from "../auth";
import { audit } from "../audit";
import { badRequest, conflict, forbidden, notFound } from "../errors";
import { evaluateTransition, wouldCreateCycle, type TransitionRule } from "../calc/workflow";
import { assertProjectContributor, loadIssue, loadProject } from "./access";
import { notify, resolveMentions } from "./notify";

export const PRIORITIES = ["Blocker", "Critical", "High", "Medium", "Low"] as const;
export const LINK_TYPES = ["BLOCKS", "RELATES", "DUPLICATES", "DEPENDS_ON"] as const;
const dateish = z.union([z.string().datetime({ offset: true }), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).nullable().optional()
  .transform((v) => (v ? new Date(v) : v === null ? null : undefined));

export const issueCreateSchema = z.object({
  summary: z.string().trim().min(1).max(255),
  description: z.string().max(50_000).optional(),
  typeId: z.string().uuid(),
  priority: z.enum(PRIORITIES).default("Medium"),
  assigneeId: z.string().uuid().nullable().optional(),
  parentId: z.string().uuid().nullable().optional(),
  sprintId: z.string().uuid().nullable().optional(),
  storyPoints: z.number().min(0).max(1000).nullable().optional(),
  originalEstimateMin: z.number().int().min(0).nullable().optional(),
  dueDate: dateish,
  startDate: dateish,
  labels: z.array(z.string().max(50)).max(30).optional(),
  components: z.array(z.string().max(50)).max(30).optional(),
  severity: z.enum(["S1", "S2", "S3", "S4"]).nullable().optional(),
  isShowStopper: z.boolean().optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
});
export const issueUpdateSchema = issueCreateSchema.partial().extend({
  remainingEstimateMin: z.number().int().min(0).nullable().optional(),
  fixVersionId: z.string().uuid().nullable().optional(),
  resolution: z.string().max(50).nullable().optional(),
});

const TRACKED = ["summary", "description", "typeId", "priority", "assigneeId", "parentId", "sprintId", "storyPoints", "originalEstimateMin",
  "remainingEstimateMin", "dueDate", "startDate", "labels", "components", "severity", "isShowStopper", "fixVersionId", "resolution", "statusId"] as const;

const fmt = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (Array.isArray(v)) return v.join(", ");
  if (v instanceof Prisma.Decimal) return v.toString();
  return String(v);
};

async function validateRefs(tx: Prisma.TransactionClient, projectId: string, workspaceId: string, d: Partial<z.infer<typeof issueUpdateSchema>>, selfId?: string) {
  if (d.typeId) {
    const t = await tx.issueType.findFirst({ where: { id: d.typeId, workspaceId } });
    if (!t) throw badRequest("Unknown issue type");
  }
  if (d.assigneeId) {
    const m = await tx.workspaceMember.findFirst({ where: { workspaceId, userId: d.assigneeId, user: { isActive: true } } });
    if (!m) throw badRequest("Assignee is not an active member of this workspace");
  }
  if (d.parentId) {
    if (d.parentId === selfId) throw badRequest("An issue cannot be its own parent");
    const p = await tx.issue.findFirst({ where: { id: d.parentId, projectId, deletedAt: null }, include: { type: true } });
    if (!p) throw badRequest("Parent issue must be in the same project");
    if (selfId) {
      // prevent hierarchy cycles
      let cur: string | null = p.parentId;
      while (cur) {
        if (cur === selfId) throw badRequest("Parent change would create a hierarchy cycle");
        cur = (await tx.issue.findUnique({ where: { id: cur }, select: { parentId: true } }))?.parentId ?? null;
      }
    }
  }
  if (d.sprintId) {
    const s = await tx.sprint.findFirst({ where: { id: d.sprintId, projectId } });
    if (!s) throw badRequest("Sprint not found in this project");
    if (s.state === "CLOSED" || s.state === "CANCELLED") throw badRequest("Cannot add issues to a closed sprint");
  }
  if (d.fixVersionId) {
    const v = await tx.version.findFirst({ where: { id: d.fixVersionId, projectId } });
    if (!v) throw badRequest("Version not found in this project");
  }
}

async function ensureWorkflow(projectId: string) {
  const p = await prisma.project.findUniqueOrThrow({ where: { id: projectId }, select: { workflowId: true, workspaceId: true } });
  if (p.workflowId) return p.workflowId;
  const wf = await prisma.workflow.findFirst({ where: { workspaceId: p.workspaceId, isDefault: true } });
  if (!wf) throw badRequest("No workflow configured for this project");
  await prisma.project.update({ where: { id: projectId }, data: { workflowId: wf.id } });
  return wf.id;
}

/** Create an issue. Key = PROJECTKEY-n where n comes from an atomic, never-decremented counter. */
export async function createIssue(ctx: Ctx, projectIdOrKey: string, input: z.infer<typeof issueCreateSchema>) {
  requirePermission(ctx, "issue:create");
  const project = await loadProject(ctx, projectIdOrKey);
  if (project.archivedAt) throw forbidden("Project is archived and read-only");
  await assertProjectContributor(ctx, project.id);
  const workflowId = await ensureWorkflow(project.id);
  const initial = await prisma.workflowStatus.findFirst({ where: { workflowId, isInitial: true } })
    ?? await prisma.workflowStatus.findFirst({ where: { workflowId }, orderBy: { sortOrder: "asc" } });
  if (!initial) throw badRequest("Workflow has no statuses");

  const issue = await prisma.$transaction(async (tx) => {
    await validateRefs(tx, project.id, ctx.workspaceId, input);
    const { issueCounter } = await tx.project.update({ where: { id: project.id }, data: { issueCounter: { increment: 1 } }, select: { issueCounter: true } });
    const maxRank = await tx.issue.aggregate({ where: { projectId: project.id }, _max: { rank: true } });
    const created = await tx.issue.create({
      data: {
        projectId: project.id, number: issueCounter, key: `${project.key}-${issueCounter}`,
        summary: input.summary, description: input.description, typeId: input.typeId, statusId: initial.id,
        priority: input.priority, assigneeId: input.assigneeId ?? null, reporterId: ctx.user.id,
        parentId: input.parentId ?? null, sprintId: input.sprintId ?? null,
        storyPoints: input.storyPoints ?? null, originalEstimateMin: input.originalEstimateMin ?? null,
        remainingEstimateMin: input.originalEstimateMin ?? null,
        dueDate: input.dueDate ?? null, startDate: input.startDate ?? null,
        labels: input.labels ?? [], components: input.components ?? [],
        severity: input.severity ?? null, isShowStopper: input.isShowStopper ?? false,
        customFields: (input.customFields ?? {}) as Prisma.InputJsonValue,
        rank: (maxRank._max.rank ?? 0) + 1000,
        watchers: { create: [{ userId: ctx.user.id }] },
      },
    });
    await tx.issueHistory.create({ data: { issueId: created.id, userId: ctx.user.id, field: "created", toValue: created.key } });
    if (created.sprintId) await tx.sprintIssueEvent.create({ data: { sprintId: created.sprintId, issueId: created.id, kind: "ADDED", points: created.storyPoints } });
    await audit({ workspaceId: ctx.workspaceId, userId: ctx.user.id, eventType: "issue.created", entityType: "Issue", entityId: created.id, after: { key: created.key, summary: created.summary }, ip: ctx.ip }, tx);
    if (created.assigneeId) await notify({ userIds: [created.assigneeId], excludeUserId: ctx.user.id, kind: "assigned", title: `${created.key} was assigned to you`, body: created.summary, link: `/issues/${created.key}`, dedupeKey: `assign:${created.id}:${created.assigneeId}:0` }, tx);
    return created;
  });
  return issue;
}

export async function updateIssue(ctx: Ctx, idOrKey: string, patch: z.infer<typeof issueUpdateSchema>) {
  requirePermission(ctx, "issue:edit");
  const issue = await loadIssue(ctx, idOrKey);
  if (issue.deletedAt) throw forbidden("Issue is deleted; restore it first");
  const project = await prisma.project.findUniqueOrThrow({ where: { id: issue.projectId } });
  if (project.archivedAt) throw forbidden("Project is archived and read-only");
  await assertProjectContributor(ctx, issue.projectId);

  return prisma.$transaction(async (tx) => {
    await validateRefs(tx, issue.projectId, ctx.workspaceId, patch, issue.id);
    const data: Prisma.IssueUncheckedUpdateInput = {};
    const changes: { field: string; from: string | null; to: string | null }[] = [];
    for (const f of TRACKED) {
      if (!(f in patch)) continue;
      const next = (patch as Record<string, unknown>)[f];
      if (next === undefined) continue;
      const prev = (issue as Record<string, unknown>)[f];
      if (fmt(prev) === fmt(next)) continue;
      (data as Record<string, unknown>)[f] = next;
      changes.push({ field: f, from: fmt(prev), to: fmt(next) });
    }
    if (patch.customFields) data.customFields = { ...(issue.customFields as object), ...patch.customFields } as Prisma.InputJsonValue;
    if (!changes.length && !patch.customFields) return issue;
    const updated = await tx.issue.update({ where: { id: issue.id }, data });
    if (changes.length) await tx.issueHistory.createMany({ data: changes.map((c) => ({ issueId: issue.id, userId: ctx.user.id, field: c.field, fromValue: c.from, toValue: c.to })) });
    // sprint scope change tracking
    if ("sprintId" in data) {
      if (issue.sprintId) await tx.sprintIssueEvent.create({ data: { sprintId: issue.sprintId, issueId: issue.id, kind: "REMOVED", points: issue.storyPoints } });
      if (updated.sprintId) await tx.sprintIssueEvent.create({ data: { sprintId: updated.sprintId, issueId: issue.id, kind: "ADDED", points: updated.storyPoints } });
    } else if ("storyPoints" in data && updated.sprintId) {
      const diff = Number(updated.storyPoints ?? 0) - Number(issue.storyPoints ?? 0);
      if (diff) await tx.sprintIssueEvent.create({ data: { sprintId: updated.sprintId, issueId: issue.id, kind: diff > 0 ? "ADDED" : "REMOVED", points: Math.abs(diff) } });
    }
    await audit({ workspaceId: ctx.workspaceId, userId: ctx.user.id, eventType: "issue.updated", entityType: "Issue", entityId: issue.id, before: Object.fromEntries(changes.map((c) => [c.field, c.from])), after: Object.fromEntries(changes.map((c) => [c.field, c.to])), ip: ctx.ip }, tx);
    if ("assigneeId" in data && updated.assigneeId) {
      const n = await tx.issueHistory.count({ where: { issueId: issue.id, field: "assigneeId" } });
      await notify({ userIds: [updated.assigneeId], excludeUserId: ctx.user.id, kind: "assigned", title: `${updated.key} was assigned to you`, body: updated.summary, link: `/issues/${updated.key}`, dedupeKey: `assign:${issue.id}:${updated.assigneeId}:${n}` }, tx);
    }
    return updated;
  });
}

export async function availableTransitions(issueId: string) {
  const issue = await prisma.issue.findUniqueOrThrow({ where: { id: issueId }, include: { status: true } });
  return prisma.workflowTransition.findMany({
    where: { workflowId: issue.status.workflowId, OR: [{ fromStatusId: issue.statusId }, { fromStatusId: null }], NOT: { toStatusId: issue.statusId } },
    include: { toStatus: true },
  });
}

/**
 * Execute a workflow transition. Used by the issue page AND board drag-and-drop, so the
 * board can never bypass workflow rules.
 */
export async function transitionIssue(ctx: Ctx, idOrKey: string, input: { transitionId?: string; toStatusId?: string; fields?: Record<string, unknown>; comment?: string }) {
  requirePermission(ctx, "issue:transition");
  const issue = await loadIssue(ctx, idOrKey);
  if (issue.deletedAt) throw forbidden("Issue is deleted");
  const project = await prisma.project.findUniqueOrThrow({ where: { id: issue.projectId } });
  if (project.archivedAt) throw forbidden("Project is archived and read-only");
  await assertProjectContributor(ctx, issue.projectId);
  const options = await availableTransitions(issue.id);
  const t = input.transitionId ? options.find((o) => o.id === input.transitionId) : options.find((o) => o.toStatusId === input.toStatusId);
  if (!t) throw badRequest("No workflow transition leads to that status from the current status");
  const openBlockers = await prisma.issueLink.count({
    where: { targetId: issue.id, type: "BLOCKS", source: { deletedAt: null, status: { category: { not: "DONE" } } } },
  });
  const approved = await prisma.issueHistory.count({ where: { issueId: issue.id, field: "review", toValue: "APPROVED" } }) > 0;
  const rule: TransitionRule = { ...t, conditions: (t.conditions ?? {}) as TransitionRule["conditions"] };
  const errs = evaluateTransition(issue as unknown as Record<string, unknown> & { statusId: string; assigneeId: string | null }, rule,
    { userId: ctx.user.id, roleKey: ctx.roleKey, isSuper: ctx.permissions.includes("*") }, { openBlockers, approved, patch: input.fields });
  if (errs.length) throw badRequest("Transition blocked by workflow rules", { reasons: errs });

  const post = (t.postFunctions ?? {}) as { setResolution?: string; clearResolution?: boolean; assignToReporter?: boolean; notifyWatchers?: boolean };
  const fromStatus = await prisma.workflowStatus.findUniqueOrThrow({ where: { id: issue.statusId } });
  return prisma.$transaction(async (tx) => {
    const fieldPatch = (input.fields ?? {}) as Prisma.IssueUncheckedUpdateInput;
    const data: Prisma.IssueUncheckedUpdateInput = { ...pickAllowed(fieldPatch), statusId: t.toStatusId };
    if (t.toStatus.category === "DONE") { data.resolvedAt = new Date(); data.resolution = (fieldPatch.resolution as string) ?? post.setResolution ?? issue.resolution ?? "Done"; data.remainingEstimateMin = 0; }
    if (fromStatus.category === "DONE" && t.toStatus.category !== "DONE") { data.resolvedAt = null; if (post.clearResolution !== false) data.resolution = null; }
    if (post.assignToReporter) data.assigneeId = issue.reporterId;
    const updated = await tx.issue.update({ where: { id: issue.id }, data });
    await tx.issueHistory.create({ data: { issueId: issue.id, userId: ctx.user.id, field: "status", fromValue: fromStatus.name, toValue: t.toStatus.name } });
    if (input.comment) await tx.issueComment.create({ data: { issueId: issue.id, authorId: ctx.user.id, body: input.comment } });
    if (issue.sprintId) {
      if (t.toStatus.category === "DONE" && fromStatus.category !== "DONE") await tx.sprintIssueEvent.create({ data: { sprintId: issue.sprintId, issueId: issue.id, kind: "COMPLETED", points: issue.storyPoints } });
      if (fromStatus.category === "DONE" && t.toStatus.category !== "DONE") await tx.sprintIssueEvent.create({ data: { sprintId: issue.sprintId, issueId: issue.id, kind: "REOPENED", points: issue.storyPoints } });
    }
    await audit({ workspaceId: ctx.workspaceId, userId: ctx.user.id, eventType: "issue.transitioned", entityType: "Issue", entityId: issue.id, before: { status: fromStatus.name }, after: { status: t.toStatus.name, transition: t.name }, ip: ctx.ip }, tx);
    if (post.notifyWatchers !== false) {
      const watchers = await tx.issueWatcher.findMany({ where: { issueId: issue.id }, select: { userId: true } });
      await notify({ userIds: [...watchers.map((w) => w.userId), issue.assigneeId, issue.reporterId], excludeUserId: ctx.user.id, kind: "status", title: `${issue.key} moved to ${t.toStatus.name}`, body: issue.summary, link: `/issues/${issue.key}` }, tx);
    }
    if (t.toStatus.name === "Blocked") {
      // dependent issues get notified their dependency is blocked
      const dependents = await tx.issueLink.findMany({ where: { sourceId: issue.id, type: { in: ["BLOCKS", "DEPENDS_ON"] } }, include: { target: { select: { assigneeId: true, key: true } } } });
      for (const d of dependents) await notify({ userIds: [d.target.assigneeId], kind: "dependency_blocked", title: `Dependency ${issue.key} is blocked`, body: `${d.target.key} depends on it`, link: `/issues/${issue.key}`, dedupeKey: `blocked:${issue.id}:${d.targetId}:${Date.now() / 86400000 | 0}` }, tx);
    }
    return updated;
  });
}

function pickAllowed(p: Prisma.IssueUncheckedUpdateInput) {
  const allowed = ["resolution", "assigneeId", "remainingEstimateMin", "fixVersionId"] as const;
  return Object.fromEntries(Object.entries(p).filter(([k]) => (allowed as readonly string[]).includes(k)));
}

export async function addComment(ctx: Ctx, idOrKey: string, text: string) {
  requirePermission(ctx, "issue:comment");
  const issue = await loadIssue(ctx, idOrKey);
  await assertProjectContributor(ctx, issue.projectId);
  const mentioned = await resolveMentions(ctx.workspaceId, text);
  return prisma.$transaction(async (tx) => {
    const c = await tx.issueComment.create({ data: { issueId: issue.id, authorId: ctx.user.id, body: text } });
    await tx.issueHistory.create({ data: { issueId: issue.id, userId: ctx.user.id, field: "comment", toValue: text.slice(0, 120) } });
    await notify({ userIds: mentioned, excludeUserId: ctx.user.id, kind: "mention", title: `${ctx.user.name} mentioned you on ${issue.key}`, body: text.slice(0, 200), link: `/issues/${issue.key}`, dedupeKey: `mention:${c.id}` }, tx);
    const watchers = await tx.issueWatcher.findMany({ where: { issueId: issue.id } });
    await notify({ userIds: [...watchers.map((w) => w.userId), issue.assigneeId].filter((u) => u && !mentioned.includes(u)), excludeUserId: ctx.user.id, kind: "comment", title: `New comment on ${issue.key}`, body: text.slice(0, 200), link: `/issues/${issue.key}`, dedupeKey: `comment:${c.id}` }, tx);
    return c;
  });
}

export async function logWork(ctx: Ctx, idOrKey: string, input: { minutes: number; workDate: Date; note?: string; remainingEstimateMin?: number }) {
  requirePermission(ctx, "issue:comment");
  const issue = await loadIssue(ctx, idOrKey);
  await assertProjectContributor(ctx, issue.projectId);
  return prisma.$transaction(async (tx) => {
    const w = await tx.workLog.create({ data: { issueId: issue.id, userId: ctx.user.id, minutes: input.minutes, workDate: input.workDate, note: input.note } });
    const remaining = input.remainingEstimateMin ?? Math.max(0, (issue.remainingEstimateMin ?? 0) - input.minutes);
    await tx.issue.update({ where: { id: issue.id }, data: { timeSpentMin: { increment: input.minutes }, remainingEstimateMin: remaining } });
    await tx.issueHistory.create({ data: { issueId: issue.id, userId: ctx.user.id, field: "worklog", toValue: `${input.minutes}m` } });
    return w;
  });
}

export async function linkIssues(ctx: Ctx, sourceKey: string, targetKey: string, type: (typeof LINK_TYPES)[number]) {
  requirePermission(ctx, "issue:edit");
  const source = await loadIssue(ctx, sourceKey);
  const target = await loadIssue(ctx, targetKey);
  await assertProjectContributor(ctx, source.projectId);
  if (type === "BLOCKS" || type === "DEPENDS_ON") {
    const edges = (await prisma.issueLink.findMany({ where: { type: { in: ["BLOCKS", "DEPENDS_ON"] } }, select: { sourceId: true, targetId: true } })).map((e) => ({ from: e.sourceId, to: e.targetId }));
    if (wouldCreateCycle(edges, source.id, target.id)) throw conflict("This link would create a circular dependency");
  } else if (source.id === target.id) throw badRequest("Cannot link an issue to itself");
  return prisma.$transaction(async (tx) => {
    const l = await tx.issueLink.create({ data: { sourceId: source.id, targetId: target.id, type } });
    await tx.issueHistory.createMany({ data: [
      { issueId: source.id, userId: ctx.user.id, field: "link", toValue: `${type} ${target.key}` },
      { issueId: target.id, userId: ctx.user.id, field: "link", toValue: `${type} (inward) ${source.key}` },
    ] });
    return l;
  });
}

export async function softDeleteIssue(ctx: Ctx, idOrKey: string, restore = false) {
  requirePermission(ctx, "issue:delete");
  const issue = await loadIssue(ctx, idOrKey);
  await assertProjectContributor(ctx, issue.projectId);
  return prisma.$transaction(async (tx) => {
    const u = await tx.issue.update({ where: { id: issue.id }, data: { deletedAt: restore ? null : new Date() } });
    await tx.issueHistory.create({ data: { issueId: issue.id, userId: ctx.user.id, field: restore ? "restored" : "deleted" } });
    await audit({ workspaceId: ctx.workspaceId, userId: ctx.user.id, eventType: restore ? "issue.restored" : "issue.deleted", entityType: "Issue", entityId: issue.id, ip: ctx.ip }, tx);
    return u;
  });
}

export async function cloneIssue(ctx: Ctx, idOrKey: string) {
  const src = await loadIssue(ctx, idOrKey);
  return createIssue(ctx, src.projectId, {
    summary: `CLONE - ${src.summary}`.slice(0, 255), description: src.description ?? undefined, typeId: src.typeId,
    priority: src.priority as (typeof PRIORITIES)[number], assigneeId: src.assigneeId, parentId: src.parentId,
    storyPoints: src.storyPoints ? Number(src.storyPoints) : null, labels: src.labels, components: src.components,
    dueDate: src.dueDate, startDate: src.startDate,
  } as z.infer<typeof issueCreateSchema>);
}

/** Move to another project: new key in the target project; old key recorded in history (old keys never reused). */
export async function moveIssue(ctx: Ctx, idOrKey: string, targetProject: string) {
  requirePermission(ctx, "issue:edit");
  const issue = await loadIssue(ctx, idOrKey);
  await assertProjectContributor(ctx, issue.projectId);
  const dest = await loadProject(ctx, targetProject);
  await assertProjectContributor(ctx, dest.id);
  if (dest.id === issue.projectId) throw badRequest("Issue is already in that project");
  const destWf = await ensureWorkflow(dest.id);
  const curStatus = await prisma.workflowStatus.findUniqueOrThrow({ where: { id: issue.statusId } });
  const mapped = await prisma.workflowStatus.findFirst({ where: { workflowId: destWf, name: curStatus.name } })
    ?? await prisma.workflowStatus.findFirstOrThrow({ where: { workflowId: destWf, isInitial: true } });
  return prisma.$transaction(async (tx) => {
    const { issueCounter } = await tx.project.update({ where: { id: dest.id }, data: { issueCounter: { increment: 1 } }, select: { issueCounter: true } });
    // The old key would be lost from the unique index; keep a tombstone record via history + audit.
    const u = await tx.issue.update({ where: { id: issue.id }, data: { projectId: dest.id, number: issueCounter, key: `${dest.key}-${issueCounter}`, statusId: mapped.id, sprintId: null, parentId: null, fixVersionId: null } });
    await tx.issueHistory.create({ data: { issueId: issue.id, userId: ctx.user.id, field: "moved", fromValue: issue.key, toValue: u.key } });
    await audit({ workspaceId: ctx.workspaceId, userId: ctx.user.id, eventType: "issue.moved", entityType: "Issue", entityId: issue.id, before: { key: issue.key }, after: { key: u.key }, ip: ctx.ip }, tx);
    return u;
  });
}

export async function getIssueDetail(ctx: Ctx, idOrKey: string) {
  const base = await loadIssue(ctx, idOrKey);
  const issue = await prisma.issue.findUniqueOrThrow({
    where: { id: base.id },
    include: {
      project: { select: { id: true, key: true, name: true, archivedAt: true } }, type: true, status: true,
      assignee: { select: { id: true, name: true, email: true } }, reporter: { select: { id: true, name: true } },
      parent: { select: { id: true, key: true, summary: true } },
      children: { where: { deletedAt: null }, include: { status: true, type: true, assignee: { select: { name: true } } }, orderBy: { number: "asc" } },
      sprint: { select: { id: true, name: true, state: true } }, fixVersion: true,
      comments: { where: { deletedAt: null }, include: { author: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" } },
      history: { orderBy: { createdAt: "desc" }, take: 200 },
      workLogs: { include: { user: { select: { name: true } } }, orderBy: { workDate: "desc" } },
      attachments: { orderBy: { createdAt: "desc" } },
      watchers: { include: { user: { select: { id: true, name: true } } } },
      linksOut: { include: { target: { select: { id: true, key: true, summary: true, status: true } } } },
      linksIn: { include: { source: { select: { id: true, key: true, summary: true, status: true } } } },
    },
  });
  const userIds = [...new Set(issue.history.map((h) => h.userId))];
  const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } });
  const transitions = await availableTransitions(issue.id);
  return { issue, historyUsers: Object.fromEntries(users.map((u) => [u.id, u.name])), transitions, canDelete: can(ctx, "issue:delete") };
}

export async function toggleWatch(ctx: Ctx, idOrKey: string) {
  const issue = await loadIssue(ctx, idOrKey);
  const existing = await prisma.issueWatcher.findUnique({ where: { issueId_userId: { issueId: issue.id, userId: ctx.user.id } } });
  if (existing) { await prisma.issueWatcher.delete({ where: { issueId_userId: { issueId: issue.id, userId: ctx.user.id } } }); return { watching: false }; }
  await prisma.issueWatcher.create({ data: { issueId: issue.id, userId: ctx.user.id } });
  return { watching: true };
}

export async function recordReview(ctx: Ctx, idOrKey: string, decision: "APPROVED" | "CHANGES_REQUESTED") {
  const issue = await loadIssue(ctx, idOrKey);
  if (issue.assigneeId === ctx.user.id && !ctx.permissions.includes("*")) throw forbidden("The assignee cannot review their own work");
  if (!can(ctx, "issue:transition")) throw forbidden();
  await prisma.issueHistory.create({ data: { issueId: issue.id, userId: ctx.user.id, field: "review", toValue: decision } });
  return { ok: true };
}

export { notFound };
