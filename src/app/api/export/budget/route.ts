import { prisma } from "@/lib/db";
import { api } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { assertFinanceView } from "@/lib/services/finance";
import { exportResponse } from "@/lib/export";

export const GET = api(async (req, ctx) => {
  requirePermission(ctx, "report:export");
  const p = await assertFinanceView(ctx, req.nextUrl.searchParams.get("projectId") ?? "");
  const lines = await prisma.budgetLine.findMany({ where: { projectId: p.id }, orderBy: [{ fiscalYear: "asc" }, { category: "asc" }] });
  const n = (v: unknown) => Number(v);
  return exportResponse(req.nextUrl.searchParams.get("format") ?? "xlsx", `${p.key}-budget`, [
    { header: "FY", key: "fiscalYear" }, { header: "Category", key: "category" }, { header: "Type", key: "expenseType" }, { header: "Cost centre", key: "costCenter" }, { header: "Vendor", key: "vendor" },
    { header: "Proposed", key: "proposed", numFmt: "#,##0.00", width: 18 }, { header: "Approved", key: "approved", numFmt: "#,##0.00", width: 18 }, { header: "Forecast", key: "forecast", numFmt: "#,##0.00", width: 18 }, { header: "Variance", key: "variance", numFmt: "#,##0.00", width: 18 },
  ], lines.map((l) => ({ ...l, proposed: n(l.proposed), approved: n(l.approved), forecast: n(l.forecast), variance: n(l.approved.minus(l.forecast)) })));
});
