import { requireCtx, can } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { assertFinanceView, laborCosts } from "@/lib/services/finance";
import { projectFinancials } from "@/lib/services/metrics";
import { canManageProject } from "@/lib/services/access";
import { Card, Stat } from "@/components/ui/bits";
import { Bars, Lines } from "@/components/charts/charts";
import { BudgetSheet } from "@/components/finance/budget-sheet";
import { money, num } from "@/lib/format";

export default async function ProjectFinance({ params }: { params: Promise<{ key: string }> }) {
  const ctx = await requireCtx(); const p = await assertFinanceView(ctx, (await params).key);
  const [fin, lines, tx, labor] = await Promise.all([
    projectFinancials([p.id]).then((m) => m.get(p.id)!),
    prisma.budgetLine.findMany({ where: { projectId: p.id }, orderBy: [{ fiscalYear: "asc" }, { expenseType: "asc" }, { category: "asc" }] }),
    prisma.financialTransaction.findMany({ where: { projectId: p.id }, orderBy: { txDate: "desc" } }),
    laborCosts(p.id),
  ]);
  const c = p.currency; const M = (v: unknown) => money(v, c, "en", true);
  // Monthly cumulative actual vs linear approved plan
  const months = [...new Set(tx.filter((t) => t.kind === "ACTUAL").map((t) => t.txDate.toISOString().slice(0, 7)))].sort();
  let cum = 0; const totalMonths = p.startDate && p.plannedEndDate ? Math.max(1, Math.round((p.plannedEndDate.getTime() - p.startDate.getTime()) / (30.4 * 86400000))) : months.length || 1;
  const curve = months.map((m, i) => { cum += tx.filter((t) => t.kind === "ACTUAL" && t.txDate.toISOString().startsWith(m)).reduce((a, t) => a + Number(t.amountBase), 0); return { date: m, actual: Math.round(cum), plan: Math.round((Number(p.approvedBudget) * (i + 1)) / totalMonths) }; });
  const byCat = Object.values(lines.reduce<Record<string, { name: string; approved: number; forecast: number; actual: number }>>((a, l) => { a[l.category] ??= { name: l.category, approved: 0, forecast: 0, actual: 0 }; a[l.category].approved += Number(l.approved); a[l.category].forecast += Number(l.forecast); return a; }, {}));
  for (const t of tx.filter((t) => t.kind === "ACTUAL")) { const b = byCat.find((x) => x.name === t.category); if (b) b.actual += Number(t.amountBase); else byCat.push({ name: t.category, approved: 0, forecast: 0, actual: Number(t.amountBase) }); }
  const canEdit = can(ctx, "finance:edit") && (can(ctx, "project:view_all") || canManageProject(ctx, p)) && !p.archivedAt;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        <Stat label="Approved budget" value={M(fin.approved)} />
        <Stat label="Actual" value={M(fin.actual)} sub={`${fin.burnPercent}% consumed`} />
        <Stat label="Committed" value={M(fin.committed)} />
        <Stat label="Estimate at completion" value={M(fin.eac)} />
        <Stat label="Budget variance" value={M(fin.budgetVariance)} tone={fin.budgetVariance.isNegative() ? "#ff3b30" : "#34c759"} sub="Approved − actual" />
        <Stat label="Forecast variance" value={M(fin.forecastVariance)} tone={fin.forecastVariance.isNegative() ? "#ff3b30" : "#34c759"} sub="Approved − EAC" />
        <Stat label="CPI" value={fin.cpi?.toString() ?? "—"} tone={fin.cpi && fin.cpi.lessThan(0.95) ? "#ff3b30" : undefined} sub={`EV ${M(fin.earnedValue)}`} />
        <Stat label="SPI" value={fin.spi?.toString() ?? "—"} tone={fin.spi && fin.spi.lessThan(0.95) ? "#ff3b30" : undefined} sub={`PV ${M(fin.plannedValue)}`} />
      </div>
      <div className="grid lg:grid-cols-3 gap-4">
        <Card title="CAPEX / OPEX"><Bars data={[{ name: "CAPEX", Approved: Number(fin.capexApproved), Actual: Number(fin.capexActual), Forecast: Number(fin.capexForecast) }, { name: "OPEX", Approved: Number(fin.opexApproved), Actual: Number(fin.opexActual), Forecast: Number(fin.opexForecast) }]} bars={[{ key: "Approved", color: "#c7c7cc" }, { key: "Actual", color: "#0a84ff" }, { key: "Forecast", color: "#ff9f0a" }]} /></Card>
        <Card title="Cumulative spend vs plan" className="lg:col-span-2"><Lines data={curve} lines={[{ key: "actual", label: "Actual (cumulative)", color: "#0a84ff" }, { key: "plan", label: "Linear plan", color: "#8e8e93", dashed: true }]} /></Card>
      </div>
      <Card title="Cost breakdown by category"><Bars data={byCat} bars={[{ key: "approved", label: "Approved", color: "#c7c7cc" }, { key: "actual", label: "Actual", color: "#0a84ff" }, { key: "forecast", label: "Forecast", color: "#ff9f0a" }]} /></Card>
      <BudgetSheet projectId={p.id} currency={c} canEdit={canEdit} lines={JSON.parse(JSON.stringify(lines))} transactions={JSON.parse(JSON.stringify(tx.slice(0, 200)))} />
      <Card title="Labour cost from logged work" pad={false}>
        <table className="table"><thead><tr><th>Person</th><th>Hours logged</th><th>Hourly rate</th><th>Cost</th></tr></thead><tbody>
          {labor.rows.map((r) => <tr key={r.name}><td>{r.name}</td><td>{num(r.hours, 2)}</td><td>{r.rate ? money(r.rate, c) : <span className="muted text-xs">no resource profile</span>}</td><td>{r.cost ? money(r.cost, c) : "—"}</td></tr>)}
          <tr><td className="font-semibold">Total</td><td /><td /><td className="font-semibold">{money(labor.total, c)}</td></tr></tbody></table>
        <p className="text-xs muted px-4 py-2">Planned labour cost from allocations: {money(labor.plannedCost, c)} · actual hours on allocations: {money(labor.actualAllocCost, c)}.</p>
      </Card>
    </div>
  );
}
