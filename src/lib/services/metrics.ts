import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import type { Ctx } from "../auth";
import { projectScope } from "./access";
import { financialSummary, plannedPercentAt } from "../calc/finance";
import { D, sum } from "../calc/money";
import { riskBand } from "../calc/risk";

/** All dashboard numbers come from persisted data via these queries — nothing is hard-coded. */

export async function projectFinancials(projectIds: string[]) {
  const [tx, lines, projects] = await Promise.all([
    prisma.financialTransaction.groupBy({ by: ["projectId", "kind", "expenseType"], where: { projectId: { in: projectIds } }, _sum: { amountBase: true } }),
    prisma.budgetLine.groupBy({ by: ["projectId", "expenseType"], where: { projectId: { in: projectIds } }, _sum: { approved: true, forecast: true, proposed: true } }),
    prisma.project.findMany({ where: { id: { in: projectIds } }, select: { id: true, approvedBudget: true, capexBudget: true, opexBudget: true, progress: true, startDate: true, plannedEndDate: true } }),
  ]);
  const out = new Map<string, ReturnType<typeof financialSummary> & { capexActual: Prisma.Decimal; opexActual: Prisma.Decimal; capexForecast: Prisma.Decimal; opexForecast: Prisma.Decimal; capexApproved: Prisma.Decimal; opexApproved: Prisma.Decimal }>();
  for (const p of projects) {
    const t = tx.filter((x) => x.projectId === p.id);
    const l = lines.filter((x) => x.projectId === p.id);
    const actual = sum(t.filter((x) => x.kind === "ACTUAL").map((x) => x._sum.amountBase));
    const committed = sum(t.filter((x) => x.kind === "COMMITTED").map((x) => x._sum.amountBase));
    const forecastTotalLines = sum(l.map((x) => x._sum.forecast));
    // Remaining forecast = forecast at completion (budget sheet) − actual spent so far (never below committed)
    let remaining = forecastTotalLines.minus(actual);
    if (remaining.lessThan(committed)) remaining = committed;
    const fs = financialSummary({ approvedBudget: p.approvedBudget, actual, committed, remainingForecast: remaining, percentComplete: p.progress, plannedPercent: plannedPercentAt(p.startDate, p.plannedEndDate) });
    const byType = (et: string) => sum(t.filter((x) => x.kind === "ACTUAL" && x.expenseType === et).map((x) => x._sum.amountBase));
    const fcType = (et: string) => sum(l.filter((x) => x.expenseType === et).map((x) => x._sum.forecast));
    out.set(p.id, { ...fs, capexActual: byType("CAPEX"), opexActual: byType("OPEX"), capexForecast: fcType("CAPEX"), opexForecast: fcType("OPEX"), capexApproved: D(p.capexBudget), opexApproved: D(p.opexBudget) });
  }
  return out;
}

export async function portfolioSummary(ctx: Ctx, filter: Prisma.ProjectWhereInput = {}) {
  const projects = await prisma.project.findMany({ where: { AND: [projectScope(ctx), filter] }, include: { portfolio: { select: { name: true } }, program: { select: { name: true } }, objectives: { include: { objective: true } } } });
  const live = projects.filter((p) => !p.archivedAt || p.status === "COMPLETED");
  const fin = await projectFinancials(live.map((p) => p.id));
  const now = new Date();
  const delayed = (p: (typeof projects)[number]) => p.status === "ACTIVE" && p.plannedEndDate && p.plannedEndDate < now;
  const totals = {
    total: live.length,
    active: live.filter((p) => p.status === "ACTIVE").length,
    completed: live.filter((p) => p.status === "COMPLETED").length,
    onHold: live.filter((p) => p.status === "ON_HOLD").length,
    proposed: live.filter((p) => p.status === "PROPOSED").length,
    onTrack: live.filter((p) => p.status === "ACTIVE" && p.health === "GREEN").length,
    atRisk: live.filter((p) => p.status === "ACTIVE" && p.health === "AMBER").length,
    offTrack: live.filter((p) => p.status === "ACTIVE" && p.health === "RED").length,
    delayed: live.filter(delayed).length,
    approved: sum(live.map((p) => p.approvedBudget)),
    actual: sum([...fin.values()].map((f) => f.actual)),
    forecast: sum([...fin.values()].map((f) => f.eac)),
    committed: sum([...fin.values()].map((f) => f.committed)),
    capexApproved: sum(live.map((p) => p.capexBudget)), opexApproved: sum(live.map((p) => p.opexBudget)),
    capexActual: sum([...fin.values()].map((f) => f.capexActual)), opexActual: sum([...fin.values()].map((f) => f.opexActual)),
  };
  const byKey = <K extends string>(f: (p: (typeof live)[number]) => K) => Object.entries(live.reduce<Record<string, number>>((a, p) => { const k = f(p); a[k] = (a[k] ?? 0) + 1; return a; }, {})).map(([name, value]) => ({ name, value }));
  return {
    projects: live.map((p) => ({ ...p, fin: fin.get(p.id)!, delayed: !!delayed(p) })),
    totals,
    byStatus: byKey((p) => p.status), byHealth: byKey((p) => (p.status === "ACTIVE" ? p.health : p.status)),
    byBU: byKey((p) => p.businessUnit ?? "Unassigned"), byMethodology: byKey((p) => p.methodology),
    byPortfolio: byKey((p) => p.portfolio?.name ?? "Unassigned"),
  };
}

export async function issueStats(ctx: Ctx, projectIds?: string[]) {
  const scope: Prisma.IssueWhereInput = { deletedAt: null, project: projectScope(ctx), ...(projectIds ? { projectId: { in: projectIds } } : {}) };
  const open = { ...scope, status: { category: { not: "DONE" } } };
  const [byStatusRaw, statuses, types, openByType, bugsBySeverity, showStoppers, openShowStoppers, byPriority, overdue, created30, resolved30, unassigned, byAssignee] = await Promise.all([
    prisma.issue.groupBy({ by: ["statusId"], where: scope, _count: true }),
    prisma.workflowStatus.findMany({ where: { workflow: { workspaceId: ctx.workspaceId } } }),
    prisma.issueType.findMany({ where: { workspaceId: ctx.workspaceId } }),
    prisma.issue.groupBy({ by: ["typeId"], where: open, _count: true }),
    prisma.issue.groupBy({ by: ["severity"], where: { ...open, type: { name: "Bug" } }, _count: true }),
    prisma.issue.count({ where: { ...scope, isShowStopper: true } }),
    prisma.issue.findMany({ where: { ...open, isShowStopper: true }, include: { project: { select: { key: true } }, status: true, assignee: { select: { name: true } } }, orderBy: { createdAt: "asc" }, take: 20 }),
    prisma.issue.groupBy({ by: ["priority"], where: open, _count: true }),
    prisma.issue.count({ where: { ...open, dueDate: { lt: new Date() } } }),
    prisma.issue.findMany({ where: { ...scope, createdAt: { gte: new Date(Date.now() - 30 * 86400000) } }, select: { createdAt: true, isShowStopper: true, type: { select: { name: true } } } }),
    prisma.issue.findMany({ where: { ...scope, resolvedAt: { gte: new Date(Date.now() - 30 * 86400000) } }, select: { resolvedAt: true } }),
    prisma.issue.count({ where: { ...open, assigneeId: null } }),
    prisma.issue.groupBy({ by: ["assigneeId"], where: { ...open, assigneeId: { not: null } }, _count: true }),
  ]);
  const sMap = new Map(statuses.map((s) => [s.id, s]));
  const byStatus = Object.values(byStatusRaw.reduce<Record<string, { name: string; value: number; color: string; order: number }>>((a, r) => {
    const s = sMap.get(r.statusId); if (!s) return a;
    a[s.name] ??= { name: s.name, value: 0, color: s.color, order: s.sortOrder }; a[s.name].value += r._count; return a;
  }, {})).sort((a, b) => a.order - b.order);
  const tMap = new Map(types.map((t) => [t.id, t]));
  const days = [...Array(30)].map((_, i) => new Date(Date.now() - (29 - i) * 86400000).toISOString().slice(0, 10));
  const trend = days.map((d) => ({
    date: d.slice(5),
    created: created30.filter((x) => x.createdAt.toISOString().startsWith(d)).length,
    bugs: created30.filter((x) => x.type.name === "Bug" && x.createdAt.toISOString().startsWith(d)).length,
    resolved: resolved30.filter((x) => x.resolvedAt?.toISOString().startsWith(d)).length,
  }));
  const users = await prisma.user.findMany({ where: { id: { in: byAssignee.map((b) => b.assigneeId!) } }, select: { id: true, name: true } });
  const totalOpen = openByType.reduce((a, r) => a + r._count, 0);
  const openBugs = openByType.filter((r) => tMap.get(r.typeId)?.name === "Bug").reduce((a, r) => a + r._count, 0);
  return {
    byStatus, totalOpen, openBugs, overdue, unassigned, showStoppersTotal: showStoppers, openShowStoppers,
    openByType: openByType.map((r) => ({ name: tMap.get(r.typeId)?.name ?? "?", value: r._count, color: tMap.get(r.typeId)?.color ?? "#999" })).sort((a, b) => b.value - a.value),
    bugsBySeverity: ["S1", "S2", "S3", "S4", null].map((s) => ({ name: s ?? "Unrated", value: bugsBySeverity.find((b) => b.severity === s)?._count ?? 0 })),
    byPriority: ["Blocker", "Critical", "High", "Medium", "Low"].map((p) => ({ name: p, value: byPriority.find((b) => b.priority === p)?._count ?? 0 })),
    byAssignee: byAssignee.map((b) => ({ name: users.find((u) => u.id === b.assigneeId)?.name ?? "?", value: b._count })).sort((a, b) => b.value - a.value).slice(0, 10),
    trend,
  };
}

export async function raidSummary(ctx: Ctx, projectIds?: string[]) {
  const scope = { project: projectScope(ctx), ...(projectIds ? { projectId: { in: projectIds } } : {}) };
  const now = new Date();
  const [risks, items] = await Promise.all([
    prisma.risk.findMany({ where: { ...scope, status: { not: "CLOSED" } }, include: { project: { select: { key: true, name: true } } }, orderBy: { score: "desc" } }),
    prisma.raidItem.findMany({ where: { ...scope, status: { notIn: ["CLOSED", "RESOLVED", "VALIDATED"] } }, include: { project: { select: { key: true } } } }),
  ]);
  const matrix = [...Array(5)].map((_, i) => [...Array(5)].map((__, j) => risks.filter((r) => r.probability === 5 - i && r.impact === j + 1).length));
  return {
    risks, matrix,
    openRisks: risks.length, highRisks: risks.filter((r) => r.score >= 8).length, overdueRisks: risks.filter((r) => r.targetDate && r.targetDate < now).length,
    openIssues: items.filter((i) => i.kind === "ISSUE").length, criticalIssues: items.filter((i) => i.kind === "ISSUE" && i.severity === "Critical").length,
    overdueActions: items.filter((i) => i.kind === "ACTION" && i.dueDate && i.dueDate < now).length,
    unresolvedDeps: items.filter((i) => i.kind === "DEPENDENCY").length,
    items, band: riskBand,
  };
}

export async function governanceCompliance(ctx: Ctx) {
  const projects = await prisma.project.findMany({
    where: { ...projectScope(ctx), archivedAt: null, status: { in: ["ACTIVE", "PROPOSED", "ON_HOLD"] } },
    include: { lifecycleStage: true, gates: { include: { stage: true, approvals: true } }, documents: true, statusReports: { orderBy: { createdAt: "desc" }, take: 1 }, budgetLines: { select: { approved: true } } },
  });
  const now = new Date();
  const stages = await prisma.lifecycleStage.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { sortOrder: "asc" } });
  const execIdx = stages.findIndex((s) => s.name === "Execution");
  const exceptions: { projectKey: string; projectName: string; kind: string; detail: string; severity: "high" | "medium" }[] = [];
  for (const p of projects) {
    const idx = stages.findIndex((s) => s.id === p.lifecycleStageId);
    const gate = (n: string) => p.gates.find((g) => g.stage.name === n);
    if (idx >= execIdx && execIdx >= 0) {
      for (const g of ["Business Case Approval", "Project Initiation", "Planning Approval"]) {
        if (gate(g)?.status !== "APPROVED") exceptions.push({ projectKey: p.key, projectName: p.name, kind: "Bypassed gate", detail: `In ${p.lifecycleStage?.name} without "${g}" approval`, severity: "high" });
      }
    }
    if (p.status === "ACTIVE" && D(p.approvedBudget).isZero()) exceptions.push({ projectKey: p.key, projectName: p.name, kind: "No approved budget", detail: "Active project has no approved budget", severity: "high" });
    for (const g of p.gates) {
      if (g.status === "APPROVED" && g.expiresAt && g.expiresAt < now) exceptions.push({ projectKey: p.key, projectName: p.name, kind: "Expired approval", detail: `${g.stage.name} expired ${g.expiresAt.toISOString().slice(0, 10)}`, severity: "medium" });
      if (g.status === "IN_REVIEW" && g.submittedAt && now.getTime() - g.submittedAt.getTime() > 7 * 86400000) exceptions.push({ projectKey: p.key, projectName: p.name, kind: "Overdue approval", detail: `${g.stage.name} awaiting decision for ${Math.floor((now.getTime() - g.submittedAt.getTime()) / 86400000)} days`, severity: "medium" });
      if (g.status === "APPROVED") {
        const required = ["Business Case Approval", "Project Initiation"].includes(g.stage.name) ? [g.stage.name === "Business Case Approval" ? "Business Case" : "Project Charter"] : [];
        for (const cat of required) if (!p.documents.some((d) => d.category === cat)) exceptions.push({ projectKey: p.key, projectName: p.name, kind: "Missing document", detail: `${cat} not uploaded although "${g.stage.name}" is approved`, severity: "medium" });
      }
    }
    const last = p.statusReports[0];
    if (p.status === "ACTIVE" && (!last || now.getTime() - last.createdAt.getTime() > 14 * 86400000)) exceptions.push({ projectKey: p.key, projectName: p.name, kind: "Status report overdue", detail: last ? `Last report ${Math.floor((now.getTime() - last.createdAt.getTime()) / 86400000)} days ago` : "No status report submitted", severity: "medium" });
  }
  const pendingApprovals = await prisma.approval.findMany({
    where: { decision: "PENDING", OR: [{ gate: { project: projectScope(ctx) } }, { changeRequest: { project: projectScope(ctx) } }] },
    include: { gate: { include: { stage: true, project: { select: { key: true, name: true } }, approvals: true } }, changeRequest: { include: { project: { select: { key: true, name: true } }, approvals: true } } },
    orderBy: { createdAt: "asc" },
  });
  // Only the current step of a sequential chain is actionable
  const actionable = pendingApprovals.filter((a) => {
    const chain = a.gate?.approvals ?? a.changeRequest?.approvals ?? [];
    return chain.filter((x) => x.step < a.step).every((x) => x.decision === "APPROVED") && (a.gate ? a.gate.status === "IN_REVIEW" : a.changeRequest?.status === "SUBMITTED");
  });
  const compliant = projects.length - new Set(exceptions.filter((e) => e.severity === "high").map((e) => e.projectKey)).size;
  return { projects, exceptions, actionable, compliancePct: projects.length ? Math.round((compliant / projects.length) * 100) : 100 };
}
