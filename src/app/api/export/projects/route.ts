import { api } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { portfolioSummary } from "@/lib/services/metrics";
import { exportResponse } from "@/lib/export";
import { audit } from "@/lib/audit";

export const GET = api(async (req, ctx) => {
  requirePermission(ctx, "report:export");
  const s = await portfolioSummary(ctx);
  const fin = ctx.permissions.includes("*") || ctx.permissions.includes("finance:view");
  await audit({ workspaceId: ctx.workspaceId, userId: ctx.user.id, eventType: "report.exported", entityType: "Project", after: { rows: s.projects.length }, ip: ctx.ip });
  return exportResponse(req.nextUrl.searchParams.get("format") ?? "xlsx", "projects", [
    { header: "Key", key: "key", width: 10 }, { header: "Project", key: "name", width: 40 }, { header: "Portfolio", key: "portfolio", width: 30 }, { header: "Program", key: "program", width: 30 },
    { header: "Business unit", key: "bu", width: 20 }, { header: "Status", key: "status" }, { header: "Health", key: "health" }, { header: "Progress %", key: "progress" },
    { header: "Start", key: "start", numFmt: "yyyy-mm-dd" }, { header: "Planned end", key: "end", numFmt: "yyyy-mm-dd" },
    ...(fin ? [{ header: "Approved", key: "approved", numFmt: "#,##0.00", width: 18 }, { header: "Actual", key: "actual", numFmt: "#,##0.00", width: 18 }, { header: "EAC", key: "eac", numFmt: "#,##0.00", width: 18 }, { header: "Budget variance", key: "bv", numFmt: "#,##0.00", width: 18 }, { header: "CPI", key: "cpi" }, { header: "SPI", key: "spi" }] : []),
  ], s.projects.map((p) => ({ key: p.key, name: p.name, portfolio: p.portfolio?.name, program: p.program?.name, bu: p.businessUnit, status: p.status, health: p.health, progress: p.progress, start: p.startDate, end: p.plannedEndDate,
    approved: Number(p.fin.approved), actual: Number(p.fin.actual), eac: Number(p.fin.eac), bv: Number(p.fin.budgetVariance), cpi: p.fin.cpi ? Number(p.fin.cpi) : null, spi: p.fin.spi ? Number(p.fin.spi) : null })));
});
