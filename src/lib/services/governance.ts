import { prisma } from "../db";
import { can, requirePermission, type Ctx } from "../auth";
import { badRequest, forbidden, notFound } from "../errors";
import { loadProject, canManageProject, projectScope } from "./access";
import { audit } from "../audit";
import { notify } from "./notify";

async function usersWithRole(workspaceId: string, roleKey: string) {
  const m = await prisma.workspaceMember.findMany({ where: { workspaceId, role: { key: roleKey }, user: { isActive: true } }, select: { userId: true } });
  return m.map((x) => x.userId);
}

/** Save checklist state for a gate (manager or governance:manage). */
export async function updateChecklist(ctx: Ctx, gateId: string, state: Record<string, boolean>) {
  const gate = await prisma.projectGate.findFirst({ where: { id: gateId, project: projectScope(ctx) }, include: { stage: true, project: true } });
  if (!gate) throw notFound("Gate");
  if (!can(ctx, "governance:manage") && !canManageProject(ctx, gate.project)) throw forbidden();
  if (gate.status === "APPROVED") throw badRequest("Gate already approved");
  const clean = Object.fromEntries(gate.stage.checklist.map((c) => [c, !!state[c]]));
  return prisma.projectGate.update({ where: { id: gate.id }, data: { checklistState: clean } });
}

/** Submit a gate for approval: creates one approval step per approver role (sequential). */
export async function submitGate(ctx: Ctx, gateId: string) {
  const gate = await prisma.projectGate.findFirst({ where: { id: gateId, project: projectScope(ctx) }, include: { stage: true, project: true } });
  if (!gate) throw notFound("Gate");
  if (!can(ctx, "governance:manage") && !canManageProject(ctx, gate.project)) throw forbidden();
  if (gate.status === "IN_REVIEW" || gate.status === "APPROVED") throw badRequest(`Gate is already ${gate.status.toLowerCase().replace("_", " ")}`);
  const state = gate.checklistState as Record<string, boolean>;
  const missing = gate.stage.checklist.filter((c) => !state[c]);
  if (missing.length) throw badRequest("Checklist incomplete", { reasons: missing.map((m) => `Missing: ${m}`) });
  // Previous gates must be approved (no bypass)
  const prev = await prisma.projectGate.findMany({ where: { projectId: gate.projectId, stage: { sortOrder: { lt: gate.stage.sortOrder } } }, include: { stage: true } });
  const notApproved = prev.filter((g) => g.status !== "APPROVED");
  if (notApproved.length) throw badRequest("Earlier gates must be approved first", { reasons: notApproved.map((g) => g.stage.name) });
  return prisma.$transaction(async (tx) => {
    await tx.approval.deleteMany({ where: { gateId: gate.id } });
    await tx.approval.createMany({ data: gate.stage.approverRoles.map((r, i) => ({ gateId: gate.id, step: i + 1, approverRole: r })) });
    const u = await tx.projectGate.update({ where: { id: gate.id }, data: { status: "IN_REVIEW", submittedAt: new Date(), decidedAt: null } });
    await audit({ workspaceId: ctx.workspaceId, userId: ctx.user.id, eventType: "governance.gate_submitted", entityType: "ProjectGate", entityId: gate.id, after: { project: gate.project.key, stage: gate.stage.name }, ip: ctx.ip }, tx);
    const first = gate.stage.approverRoles[0];
    if (first) await notify({ userIds: await usersWithRole(ctx.workspaceId, first), kind: "approval", title: `Approval needed: ${gate.project.key} · ${gate.stage.name}`, link: "/governance", dedupeKey: `gate:${gate.id}:1:${Date.now()}` }, tx);
    return u;
  });
}

/**
 * Decide an approval step. Rules: only the current step of the chain; the actor must hold the
 * step's role (or be super user / delegate); a rejection ends the chain; the last approval approves the gate/CR.
 */
export async function decide(ctx: Ctx, approvalId: string, decision: "APPROVED" | "REJECTED", comment?: string) {
  requirePermission(ctx, "governance:approve");
  const a = await prisma.approval.findUnique({ where: { id: approvalId }, include: { gate: { include: { project: true, stage: true, approvals: true } }, changeRequest: { include: { project: true, approvals: true } } } });
  const project = a?.gate?.project ?? a?.changeRequest?.project;
  if (!a || !project || project.workspaceId !== ctx.workspaceId) throw notFound("Approval");
  await loadProject(ctx, project.id).catch(() => { throw notFound("Approval"); });
  if (a.decision !== "PENDING") throw badRequest("Already decided");
  const chain = a.gate?.approvals ?? a.changeRequest?.approvals ?? [];
  if (chain.some((x) => x.step < a.step && x.decision !== "APPROVED")) throw badRequest("Earlier approval steps are still pending");
  const isSuper = ctx.permissions.includes("*");
  const delegated = a.delegatedFromId && a.approverId === ctx.user.id;
  if (!isSuper && !delegated && ctx.roleKey !== a.approverRole) throw forbidden(`This step needs the ${a.approverRole.replace(/_/g, " ").toLowerCase()} role`);
  if (decision === "REJECTED" && !comment?.trim()) throw badRequest("A comment is required when rejecting");
  if (a.changeRequest && a.changeRequest.requesterId === ctx.user.id && !isSuper) throw forbidden("Requesters cannot approve their own change");
  const last = a.step === Math.max(...chain.map((x) => x.step));
  return prisma.$transaction(async (tx) => {
    await tx.approval.update({ where: { id: a.id }, data: { decision, comment, approverId: ctx.user.id, decidedAt: new Date() } });
    let outcome: string | null = null;
    if (a.gate) {
      if (decision === "REJECTED") { await tx.projectGate.update({ where: { id: a.gate.id }, data: { status: "REJECTED", decidedAt: new Date() } }); outcome = "REJECTED"; }
      else if (last) {
        const valid = a.gate.stage.validityDays;
        await tx.projectGate.update({ where: { id: a.gate.id }, data: { status: "APPROVED", decidedAt: new Date(), expiresAt: valid ? new Date(Date.now() + valid * 86400000) : null } });
        outcome = "APPROVED";
      }
    } else if (a.changeRequest) {
      if (decision === "REJECTED") { await tx.changeRequest.update({ where: { id: a.changeRequest.id }, data: { status: "REJECTED", decidedAt: new Date() } }); outcome = "REJECTED"; }
      else if (last) { await tx.changeRequest.update({ where: { id: a.changeRequest.id }, data: { status: "APPROVED", decidedAt: new Date() } }); outcome = "APPROVED"; }
    }
    await audit({ workspaceId: ctx.workspaceId, userId: ctx.user.id, eventType: "approval.decided", entityType: a.gate ? "ProjectGate" : "ChangeRequest", entityId: a.gateId ?? a.changeRequestId, after: { step: a.step, role: a.approverRole, decision, comment, outcome }, ip: ctx.ip }, tx);
    const title = a.gate ? `${project.key} · ${a.gate.stage.name}` : `${project.key}-CR-${a.changeRequest!.number}`;
    if (outcome) await notify({ userIds: [project.managerId, a.changeRequest?.requesterId], kind: "approval_done", title: `${title} ${outcome.toLowerCase()}`, body: comment, link: a.gate ? `/projects/${project.key}/governance` : `/projects/${project.key}/changes` }, tx);
    else {
      const next = chain.find((x) => x.step === a.step + 1);
      if (next) await notify({ userIds: await usersWithRole(ctx.workspaceId, next.approverRole), kind: "approval", title: `Approval needed: ${title}`, link: "/governance", dedupeKey: `appr:${next.id}` }, tx);
    }
    return { outcome };
  });
}

/** Delegate a pending step to another user (approver-role holders or super user). */
export async function delegate(ctx: Ctx, approvalId: string, toUserId: string) {
  requirePermission(ctx, "governance:approve");
  const a = await prisma.approval.findUnique({ where: { id: approvalId }, include: { gate: { include: { project: true } }, changeRequest: { include: { project: true } } } });
  const project = a?.gate?.project ?? a?.changeRequest?.project;
  if (!a || !project || project.workspaceId !== ctx.workspaceId || a.decision !== "PENDING") throw notFound("Approval");
  if (!ctx.permissions.includes("*") && ctx.roleKey !== a.approverRole) throw forbidden("Only holders of the step's role can delegate it");
  const m = await prisma.workspaceMember.findFirst({ where: { workspaceId: ctx.workspaceId, userId: toUserId } });
  if (!m) throw badRequest("Delegate must be a workspace member");
  await prisma.approval.update({ where: { id: a.id }, data: { approverId: toUserId, delegatedFromId: ctx.user.id } });
  await audit({ workspaceId: ctx.workspaceId, userId: ctx.user.id, eventType: "approval.delegated", entityType: "Approval", entityId: a.id, after: { to: toUserId }, ip: ctx.ip });
  await notify({ userIds: [toUserId], kind: "approval", title: `Approval delegated to you: ${project.key}`, link: "/governance" });
  return { ok: true };
}

export async function createChangeRequest(ctx: Ctx, projectKey: string, b: { title: string; description?: string; category: string; justification?: string; scopeImpact?: string; scheduleImpactDays: number; financialImpact: string; resourceImpact?: string; riskImpact?: string }) {
  requirePermission(ctx, "change:create");
  const p = await loadProject(ctx, projectKey);
  if (p.archivedAt) throw forbidden("Project is archived");
  const chainRoles = ["PROJECT_MANAGER", ...(Number(b.financialImpact) > 0 ? ["FINANCE"] : []), ...(Number(b.financialImpact) > 500000 || b.scheduleImpactDays > 14 ? ["HEAD_OF_PMO"] : [])];
  return prisma.$transaction(async (tx) => {
    const n = (await tx.changeRequest.count({ where: { projectId: p.id } })) + 1;
    const cr = await tx.changeRequest.create({ data: { ...b, projectId: p.id, number: n, requesterId: ctx.user.id, status: "SUBMITTED", approvals: { create: chainRoles.map((r, i) => ({ step: i + 1, approverRole: r })) } } });
    await audit({ workspaceId: ctx.workspaceId, userId: ctx.user.id, eventType: "change.submitted", entityType: "ChangeRequest", entityId: cr.id, after: b, ip: ctx.ip }, tx);
    await notify({ userIds: [p.managerId], excludeUserId: ctx.user.id, kind: "approval", title: `Change request ${p.key}-CR-${n} needs review`, body: b.title, link: `/projects/${p.key}/changes` }, tx);
    return cr;
  });
}

/** Implement an approved change: only now are baselines/budget/end date updated (BRD 14). */
export async function implementChange(ctx: Ctx, crId: string) {
  const cr = await prisma.changeRequest.findFirst({ where: { id: crId, project: projectScope(ctx) }, include: { project: true } });
  if (!cr) throw notFound("Change request");
  if (!canManageProject(ctx, cr.project)) throw forbidden();
  if (cr.status !== "APPROVED") throw badRequest("Only approved changes can be implemented");
  return prisma.$transaction(async (tx) => {
    const p = cr.project;
    const newEnd = p.plannedEndDate && cr.scheduleImpactDays ? new Date(p.plannedEndDate.getTime() + cr.scheduleImpactDays * 86400000) : p.plannedEndDate;
    await tx.project.update({ where: { id: p.id }, data: { plannedEndDate: newEnd, approvedBudget: { increment: cr.financialImpact } } });
    if (cr.scheduleImpactDays) {
      const ms = await tx.milestone.findMany({ where: { projectId: p.id, completedAt: null } });
      for (const m of ms) await tx.milestone.update({ where: { id: m.id }, data: { baselineDate: new Date(m.dueDate.getTime() + cr.scheduleImpactDays * 86400000), dueDate: new Date(m.dueDate.getTime() + cr.scheduleImpactDays * 86400000) } });
    }
    await tx.changeRequest.update({ where: { id: cr.id }, data: { status: "IMPLEMENTED" } });
    await audit({ workspaceId: ctx.workspaceId, userId: ctx.user.id, eventType: "change.implemented", entityType: "ChangeRequest", entityId: cr.id, before: { plannedEndDate: p.plannedEndDate, approvedBudget: p.approvedBudget.toString() }, after: { plannedEndDate: newEnd, approvedBudget: p.approvedBudget.plus(cr.financialImpact).toString() }, ip: ctx.ip }, tx);
    return { ok: true };
  });
}
