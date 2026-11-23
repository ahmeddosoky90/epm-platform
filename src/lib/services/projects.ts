import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db";
import { requirePermission, type Ctx } from "../auth";
import { audit } from "../audit";
import { badRequest, conflict, forbidden } from "../errors";
import { suggestProjectKey } from "../calc/workflow";
import { loadProject } from "./access";
import { createDefaultBoards } from "./bootstrap";
export { createDefaultBoards };

type Tx = Prisma.TransactionClient;
const optDate = z.string().regex(/^\d{4}-\d{2}-\d{2}/).nullable().optional().transform((v) => (v ? new Date(v) : v === null ? null : undefined));
const money = z.union([z.number(), z.string().regex(/^-?\d+(\.\d{1,2})?$/)]).transform((v) => new Prisma.Decimal(v));

export const projectCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  key: z.string().trim().toUpperCase().regex(/^[A-Z][A-Z0-9]{1,9}$/, "Key must be 2-10 letters/digits starting with a letter").optional(),
  description: z.string().max(10_000).optional(),
  type: z.string().max(60).optional(),
  category: z.string().max(60).optional(),
  methodology: z.enum(["AGILE", "WATERFALL", "HYBRID"]).default("HYBRID"),
  priority: z.enum(["Critical", "High", "Medium", "Low"]).default("Medium"),
  businessUnit: z.string().max(80).optional(),
  sponsor: z.string().max(120).optional(),
  businessOwner: z.string().max(120).optional(),
  classification: z.string().max(60).optional(),
  complexity: z.enum(["Low", "Medium", "High", "Very High"]).optional(),
  managerId: z.string().uuid().optional(),
  portfolioId: z.string().uuid().nullable().optional(),
  programId: z.string().uuid().nullable().optional(),
  templateId: z.string().uuid().optional(),
  startDate: optDate,
  plannedEndDate: optDate,
  currency: z.string().length(3).optional(),
  approvedBudget: money.optional(),
  capexBudget: money.optional(),
  opexBudget: money.optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
});
export const projectUpdateSchema = projectCreateSchema.omit({ key: true, templateId: true }).partial().extend({
  status: z.enum(["PROPOSED", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"]).optional(),
  health: z.enum(["GREEN", "AMBER", "RED"]).optional(),
  progress: z.number().int().min(0).max(100).optional(),
  actualStartDate: optDate,
  actualEndDate: optDate,
  lifecycleStageId: z.string().uuid().optional(),
});

async function uniqueKey(tx: Tx, workspaceId: string, base: string) {
  let key = base, n = 1;
  while (await tx.project.findUnique({ where: { workspaceId_key: { workspaceId, key } } })) key = `${base.slice(0, 8)}${++n}`;
  return key;
}

async function checkRefs(tx: Tx, ws: string, d: { portfolioId?: string | null; programId?: string | null; managerId?: string }) {
  if (d.portfolioId && !(await tx.portfolio.findFirst({ where: { id: d.portfolioId, workspaceId: ws } }))) throw badRequest("Unknown portfolio");
  if (d.programId) {
    const pg = await tx.program.findFirst({ where: { id: d.programId, workspaceId: ws } });
    if (!pg) throw badRequest("Unknown program");
    if (d.portfolioId && pg.portfolioId && pg.portfolioId !== d.portfolioId) throw badRequest("Program belongs to a different portfolio");
  }
  if (d.managerId && !(await tx.workspaceMember.findFirst({ where: { workspaceId: ws, userId: d.managerId } }))) throw badRequest("Project manager must be a workspace member");
}

export async function createProject(ctx: Ctx, input: z.infer<typeof projectCreateSchema>) {
  requirePermission(ctx, "project:create");
  if (input.startDate && input.plannedEndDate && input.plannedEndDate < input.startDate) throw badRequest("Planned end date is before start date");
  return prisma.$transaction(async (tx) => {
    await checkRefs(tx, ctx.workspaceId, input);
    let key = input.key;
    if (key) { if (await tx.project.findUnique({ where: { workspaceId_key: { workspaceId: ctx.workspaceId, key } } })) throw conflict(`Project key ${key} is already used`); }
    else key = await uniqueKey(tx, ctx.workspaceId, suggestProjectKey(input.name));
    const workflow = await tx.workflow.findFirst({ where: { workspaceId: ctx.workspaceId, isDefault: true } });
    const firstStage = await tx.lifecycleStage.findFirst({ where: { workspaceId: ctx.workspaceId }, orderBy: { sortOrder: "asc" } });
    const managerId = input.managerId ?? ctx.user.id;
    const { templateId, ...rest } = input;
    const project = await tx.project.create({
      data: {
        ...rest, key, workspaceId: ctx.workspaceId, managerId, ownerId: ctx.user.id,
        currency: input.currency ?? ctx.workspace.currency, tags: input.tags ?? [],
        workflowId: workflow?.id, lifecycleStageId: firstStage?.id, status: "PROPOSED",
        members: { create: [{ userId: managerId, projectRole: "Manager" }, ...(managerId !== ctx.user.id ? [{ userId: ctx.user.id, projectRole: "Manager" }] : [])] },
      },
    });
    // Default boards; columns map onto the workflow's statuses
    await createDefaultBoards(tx, project.id, workflow?.id ?? null, input.methodology);
    const stages = await tx.governanceStageDef.findMany({ where: { workspaceId: ctx.workspaceId } });
    await tx.projectGate.createMany({ data: stages.map((s) => ({ projectId: project.id, stageId: s.id })) });
    if (templateId) await applyTemplate(tx, ctx, project.id, templateId, input.startDate ?? new Date());
    await audit({ workspaceId: ctx.workspaceId, userId: ctx.user.id, eventType: "project.created", entityType: "Project", entityId: project.id, after: { key, name: project.name, templateId }, ip: ctx.ip }, tx);
    return project;
  });
}

async function applyTemplate(tx: Tx, ctx: Ctx, projectId: string, templateId: string, start: Date) {
  const t = await tx.projectTemplate.findFirst({ where: { id: templateId, workspaceId: ctx.workspaceId } });
  if (!t) throw badRequest("Unknown template");
  const def = t.definition as { milestones?: { name: string; offsetDays: number }[]; tasks?: { summary: string; type: string }[] };
  for (const m of def.milestones ?? []) {
    const due = new Date(start.getTime() + m.offsetDays * 86400000);
    await tx.milestone.create({ data: { projectId, name: m.name, dueDate: due, baselineDate: due } });
  }
  const p = await tx.project.findUniqueOrThrow({ where: { id: projectId } });
  const initial = await tx.workflowStatus.findFirst({ where: { workflowId: p.workflowId!, isInitial: true } });
  let counter = p.issueCounter;
  for (const task of def.tasks ?? []) {
    const type = await tx.issueType.findFirst({ where: { workspaceId: ctx.workspaceId, name: task.type } });
    if (!type || !initial) continue;
    counter++;
    await tx.issue.create({ data: { projectId, number: counter, key: `${p.key}-${counter}`, summary: task.summary, typeId: type.id, statusId: initial.id, reporterId: ctx.user.id, rank: counter * 1000 } });
  }
  await tx.project.update({ where: { id: projectId }, data: { issueCounter: counter, methodology: p.methodology ?? t.methodology } });
}

export async function updateProject(ctx: Ctx, idOrKey: string, patch: z.infer<typeof projectUpdateSchema>) {
  const p = await loadProject(ctx, idOrKey, { write: true });
  const touchesMoney = ["approvedBudget", "capexBudget", "opexBudget"].some((k) => k in patch);
  if (touchesMoney) requirePermission(ctx, "finance:edit");
  if (patch.lifecycleStageId) {
    const st = await prisma.lifecycleStage.findFirst({ where: { id: patch.lifecycleStageId, workspaceId: ctx.workspaceId } });
    if (!st) throw badRequest("Unknown lifecycle stage");
    if (st.requiresApproval && !ctx.permissions.includes("*") && !ctx.permissions.includes("governance:approve")) {
      throw forbidden(`Moving to "${st.name}" requires governance approval rights`);
    }
  }
  return prisma.$transaction(async (tx) => {
    await checkRefs(tx, ctx.workspaceId, { portfolioId: patch.portfolioId, programId: patch.programId, managerId: patch.managerId });
    const before: Record<string, unknown> = {};
    for (const k of Object.keys(patch)) before[k] = (p as Record<string, unknown>)[k];
    const u = await tx.project.update({ where: { id: p.id }, data: patch });
    if (patch.managerId) await tx.projectMember.upsert({ where: { projectId_userId: { projectId: p.id, userId: patch.managerId } }, create: { projectId: p.id, userId: patch.managerId, projectRole: "Manager" }, update: { projectRole: "Manager" } });
    await audit({ workspaceId: ctx.workspaceId, userId: ctx.user.id, eventType: touchesMoney ? "project.financials_updated" : "project.updated", entityType: "Project", entityId: p.id, before, after: patch, ip: ctx.ip }, tx);
    return u;
  });
}

export async function setArchived(ctx: Ctx, idOrKey: string, archived: boolean) {
  requirePermission(ctx, "project:archive");
  const p = await loadProject(ctx, idOrKey, { allowArchived: true });
  const u = await prisma.project.update({ where: { id: p.id }, data: { archivedAt: archived ? new Date() : null } });
  await audit({ workspaceId: ctx.workspaceId, userId: ctx.user.id, eventType: archived ? "project.archived" : "project.restored", entityType: "Project", entityId: p.id, ip: ctx.ip });
  return u;
}
