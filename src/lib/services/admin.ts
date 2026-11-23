import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { can, hashPassword, requirePermission, validatePassword, type Ctx } from "../auth";
import { audit } from "../audit";
import { badRequest, conflict, forbidden, notFound } from "../errors";
import { randomToken, sha256 } from "../crypto";
import { mailConfigured, sendMail } from "../integrations/mail";
import { PERMISSIONS } from "../rbac/permissions";

const isSuper = (ctx: Ctx) => ctx.permissions.includes("*");
const PERM_KEYS = ["*", ...Object.keys(PERMISSIONS)] as [string, ...string[]];

// ───────── Users ─────────
export const userCreateSchema = z.object({
  email: z.string().trim().toLowerCase().email(), name: z.string().trim().min(2).max(120), jobTitle: z.string().max(80).optional(),
  roleId: z.string().uuid(), departmentId: z.string().uuid().nullable().optional(), password: z.string().max(200).optional(),
});

async function assertRoleAssignable(ctx: Ctx, roleId: string) {
  const role = await prisma.role.findFirst({ where: { id: roleId, OR: [{ workspaceId: ctx.workspaceId }, { workspaceId: null }] } });
  if (!role) throw badRequest("Unknown role");
  // Nobody can hand out more power than they hold
  if (role.permissions.includes("*") && !isSuper(ctx)) throw forbidden("Only a super user can assign a super-user role");
  if (!isSuper(ctx) && role.permissions.some((p) => !ctx.permissions.includes(p))) throw forbidden("You cannot assign a role with permissions you do not have");
  return role;
}

async function issueResetLink(userId: string, email: string, hours = 72) {
  const token = randomToken();
  await prisma.passwordResetToken.create({ data: { id: sha256(token), userId, expiresAt: new Date(Date.now() + hours * 3600_000) } });
  const link = `${process.env.APP_URL ?? ""}/reset?token=${token}`;
  let emailed = false;
  if (mailConfigured()) { try { await sendMail({ to: email, subject: "Set your Lumen PMO password", text: `An administrator created or reset your account. Set your password within ${hours} hours: ${link}` }); emailed = true; } catch { emailed = false; } }
  return { link: emailed ? null : link, emailed };
}

export async function createUser(ctx: Ctx, b: z.infer<typeof userCreateSchema>) {
  requirePermission(ctx, "admin:users");
  await assertRoleAssignable(ctx, b.roleId);
  if (b.password) { const e = validatePassword(b.password); if (e.length) throw badRequest(`Password needs: ${e.join(", ")}`); }
  const existing = await prisma.user.findUnique({ where: { email: b.email } });
  if (existing && (await prisma.workspaceMember.findFirst({ where: { userId: existing.id, workspaceId: ctx.workspaceId } }))) throw conflict("That person is already a member of this workspace");
  const user = existing ?? await prisma.user.create({ data: { email: b.email, name: b.name, jobTitle: b.jobTitle, departmentId: b.departmentId ?? null, passwordHash: await hashPassword(b.password ?? randomToken()) } });
  await prisma.workspaceMember.create({ data: { workspaceId: ctx.workspaceId, userId: user.id, roleId: b.roleId } });
  const invite = existing || b.password ? { link: null, emailed: false } : await issueResetLink(user.id, user.email);
  await audit({ workspaceId: ctx.workspaceId, userId: ctx.user.id, eventType: existing ? "user.added_to_workspace" : "user.created", entityType: "User", entityId: user.id, after: { email: b.email, roleId: b.roleId }, ip: ctx.ip });
  return { user: { id: user.id, email: user.email, name: user.name }, invite };
}

export const userPatchSchema = z.object({ roleId: z.string().uuid().optional(), isActive: z.boolean().optional(), unlock: z.boolean().optional(), name: z.string().trim().min(2).max(120).optional(), jobTitle: z.string().max(80).nullable().optional(), departmentId: z.string().uuid().nullable().optional(), resetLink: z.boolean().optional(), revokeSessions: z.boolean().optional() });

export async function updateUser(ctx: Ctx, userId: string, b: z.infer<typeof userPatchSchema>) {
  requirePermission(ctx, "admin:users");
  const m = await prisma.workspaceMember.findFirst({ where: { userId, workspaceId: ctx.workspaceId }, include: { role: true, user: true } });
  if (!m) throw notFound("User");
  if (m.role.permissions.includes("*") && !isSuper(ctx)) throw forbidden("Only a super user can change a super user");
  if (userId === ctx.user.id && (b.isActive === false || b.roleId)) throw badRequest("You cannot deactivate yourself or change your own role");
  if (b.roleId) {
    await assertRoleAssignable(ctx, b.roleId);
    if (m.role.permissions.includes("*")) {
      const supers = await prisma.workspaceMember.count({ where: { workspaceId: ctx.workspaceId, role: { permissions: { has: "*" } }, user: { isActive: true } } });
      if (supers <= 1) throw badRequest("This is the last super user in the workspace");
    }
    await prisma.workspaceMember.update({ where: { id: m.id }, data: { roleId: b.roleId } });
  }
  const data: Prisma.UserUpdateInput = {};
  if (b.isActive !== undefined) data.isActive = b.isActive;
  if (b.unlock) { data.failedLogins = 0; data.lockedUntil = null; }
  if (b.name) data.name = b.name;
  if (b.jobTitle !== undefined) data.jobTitle = b.jobTitle;
  if (b.departmentId !== undefined) data.department = b.departmentId ? { connect: { id: b.departmentId } } : { disconnect: true };
  if (Object.keys(data).length) await prisma.user.update({ where: { id: userId }, data });
  if (b.isActive === false || b.revokeSessions || b.roleId) await prisma.session.deleteMany({ where: { userId } });
  const invite = b.resetLink ? await issueResetLink(userId, m.user.email, 24) : undefined;
  await audit({ workspaceId: ctx.workspaceId, userId: ctx.user.id, eventType: b.roleId ? "user.role_changed" : b.isActive === false ? "user.deactivated" : b.isActive ? "user.reactivated" : b.resetLink ? "user.reset_link_issued" : "user.updated", entityType: "User", entityId: userId, before: { roleId: m.roleId, isActive: m.user.isActive }, after: { ...b, resetLink: undefined }, ip: ctx.ip });
  return { ok: true, invite };
}

// ───────── Roles ─────────
export const roleSchema = z.object({ name: z.string().trim().min(2).max(60), description: z.string().max(300).optional(), permissions: z.array(z.enum(PERM_KEYS)).max(60) });

export async function createRole(ctx: Ctx, b: z.infer<typeof roleSchema>) {
  requirePermission(ctx, "admin:roles");
  if (b.permissions.includes("*") && !isSuper(ctx)) throw forbidden("Only a super user can create a super-user role");
  const key = b.name.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);
  if (await prisma.role.findFirst({ where: { workspaceId: ctx.workspaceId, key } })) throw conflict("A role with that name exists");
  const r = await prisma.role.create({ data: { ...b, key, workspaceId: ctx.workspaceId, isSystem: false } });
  await audit({ workspaceId: ctx.workspaceId, userId: ctx.user.id, eventType: "role.created", entityType: "Role", entityId: r.id, after: b, ip: ctx.ip });
  return r;
}

export async function updateRole(ctx: Ctx, id: string, b: Partial<z.infer<typeof roleSchema>>) {
  requirePermission(ctx, "admin:roles");
  const r = await prisma.role.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!r) throw notFound("Role");
  if (r.permissions.includes("*") || b.permissions?.includes("*")) { if (!isSuper(ctx)) throw forbidden("Only a super user can change super-user roles"); if (r.isSystem && b.permissions && !b.permissions.includes("*")) throw badRequest("The super-user role must keep full access"); }
  const u = await prisma.role.update({ where: { id }, data: b });
  if (b.permissions) await prisma.session.deleteMany({ where: { workspaceId: ctx.workspaceId, user: { memberships: { some: { roleId: id, workspaceId: ctx.workspaceId } } }, NOT: { id: ctx.sessionId } } });
  await audit({ workspaceId: ctx.workspaceId, userId: ctx.user.id, eventType: "role.updated", entityType: "Role", entityId: id, before: { name: r.name, permissions: r.permissions }, after: b, ip: ctx.ip });
  return u;
}

export async function deleteRole(ctx: Ctx, id: string) {
  requirePermission(ctx, "admin:roles");
  const r = await prisma.role.findFirst({ where: { id, workspaceId: ctx.workspaceId }, include: { _count: { select: { members: true } } } });
  if (!r) throw notFound("Role");
  if (r.isSystem) throw badRequest("System roles cannot be deleted");
  if (r._count.members) throw badRequest(`${r._count.members} user(s) still have this role`);
  await prisma.role.delete({ where: { id } });
  await audit({ workspaceId: ctx.workspaceId, userId: ctx.user.id, eventType: "role.deleted", entityType: "Role", entityId: id, before: { name: r.name, permissions: r.permissions }, ip: ctx.ip });
}

// ───────── Workflows (each change bumps the version and is audited with a snapshot) ─────────
export const workflowOpSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("addStatus"), name: z.string().trim().min(1).max(40), category: z.enum(["TODO", "IN_PROGRESS", "DONE"]), color: z.string().regex(/^#[0-9a-f]{6}$/i) }),
  z.object({ op: z.literal("updateStatus"), id: z.string().uuid(), name: z.string().trim().min(1).max(40).optional(), category: z.enum(["TODO", "IN_PROGRESS", "DONE"]).optional(), color: z.string().regex(/^#[0-9a-f]{6}$/i).optional(), isInitial: z.boolean().optional() }),
  z.object({ op: z.literal("deleteStatus"), id: z.string().uuid() }),
  z.object({ op: z.literal("addTransition"), name: z.string().trim().min(1).max(60), fromStatusId: z.string().uuid().nullable(), toStatusId: z.string().uuid() }),
  z.object({ op: z.literal("updateTransition"), id: z.string().uuid(), name: z.string().trim().min(1).max(60).optional(), allowedRoles: z.array(z.string()).optional(), requiredFields: z.array(z.enum(["assigneeId", "resolution", "storyPoints", "dueDate", "fixVersionId", "originalEstimateMin"])).optional(),
    conditions: z.object({ noOpenBlockers: z.boolean().optional(), assigneeOnly: z.boolean().optional(), requireApproval: z.boolean().optional() }).optional(), postFunctions: z.object({ setResolution: z.string().max(40).nullable().optional(), clearResolution: z.boolean().optional(), assignToReporter: z.boolean().optional() }).optional() }),
  z.object({ op: z.literal("deleteTransition"), id: z.string().uuid() }),
  z.object({ op: z.literal("rename"), name: z.string().trim().min(2).max(80), description: z.string().max(300).optional() }),
]);

export async function workflowDetail(ctx: Ctx, id: string) {
  requirePermission(ctx, "admin:workflows");
  const wf = await prisma.workflow.findFirst({ where: { id, workspaceId: ctx.workspaceId }, include: { statuses: { orderBy: { sortOrder: "asc" } }, transitions: true, projects: { select: { key: true } } } });
  if (!wf) throw notFound("Workflow");
  return wf;
}

export async function changeWorkflow(ctx: Ctx, id: string, op: z.infer<typeof workflowOpSchema>) {
  const wf = await workflowDetail(ctx, id);
  const own = (sid: string | null) => { if (sid && !wf.statuses.some((s) => s.id === sid)) throw badRequest("Status does not belong to this workflow"); };
  await prisma.$transaction(async (tx) => {
    switch (op.op) {
      case "addStatus": await tx.workflowStatus.create({ data: { workflowId: id, name: op.name, category: op.category, color: op.color, sortOrder: wf.statuses.length } }); break;
      case "updateStatus": {
        own(op.id);
        if (op.isInitial) await tx.workflowStatus.updateMany({ where: { workflowId: id }, data: { isInitial: false } });
        const { op: _o, id: sid, ...d } = op; void _o; await tx.workflowStatus.update({ where: { id: sid }, data: d }); break;
      }
      case "deleteStatus": {
        own(op.id);
        const used = await tx.issue.count({ where: { statusId: op.id } });
        if (used) throw badRequest(`${used} issue(s) are in this status. Move them first.`);
        if (wf.statuses.find((s) => s.id === op.id)?.isInitial) throw badRequest("Choose another initial status first");
        await tx.workflowStatus.delete({ where: { id: op.id } }); break;
      }
      case "addTransition": own(op.fromStatusId); own(op.toStatusId); await tx.workflowTransition.create({ data: { workflowId: id, name: op.name, fromStatusId: op.fromStatusId, toStatusId: op.toStatusId, allowedRoles: [], requiredFields: [] } }); break;
      case "updateTransition": {
        if (!wf.transitions.some((t) => t.id === op.id)) throw badRequest("Transition does not belong to this workflow");
        const { op: _o, id: tid, ...d } = op; void _o; await tx.workflowTransition.update({ where: { id: tid }, data: d as Prisma.WorkflowTransitionUpdateInput }); break;
      }
      case "deleteTransition": if (!wf.transitions.some((t) => t.id === op.id)) throw badRequest("Transition does not belong to this workflow"); await tx.workflowTransition.delete({ where: { id: op.id } }); break;
      case "rename": await tx.workflow.update({ where: { id }, data: { name: op.name, description: op.description } }); break;
    }
    if (!(await tx.workflowStatus.count({ where: { workflowId: id, isInitial: true } }))) throw badRequest("A workflow needs an initial status");
    await tx.workflow.update({ where: { id }, data: { version: { increment: 1 } } });
    await audit({ workspaceId: ctx.workspaceId, userId: ctx.user.id, eventType: "workflow.changed", entityType: "Workflow", entityId: id, before: { version: wf.version, statuses: wf.statuses.map((s) => s.name), transitions: wf.transitions.length }, after: op, ip: ctx.ip }, tx);
  });
  return workflowDetail(ctx, id);
}

// ───────── Workspace configuration ─────────
export const settingsSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(), description: z.string().max(500).nullable().optional(), timezone: z.string().max(60).optional(), currency: z.string().length(3).toUpperCase().optional(),
  fiscalYearStartMonth: z.number().int().min(1).max(12).optional(), workingDays: z.array(z.number().int().min(0).max(6)).min(1).max(7).optional(), hoursPerDay: z.number().min(1).max(24).optional(),
});
export async function updateSettings(ctx: Ctx, b: z.infer<typeof settingsSchema>) {
  requirePermission(ctx, "admin:workspace");
  if (b.timezone) { try { new Intl.DateTimeFormat("en", { timeZone: b.timezone }); } catch { throw badRequest("Unknown time zone"); } }
  const before = await prisma.workspace.findUniqueOrThrow({ where: { id: ctx.workspaceId } });
  const w = await prisma.workspace.update({ where: { id: ctx.workspaceId }, data: { ...b, ...(b.hoursPerDay !== undefined ? { hoursPerDay: new Prisma.Decimal(b.hoursPerDay) } : {}) } });
  await audit({ workspaceId: ctx.workspaceId, userId: ctx.user.id, eventType: "workspace.settings_changed", entityType: "Workspace", entityId: ctx.workspaceId, before: Object.fromEntries(Object.keys(b).map((k) => [k, (before as Record<string, unknown>)[k]])), after: b, ip: ctx.ip });
  return w;
}

/** One endpoint for the small configuration lists, each with its own validation and permission. */
export const configSchema = z.discriminatedUnion("entity", [
  z.object({ entity: z.literal("holiday"), action: z.enum(["create", "delete"]), id: z.string().uuid().optional(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), name: z.string().max(80).optional() }),
  z.object({ entity: z.literal("exchangeRate"), action: z.enum(["create", "delete"]), id: z.string().uuid().optional(), currency: z.string().length(3).toUpperCase().optional(), rateToBase: z.string().regex(/^\d+(\.\d{1,6})?$/).optional(), effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }),
  z.object({ entity: z.literal("lifecycleStage"), action: z.enum(["create", "update", "delete"]), id: z.string().uuid().optional(), name: z.string().max(60).optional(), requiresApproval: z.boolean().optional(), sortOrder: z.number().int().optional() }),
  z.object({ entity: z.literal("gate"), action: z.enum(["create", "update", "delete"]), id: z.string().uuid().optional(), name: z.string().max(80).optional(), checklist: z.array(z.string().max(120)).max(30).optional(), approverRoles: z.array(z.string().max(40)).max(8).optional(), validityDays: z.number().int().min(1).max(3650).nullable().optional() }),
  z.object({ entity: z.literal("criterion"), action: z.enum(["create", "update", "delete"]), id: z.string().uuid().optional(), name: z.string().max(60).optional(), weight: z.number().min(0).max(100).optional() }),
  z.object({ entity: z.literal("issueType"), action: z.enum(["create", "update", "delete"]), id: z.string().uuid().optional(), name: z.string().max(40).optional(), color: z.string().regex(/^#[0-9a-f]{6}$/i).optional(), level: z.coerce.number().int().min(1).max(3).optional(), icon: z.string().max(30).optional() }),
  z.object({ entity: z.literal("customField"), action: z.enum(["create", "update", "delete"]), id: z.string().uuid().optional(), name: z.string().max(60).optional(), fieldType: z.enum(["TEXT", "NUMBER", "DATE", "SELECT", "MULTISELECT", "CHECKBOX", "USER", "URL", "CURRENCY", "PERCENT"]).optional(), required: z.boolean().optional(), issueTypeIds: z.array(z.string().uuid()).optional(), options: z.array(z.string().max(60)).max(50).optional() }),
  z.object({ entity: z.literal("department"), action: z.enum(["create", "update", "delete"]), id: z.string().uuid().optional(), name: z.string().max(80).optional(), costCenter: z.string().max(40).nullable().optional() }),
]);

export async function changeConfig(ctx: Ctx, c: z.infer<typeof configSchema>) {
  const ws = ctx.workspaceId;
  const need = (...k: string[]) => { for (const x of k) if ((c as Record<string, unknown>)[x] === undefined) throw badRequest(`${x} is required`); };
  const mine = async (model: { findFirst: (a: { where: { id: string; workspaceId: string } }) => Promise<unknown> }) => { need("id"); if (!(await model.findFirst({ where: { id: c.id!, workspaceId: ws } }))) throw notFound("Item"); };
  let result: unknown;
  if (["issueType", "customField"].includes(c.entity)) requirePermission(ctx, "admin:workflows"); else requirePermission(ctx, "admin:workspace");
  switch (c.entity) {
    case "holiday": if (c.action === "create") { need("date", "name"); result = await prisma.holiday.create({ data: { workspaceId: ws, date: new Date(c.date + "T00:00:00Z"), name: c.name! } }); } else { await mine(prisma.holiday); await prisma.holiday.delete({ where: { id: c.id } }); } break;
    case "exchangeRate": if (c.action === "create") { need("currency", "rateToBase", "effectiveDate"); result = await prisma.exchangeRate.upsert({ where: { workspaceId_currency_effectiveDate: { workspaceId: ws, currency: c.currency!, effectiveDate: new Date(c.effectiveDate + "T00:00:00Z") } }, create: { workspaceId: ws, currency: c.currency!, rateToBase: new Prisma.Decimal(c.rateToBase!), effectiveDate: new Date(c.effectiveDate + "T00:00:00Z") }, update: { rateToBase: new Prisma.Decimal(c.rateToBase!) } }); } else { await mine(prisma.exchangeRate); await prisma.exchangeRate.delete({ where: { id: c.id } }); } break;
    case "lifecycleStage":
      if (c.action === "create") { need("name"); result = await prisma.lifecycleStage.create({ data: { workspaceId: ws, name: c.name!, requiresApproval: !!c.requiresApproval, sortOrder: c.sortOrder ?? (await prisma.lifecycleStage.count({ where: { workspaceId: ws } })) } }); }
      else if (c.action === "update") { await mine(prisma.lifecycleStage); result = await prisma.lifecycleStage.update({ where: { id: c.id }, data: { name: c.name, requiresApproval: c.requiresApproval, sortOrder: c.sortOrder } }); }
      else { await mine(prisma.lifecycleStage); const n = await prisma.project.count({ where: { lifecycleStageId: c.id } }); if (n) throw badRequest(`${n} project(s) are in this stage`); await prisma.lifecycleStage.delete({ where: { id: c.id } }); }
      break;
    case "gate":
      if (c.action === "create") { need("name"); const g = await prisma.governanceStageDef.create({ data: { workspaceId: ws, name: c.name!, checklist: c.checklist ?? [], approverRoles: c.approverRoles ?? [], validityDays: c.validityDays ?? null, sortOrder: await prisma.governanceStageDef.count({ where: { workspaceId: ws } }) } });
        const projects = await prisma.project.findMany({ where: { workspaceId: ws, archivedAt: null }, select: { id: true } });
        await prisma.projectGate.createMany({ data: projects.map((p) => ({ projectId: p.id, stageId: g.id })), skipDuplicates: true }); result = g; }
      else if (c.action === "update") { await mine(prisma.governanceStageDef); result = await prisma.governanceStageDef.update({ where: { id: c.id }, data: { name: c.name, checklist: c.checklist, approverRoles: c.approverRoles, validityDays: c.validityDays } }); }
      else { await mine(prisma.governanceStageDef); const n = await prisma.projectGate.count({ where: { stageId: c.id, status: { not: "NOT_STARTED" } } }); if (n) throw badRequest(`${n} project gate(s) already used this definition`); await prisma.projectGate.deleteMany({ where: { stageId: c.id } }); await prisma.governanceStageDef.delete({ where: { id: c.id } }); }
      break;
    case "criterion":
      if (c.action === "create") { need("name", "weight"); result = await prisma.priorityCriterion.create({ data: { workspaceId: ws, name: c.name!, weight: c.weight!, sortOrder: await prisma.priorityCriterion.count({ where: { workspaceId: ws } }) } }); }
      else if (c.action === "update") { await mine(prisma.priorityCriterion); result = await prisma.priorityCriterion.update({ where: { id: c.id }, data: { name: c.name, weight: c.weight } }); }
      else { await mine(prisma.priorityCriterion); await prisma.priorityCriterion.delete({ where: { id: c.id } }); }
      break;
    case "issueType":
      if (c.action === "create") { need("name"); result = await prisma.issueType.create({ data: { workspaceId: ws, name: c.name!, color: c.color, level: c.level ?? 2, icon: c.icon } }); }
      else if (c.action === "update") { await mine(prisma.issueType); result = await prisma.issueType.update({ where: { id: c.id }, data: { name: c.name, color: c.color, level: c.level, icon: c.icon } }); }
      else { await mine(prisma.issueType); const t = await prisma.issueType.findUniqueOrThrow({ where: { id: c.id } }); if (t.isSystem) throw badRequest("Built-in issue types cannot be deleted"); const n = await prisma.issue.count({ where: { typeId: c.id } }); if (n) throw badRequest(`${n} issue(s) use this type`); await prisma.issueType.delete({ where: { id: c.id } }); }
      break;
    case "customField":
      if (c.action === "create") { need("name", "fieldType"); const key = "cf_" + c.name!.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 30); result = await prisma.customField.create({ data: { workspaceId: ws, key, name: c.name!, fieldType: c.fieldType!, required: !!c.required, issueTypeIds: c.issueTypeIds ?? [], options: c.options ?? [] } }); }
      else if (c.action === "update") { await mine(prisma.customField); result = await prisma.customField.update({ where: { id: c.id }, data: { name: c.name, required: c.required, issueTypeIds: c.issueTypeIds, options: c.options } }); }
      else { await mine(prisma.customField); await prisma.customField.delete({ where: { id: c.id } }); }
      break;
    case "department":
      if (c.action === "create") { need("name"); result = await prisma.department.create({ data: { workspaceId: ws, name: c.name!, costCenter: c.costCenter ?? null } }); }
      else if (c.action === "update") { await mine(prisma.department); result = await prisma.department.update({ where: { id: c.id }, data: { name: c.name, costCenter: c.costCenter } }); }
      else { await mine(prisma.department); await prisma.department.delete({ where: { id: c.id } }); }
      break;
  }
  await audit({ workspaceId: ws, userId: ctx.user.id, eventType: `config.${c.entity}.${c.action}`, entityType: c.entity, entityId: c.id ?? (result as { id?: string } | undefined)?.id, after: c, ip: ctx.ip });
  return result ?? { ok: true };
}

export async function auditQuery(ctx: Ctx, f: { q?: string; eventType?: string; userId?: string; entityType?: string; from?: string; to?: string; page?: number }) {
  requirePermission(ctx, "audit:view");
  const where: Prisma.AuditLogWhereInput = {
    workspaceId: ctx.workspaceId,
    ...(f.eventType ? { eventType: { startsWith: f.eventType } } : {}), ...(f.userId ? { userId: f.userId } : {}), ...(f.entityType ? { entityType: f.entityType } : {}),
    ...(f.from || f.to ? { createdAt: { ...(f.from ? { gte: new Date(f.from) } : {}), ...(f.to ? { lte: new Date(f.to + "T23:59:59Z") } : {}) } } : {}),
    ...(f.q ? { OR: [{ entityId: f.q }, { eventType: { contains: f.q } }] } : {}),
  };
  const page = Math.max(1, f.page ?? 1);
  const [items, total] = await Promise.all([prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, take: 50, skip: (page - 1) * 50 }), prisma.auditLog.count({ where })]);
  const users = await prisma.user.findMany({ where: { id: { in: [...new Set(items.map((i) => i.userId).filter(Boolean) as string[])] } }, select: { id: true, name: true } });
  return { items, total, page, users: Object.fromEntries(users.map((u) => [u.id, u.name])), canExport: can(ctx, "report:export") };
}
