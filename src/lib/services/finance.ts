import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { can, requirePermission, type Ctx } from "../auth";
import { badRequest, forbidden, notFound } from "../errors";
import { loadProject, canManageProject } from "./access";
import { audit } from "../audit";
import { toBase, laborCost } from "../calc/finance";
import { D, sum } from "../calc/money";

export async function assertFinanceView(ctx: Ctx, projectKey: string) {
  const p = await loadProject(ctx, projectKey);
  if (!can(ctx, "finance:view") && !canManageProject(ctx, p)) throw forbidden("You cannot view this project's financials");
  return p;
}
export async function assertFinanceEdit(ctx: Ctx, projectKey: string) {
  requirePermission(ctx, "finance:edit");
  const p = await loadProject(ctx, projectKey);
  if (p.archivedAt) throw forbidden("Project is archived");
  if (!can(ctx, "project:view_all") && !canManageProject(ctx, p)) throw forbidden();
  return p;
}

export async function rateFor(workspaceId: string, currency: string, at: Date) {
  const ws = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
  if (currency === ws.currency) return D(1);
  const r = await prisma.exchangeRate.findFirst({ where: { workspaceId, currency, effectiveDate: { lte: at } }, orderBy: { effectiveDate: "desc" } });
  if (!r) throw badRequest(`No exchange rate configured for ${currency}. Add one in Administration → Financial settings.`);
  return r.rateToBase;
}


export async function addTransaction(ctx: Ctx, projectKey: string, b: { kind: "ACTUAL" | "COMMITTED"; expenseType: "CAPEX" | "OPEX"; category: string; amount: string; currency: string; txDate: Date; vendor?: string; costCenter?: string; reference?: string; description?: string }) {
  const p = await assertFinanceEdit(ctx, projectKey);
  const rate = await rateFor(ctx.workspaceId, b.currency, b.txDate);
  return prisma.$transaction(async (tx) => {
    const t = await tx.financialTransaction.create({ data: { ...b, amount: D(b.amount), amountBase: toBase(b.amount, rate), projectId: p.id, createdById: ctx.user.id } });
    await audit({ workspaceId: ctx.workspaceId, userId: ctx.user.id, eventType: "finance.transaction_added", entityType: "FinancialTransaction", entityId: t.id, after: { ...b, amountBase: t.amountBase.toString(), project: p.key }, ip: ctx.ip }, tx);
    return t;
  });
}

export async function upsertBudgetLine(ctx: Ctx, projectKey: string, b: { id?: string; category: string; expenseType: string; costCenter?: string | null; vendor?: string | null; fiscalYear: number; proposed: string; approved: string; forecast: string; notes?: string | null }) {
  const p = await assertFinanceEdit(ctx, projectKey);
  const data = { ...b, proposed: D(b.proposed), approved: D(b.approved), forecast: D(b.forecast) };
  return prisma.$transaction(async (tx) => {
    let before: unknown = null; let line;
    if (b.id) {
      const cur = await tx.budgetLine.findFirst({ where: { id: b.id, projectId: p.id } });
      if (!cur) throw notFound("Budget line");
      before = cur; line = await tx.budgetLine.update({ where: { id: b.id }, data });
    } else line = await tx.budgetLine.create({ data: { ...data, projectId: p.id } });
    await audit({ workspaceId: ctx.workspaceId, userId: ctx.user.id, eventType: "finance.budget_line_saved", entityType: "BudgetLine", entityId: line.id, before, after: line, ip: ctx.ip }, tx);
    return line;
  });
}

/** Labor cost from logged work × resource hourly rate (BRD 11.3). */
export async function laborCosts(projectId: string) {
  const logs = await prisma.workLog.groupBy({ by: ["userId"], where: { issue: { projectId } }, _sum: { minutes: true } });
  const res = await prisma.resource.findMany({ where: { userId: { in: logs.map((l) => l.userId) } } });
  const users = await prisma.user.findMany({ where: { id: { in: logs.map((l) => l.userId) } }, select: { id: true, name: true } });
  const rows = logs.map((l) => { const r = res.find((x) => x.userId === l.userId); const hours = D(l._sum.minutes ?? 0).dividedBy(60);
    return { name: users.find((u) => u.id === l.userId)?.name ?? "?", hours: hours.toDecimalPlaces(2), rate: r?.hourlyRate ?? null, cost: r ? laborCost(hours, r.hourlyRate) : null }; });
  const allocs = await prisma.resourceAllocation.findMany({ where: { projectId }, include: { resource: true } });
  const plannedCost = sum(allocs.map((a) => laborCost(a.plannedHours, a.resource.hourlyRate)));
  const actualAllocCost = sum(allocs.map((a) => laborCost(a.actualHours, a.resource.hourlyRate)));
  return { rows, total: sum(rows.map((r) => r.cost ?? 0)), plannedCost, actualAllocCost };
}

export type BudgetLineInput = Prisma.BudgetLineUncheckedCreateInput;
