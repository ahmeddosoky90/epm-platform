import { z } from "zod";
import { prisma } from "../db";
import { requirePermission, type Ctx } from "../auth";
import { audit } from "../audit";
import { badRequest, notFound } from "../errors";
import { D } from "../calc/money";
import { criticalPath, linkCreatesCycle, rollUp } from "../calc/schedule";
import { parseMspdi, parentsByOutline, buildMspdi, MspdiError } from "../msproject/mspdi";
import { loadProject } from "./access";

const DAY = 86400000;
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}/).transform((v) => new Date(v.slice(0, 10) + "T00:00:00Z"));

export const taskSchema = z.object({
  name: z.string().trim().min(1).max(300), parentId: z.string().uuid().nullable().optional(), start: day, finish: day,
  percentComplete: z.number().int().min(0).max(100).default(0), isMilestone: z.boolean().default(false), resourceNames: z.array(z.string().max(80)).max(20).default([]),
  workHours: z.number().min(0).max(100000).optional(), afterTaskId: z.string().uuid().optional(),
}).refine((t) => t.finish >= t.start, { message: "Finish is before start", path: ["finish"] });
export const taskPatchSchema = z.object({
  name: z.string().trim().min(1).max(300).optional(), start: day.optional(), finish: day.optional(), percentComplete: z.number().int().min(0).max(100).optional(),
  isMilestone: z.boolean().optional(), resourceNames: z.array(z.string().max(80)).max(20).optional(), workHours: z.number().min(0).max(100000).optional(), parentId: z.string().uuid().nullable().optional(),
});
export const depSchema = z.object({ predecessorId: z.string().uuid(), type: z.enum(["FS", "SS", "FF", "SF"]).default("FS"), lagDays: z.number().min(-365).max(365).default(0) });

async function editable(ctx: Ctx, projectKey: string) {
  const p = await loadProject(ctx, projectKey, { write: true });
  requirePermission(ctx, "plan:edit");
  return p;
}

async function loadTask(ctx: Ctx, taskId: string) {
  const t = await prisma.planTask.findUnique({ where: { id: taskId }, include: { project: true } });
  if (!t) throw notFound("Task");
  await editable(ctx, t.project.id);
  return t;
}

/** Plan with CPM results, roll-ups, baselines and variance. Read access = project visibility. */
export async function getPlan(ctx: Ctx, projectKey: string) {
  const p = await loadProject(ctx, projectKey, { allowArchived: true });
  const [raw, deps, baselines] = await Promise.all([
    prisma.planTask.findMany({ where: { projectId: p.id }, orderBy: { sortOrder: "asc" } }),
    prisma.taskDependency.findMany({ where: { predecessor: { projectId: p.id } } }),
    prisma.baseline.findMany({ where: { projectId: p.id }, orderBy: { createdAt: "desc" }, select: { id: true, name: true, createdAt: true } }),
  ]);
  const hasKids = new Set(raw.filter((t) => t.parentId).map((t) => t.parentId!));
  const tasks = rollUp(raw.map((t) => ({ ...t, isSummary: t.isSummary || hasKids.has(t.id) })));
  const cpm = tasks.length ? criticalPath(tasks, deps.map((d) => ({ ...d, lagDays: Number(d.lagDays) }))) : new Map();
  const now = Date.now();
  const out = tasks.map((t) => {
    const c = cpm.get(t.id);
    const slipDays = t.baselineFinish ? Math.round((t.finish.getTime() - t.baselineFinish.getTime()) / DAY) : null;
    const expected = t.finish.getTime() <= now ? 100 : t.start.getTime() >= now ? 0 : Math.round(((now - t.start.getTime()) / Math.max(1, t.finish.getTime() - t.start.getTime())) * 100);
    return { ...t, durationDays: Number(t.durationDays), workHours: Number(t.workHours), critical: !!c?.critical, totalFloat: c?.totalFloat ?? null, slipDays, behind: !t.isSummary && t.percentComplete + 10 < expected };
  });
  return { project: p, tasks: out, deps: deps.map((d) => ({ ...d, lagDays: Number(d.lagDays) })), baselines };
}

export async function createTask(ctx: Ctx, projectKey: string, b: z.infer<typeof taskSchema>) {
  const p = await editable(ctx, projectKey);
  let parent = null;
  if (b.parentId) { parent = await prisma.planTask.findFirst({ where: { id: b.parentId, projectId: p.id } }); if (!parent) throw badRequest("Unknown parent task"); }
  const last = await prisma.planTask.aggregate({ where: { projectId: p.id }, _max: { sortOrder: true } });
  let sortOrder = (last._max.sortOrder ?? 0) + 10;
  if (b.afterTaskId) {
    const after = await prisma.planTask.findFirst({ where: { id: b.afterTaskId, projectId: p.id } });
    if (after) { sortOrder = after.sortOrder + 1; await prisma.planTask.updateMany({ where: { projectId: p.id, sortOrder: { gte: sortOrder } }, data: { sortOrder: { increment: 10 } } }); }
  }
  const siblings = await prisma.planTask.count({ where: { projectId: p.id, parentId: b.parentId ?? null } });
  const wbs = parent ? `${parent.wbs ?? "?"}.${siblings + 1}` : `${siblings + 1}`;
  const t = await prisma.planTask.create({ data: {
    projectId: p.id, parentId: b.parentId ?? null, name: b.name, start: b.start, finish: b.isMilestone ? b.start : b.finish, percentComplete: b.percentComplete,
    isMilestone: b.isMilestone, resourceNames: b.resourceNames, outlineLevel: (parent?.outlineLevel ?? 0) + 1, wbs, sortOrder,
    durationDays: D(Math.round((b.finish.getTime() - b.start.getTime()) / DAY)), workHours: D(b.workHours ?? 0),
  } });
  await audit({ workspaceId: ctx.workspaceId, userId: ctx.user.id, eventType: "plan.task_created", entityType: "Project", entityId: p.id, after: { task: t.name, wbs }, ip: ctx.ip });
  return t;
}

export async function updateTask(ctx: Ctx, taskId: string, b: z.infer<typeof taskPatchSchema>) {
  const t = await loadTask(ctx, taskId);
  const start = b.start ?? t.start, finish = b.finish ?? t.finish;
  if (finish < start) throw badRequest("Finish is before start");
  if (b.parentId) {
    if (b.parentId === t.id) throw badRequest("A task cannot be its own parent");
    const par = await prisma.planTask.findFirst({ where: { id: b.parentId, projectId: t.projectId } });
    if (!par) throw badRequest("Unknown parent task");
    for (let cur: typeof par | null = par; cur?.parentId; cur = await prisma.planTask.findUnique({ where: { id: cur.parentId } })) if (cur.parentId === t.id) throw badRequest("That would make the task its own ancestor");
  }
  const u = await prisma.planTask.update({ where: { id: taskId }, data: {
    ...b, ...(b.workHours !== undefined ? { workHours: D(b.workHours) } : {}),
    ...(b.start || b.finish ? { durationDays: D(Math.round((finish.getTime() - start.getTime()) / DAY)) } : {}),
  } });
  await audit({ workspaceId: ctx.workspaceId, userId: ctx.user.id, eventType: "plan.task_updated", entityType: "Project", entityId: t.projectId, before: { task: t.name, start: t.start, finish: t.finish, percentComplete: t.percentComplete }, after: b, ip: ctx.ip });
  return u;
}

export async function deleteTask(ctx: Ctx, taskId: string) {
  const t = await loadTask(ctx, taskId);
  await prisma.planTask.delete({ where: { id: taskId } }); // children & links cascade
  await audit({ workspaceId: ctx.workspaceId, userId: ctx.user.id, eventType: "plan.task_deleted", entityType: "Project", entityId: t.projectId, before: { task: t.name, wbs: t.wbs }, ip: ctx.ip });
}

export async function addDependency(ctx: Ctx, successorId: string, b: z.infer<typeof depSchema>) {
  const s = await loadTask(ctx, successorId);
  const pr = await prisma.planTask.findFirst({ where: { id: b.predecessorId, projectId: s.projectId } });
  if (!pr) throw badRequest("Predecessor must be in the same project");
  const links = await prisma.taskDependency.findMany({ where: { predecessor: { projectId: s.projectId } }, select: { predecessorId: true, successorId: true } });
  if (linkCreatesCycle(links, b.predecessorId, successorId)) throw badRequest("That link would create a circular dependency");
  const d = await prisma.taskDependency.upsert({ where: { predecessorId_successorId: { predecessorId: b.predecessorId, successorId } }, create: { ...b, successorId, lagDays: D(b.lagDays) }, update: { type: b.type, lagDays: D(b.lagDays) } });
  await audit({ workspaceId: ctx.workspaceId, userId: ctx.user.id, eventType: "plan.dependency_added", entityType: "Project", entityId: s.projectId, after: { from: pr.name, to: s.name, type: b.type, lag: b.lagDays }, ip: ctx.ip });
  return d;
}

export async function removeDependency(ctx: Ctx, successorId: string, depId: string) {
  const s = await loadTask(ctx, successorId);
  const d = await prisma.taskDependency.findFirst({ where: { id: depId, successorId } });
  if (!d) throw notFound("Dependency");
  await prisma.taskDependency.delete({ where: { id: d.id } });
  await audit({ workspaceId: ctx.workspaceId, userId: ctx.user.id, eventType: "plan.dependency_removed", entityType: "Project", entityId: s.projectId, before: { predecessorId: d.predecessorId, type: d.type }, ip: ctx.ip });
}

/** Snapshot current dates as a named baseline and copy them into the tasks' baseline fields. */
export async function saveBaseline(ctx: Ctx, projectKey: string, name: string) {
  const p = await editable(ctx, projectKey);
  const tasks = await prisma.planTask.findMany({ where: { projectId: p.id } });
  return prisma.$transaction(async (tx) => {
    const b = await tx.baseline.create({ data: { projectId: p.id, name, createdById: ctx.user.id, snapshot: tasks.map((t) => ({ taskId: t.id, start: t.start, finish: t.finish })) } });
    for (const t of tasks) await tx.planTask.update({ where: { id: t.id }, data: { baselineStart: t.start, baselineFinish: t.finish } });
    await audit({ workspaceId: ctx.workspaceId, userId: ctx.user.id, eventType: "plan.baselined", entityType: "Project", entityId: p.id, after: { name, tasks: tasks.length }, ip: ctx.ip }, tx);
    return b;
  });
}

/** Import an MSPDI XML file. mode=replace clears the existing schedule; mode=merge updates by MS Project UID. */
export async function importMspdi(ctx: Ctx, projectKey: string, xml: string, fileName: string, mode: "replace" | "merge" = "replace") {
  const p = await editable(ctx, projectKey);
  let parsed;
  try { parsed = parseMspdi(xml); } catch (e) { if (e instanceof MspdiError) throw badRequest(e.message); throw badRequest("Could not read the XML file"); }
  const parents = parentsByOutline(parsed.tasks);
  return prisma.$transaction(async (tx) => {
    if (mode === "replace") await tx.planTask.deleteMany({ where: { projectId: p.id } });
    const existing = mode === "merge" ? await tx.planTask.findMany({ where: { projectId: p.id, externalUid: { not: null } } }) : [];
    const idByUid = new Map(existing.map((t) => [t.externalUid!, t.id]));
    let created = 0, updated = 0;
    for (const [i, t] of parsed.tasks.entries()) {
      const data = {
        name: t.name, wbs: t.wbs, outlineLevel: t.outlineLevel, start: t.start, finish: t.finish, durationDays: D(t.durationDays), percentComplete: Math.round(t.percentComplete),
        isMilestone: t.isMilestone, isSummary: t.isSummary, workHours: D(t.workHours), resourceNames: t.resourceNames, sortOrder: (i + 1) * 10,
        baselineStart: t.baselineStart, baselineFinish: t.baselineFinish, parentId: null as string | null,
      };
      const id = idByUid.get(t.uid);
      if (id) { await tx.planTask.update({ where: { id }, data }); updated++; }
      else { idByUid.set(t.uid, (await tx.planTask.create({ data: { ...data, projectId: p.id, externalUid: t.uid } })).id); created++; }
    }
    for (const t of parsed.tasks) { const par = parents.get(t.uid); if (par) await tx.planTask.update({ where: { id: idByUid.get(t.uid)! }, data: { parentId: idByUid.get(par)! } }); }
    const ids = [...idByUid.values()];
    await tx.taskDependency.deleteMany({ where: { successorId: { in: ids } } });
    await tx.taskDependency.createMany({ data: parsed.links.map((l) => ({ predecessorId: idByUid.get(l.predecessorUid)!, successorId: idByUid.get(l.successorUid)!, type: l.type, lagDays: D(l.lagDays) })), skipDuplicates: true });
    // Milestones from the plan feed the project milestone list (used by roadmap & governance)
    for (const m of parsed.tasks.filter((t) => t.isMilestone)) {
      const ex = await tx.milestone.findFirst({ where: { projectId: p.id, name: m.name } });
      if (ex) await tx.milestone.update({ where: { id: ex.id }, data: { dueDate: m.finish } });
      else await tx.milestone.create({ data: { projectId: p.id, name: m.name, dueDate: m.finish, baselineDate: m.baselineFinish ?? m.finish, completedAt: m.percentComplete >= 100 ? m.finish : null, status: m.percentComplete >= 100 ? "DONE" : "PLANNED" } });
    }
    await audit({ workspaceId: ctx.workspaceId, userId: ctx.user.id, eventType: "plan.imported", entityType: "Project", entityId: p.id, after: { fileName, mode, tasks: parsed.tasks.length, links: parsed.links.length, created, updated, warnings: parsed.warnings }, ip: ctx.ip }, tx);
    return { tasks: parsed.tasks.length, links: parsed.links.length, created, updated, warnings: parsed.warnings, projectName: parsed.name };
  }, { timeout: 60000 });
}

export async function exportMspdi(ctx: Ctx, projectKey: string) {
  const { project, tasks, deps } = await getPlan(ctx, projectKey);
  const uid = new Map(tasks.map((t, i) => [t.id, i + 1]));
  return { name: project.key, xml: buildMspdi({ name: project.name, start: project.startDate }, tasks.map((t) => ({
    uid: uid.get(t.id)!, name: t.name, wbs: t.wbs, outlineLevel: t.outlineLevel, start: t.start, finish: t.finish, durationDays: t.durationDays, percentComplete: t.percentComplete,
    isMilestone: t.isMilestone, isSummary: t.isSummary, workHours: t.workHours, baselineStart: t.baselineStart, baselineFinish: t.baselineFinish,
    preds: deps.filter((d) => d.successorId === t.id).map((d) => ({ uid: uid.get(d.predecessorId)!, type: d.type, lagDays: d.lagDays })),
  }))) };
}
