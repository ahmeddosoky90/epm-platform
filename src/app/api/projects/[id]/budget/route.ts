import { z } from "zod";
import { prisma } from "@/lib/db";
import { api, body } from "@/lib/api";
import { assertFinanceEdit, assertFinanceView, upsertBudgetLine } from "@/lib/services/finance";
import { audit } from "@/lib/audit";
import { notFound } from "@/lib/errors";

const amt = z.union([z.string(), z.number()]).transform(String).pipe(z.string().regex(/^-?\d+(\.\d{1,2})?$/, "Use a number with up to 2 decimals"));
const line = z.object({ id: z.string().uuid().optional(), category: z.string().min(1).max(40), expenseType: z.enum(["CAPEX", "OPEX"]), costCenter: z.string().max(40).nullable().optional(), vendor: z.string().max(80).nullable().optional(), fiscalYear: z.number().int().min(2000).max(2100), proposed: amt, approved: amt, forecast: amt, notes: z.string().max(1000).nullable().optional() });

export const GET = api(async (_r, ctx, p) => prisma.budgetLine.findMany({ where: { projectId: (await assertFinanceView(ctx, p.id)).id }, orderBy: [{ fiscalYear: "asc" }, { expenseType: "asc" }, { category: "asc" }] }));
export const POST = api(async (req, ctx, p) => upsertBudgetLine(ctx, p.id, await body(req, line)));
export const DELETE = api(async (req, ctx, p) => {
  const project = await assertFinanceEdit(ctx, p.id);
  const l = await prisma.budgetLine.findFirst({ where: { id: req.nextUrl.searchParams.get("lineId") ?? "", projectId: project.id } });
  if (!l) throw notFound("Budget line");
  await prisma.budgetLine.delete({ where: { id: l.id } });
  await audit({ workspaceId: ctx.workspaceId, userId: ctx.user.id, eventType: "finance.budget_line_deleted", entityType: "BudgetLine", entityId: l.id, before: l, ip: ctx.ip });
  return { ok: true };
});
