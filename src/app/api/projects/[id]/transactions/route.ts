import { z } from "zod";
import { prisma } from "@/lib/db";
import { api, body, pageParams } from "@/lib/api";
import { addTransaction, assertFinanceView } from "@/lib/services/finance";

export const GET = api(async (req, ctx, p) => {
  const project = await assertFinanceView(ctx, p.id); const { take, skip } = pageParams(req);
  const [items, total] = await Promise.all([prisma.financialTransaction.findMany({ where: { projectId: project.id }, orderBy: { txDate: "desc" }, take, skip }), prisma.financialTransaction.count({ where: { projectId: project.id } })]);
  return { items, total };
});
export const POST = api(async (req, ctx, p) => {
  const b = await body(req, z.object({ kind: z.enum(["ACTUAL", "COMMITTED"]), expenseType: z.enum(["CAPEX", "OPEX"]), category: z.string().min(1).max(40), amount: z.string().regex(/^\d+(\.\d{1,2})?$/), currency: z.string().length(3).toUpperCase(),
    txDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).transform((v) => new Date(v)), vendor: z.string().max(80).optional(), costCenter: z.string().max(40).optional(), reference: z.string().max(60).optional(), description: z.string().max(500).optional() }));
  return addTransaction(ctx, p.id, b);
});
