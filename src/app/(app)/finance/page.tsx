import Link from "next/link";
import { requireCtx, pagePermission, can } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { portfolioSummary } from "@/lib/services/metrics";
import { PageHeader, Stat, Card, Health, Empty } from "@/components/ui/bits";
import { Bars, Combo, Donut } from "@/components/charts/charts";
import { money } from "@/lib/format";
import { D } from "@/lib/calc/money";

type SP = Record<string, string | undefined>;

/** Workspace financial dashboard: investment, FY comparison, cost centres, variance league table. */
export default async function FinancePage({ searchParams }: { searchParams: Promise<SP> }) {
  const ctx = await requireCtx(); pagePermission(ctx, "finance:view");
  const sp = await searchParams;
  const s = await portfolioSummary(ctx, sp.portfolio ? { portfolioId: sp.portfolio } : {});
  const ids = s.projects.map((p) => p.id);
  const c = ctx.workspace.currency; const M = (v: unknown) => money(v, c, "en", true);
  const [fyLines, tx, byCC, portfolios] = await Promise.all([
    prisma.budgetLine.groupBy({ by: ["fiscalYear"], where: { projectId: { in: ids } }, _sum: { proposed: true, approved: true, forecast: true }, orderBy: { fiscalYear: "asc" } }),
    prisma.financialTransaction.findMany({ where: { projectId: { in: ids } }, select: { kind: true, expenseType: true, amountBase: true, txDate: true, costCenter: true, category: true } }),
    prisma.budgetLine.groupBy({ by: ["costCenter"], where: { projectId: { in: ids } }, _sum: { approved: true, forecast: true } }),
    prisma.portfolio.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { name: "asc" } }),
  ]);

  // Actuals by fiscal (calendar) year from transaction dates
  const actualByYear = new Map<number, number>();
  for (const t of tx) if (t.kind === "ACTUAL") actualByYear.set(t.txDate.getUTCFullYear(), (actualByYear.get(t.txDate.getUTCFullYear()) ?? 0) + Number(t.amountBase));
  const years = [...new Set([...fyLines.map((l) => l.fiscalYear), ...actualByYear.keys()])].sort();
  const fy = years.map((y) => { const l = fyLines.find((x) => x.fiscalYear === y); return { name: `FY${y}`, Proposed: Number(l?._sum.proposed ?? 0), Approved: Number(l?._sum.approved ?? 0), Forecast: Number(l?._sum.forecast ?? 0), Actual: actualByYear.get(y) ?? 0 }; });

  // Monthly spend (last 12 months with data) and cumulative
  const months = new Map<string, { actual: number; committed: number }>();
  for (const t of tx) { const k = t.txDate.toISOString().slice(0, 7); const m = months.get(k) ?? { actual: 0, committed: 0 }; if (t.kind === "ACTUAL") m.actual += Number(t.amountBase); else m.committed += Number(t.amountBase); months.set(k, m); }
  let cum = 0;
  const monthly = [...months.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([k, v]) => ({ name: k, Actual: v.actual, Committed: v.committed, Cumulative: (cum += v.actual) }));

  // Cost centres: approved/forecast from budget lines, actual from transactions
  const ccActual = new Map<string, number>();
  for (const t of tx) if (t.kind === "ACTUAL") ccActual.set(t.costCenter ?? "Unassigned", (ccActual.get(t.costCenter ?? "Unassigned") ?? 0) + Number(t.amountBase));
  const cc = [...new Set([...byCC.map((x) => x.costCenter ?? "Unassigned"), ...ccActual.keys()])].map((k) => {
    const l = byCC.find((x) => (x.costCenter ?? "Unassigned") === k);
    const approved = Number(l?._sum.approved ?? 0), forecast = Number(l?._sum.forecast ?? 0), actual = ccActual.get(k) ?? 0;
    return { k, approved, forecast, actual, variance: approved - forecast };
  }).sort((a, b) => b.approved - a.approved);

  const byCategory = Object.entries(tx.filter((t) => t.kind === "ACTUAL").reduce<Record<string, number>>((a, t) => { a[t.category] = (a[t.category] ?? 0) + Number(t.amountBase); return a; }, {})).map(([name, value]) => ({ name, value }));
  const league = [...s.projects].filter((p) => !D(p.approvedBudget).isZero()).sort((a, b) => Number(b.fin.eac.minus(b.fin.approved)) - Number(a.fin.eac.minus(a.fin.approved)));
  const overBudget = league.filter((p) => p.fin.eac.greaterThan(p.fin.approved));

  return (<>
    <PageHeader title="Financials" subtitle={`All amounts in ${c}. Foreign-currency transactions are converted at the rate effective on their date.`}
      actions={<div className="flex gap-2">
        <form method="get"><select name="portfolio" defaultValue={sp.portfolio ?? ""} className="input !w-auto" aria-label="Portfolio"><option value="">All portfolios</option>{portfolios.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select> <button className="btn-secondary">Filter</button></form>
        {can(ctx, "report:export") && <a className="btn-secondary" href="/api/export/projects?format=xlsx">Export</a>}
      </div>} />
    {!ids.length ? <Empty title="No projects in scope" /> : <>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-4">
        <Stat label="Approved budget" value={M(s.totals.approved)} />
        <Stat label="Actual spend" value={M(s.totals.actual)} sub={`${s.totals.approved.isZero() ? 0 : Math.round(Number(s.totals.actual.div(s.totals.approved)) * 100)}% of approved`} />
        <Stat label="Committed" value={M(s.totals.committed)} />
        <Stat label="Forecast at completion" value={M(s.totals.forecast)} tone={s.totals.forecast.greaterThan(s.totals.approved) ? "#ff3b30" : "#34c759"} />
        <Stat label="Variance (approved − EAC)" value={M(s.totals.approved.minus(s.totals.forecast))} tone={s.totals.approved.lessThan(s.totals.forecast) ? "#ff3b30" : "#34c759"} />
        <Stat label="Projects over budget" value={overBudget.length} tone={overBudget.length ? "#ff3b30" : "#34c759"} sub={`of ${league.length} with a budget`} />
      </div>
      <div className="grid lg:grid-cols-3 gap-4 mb-4">
        <Card title="Fiscal year comparison" className="lg:col-span-2">{fy.length ? <Bars data={fy} height={240} bars={[{ key: "Proposed", color: "#d1d1d6" }, { key: "Approved", color: "#8e8e93" }, { key: "Forecast", color: "#ff9f0a" }, { key: "Actual", color: "#0a84ff" }]} /> : <Empty title="No budget lines yet" />}</Card>
        <Card title="Actual spend by category">{byCategory.length ? <Donut data={byCategory} height={200} /> : <Empty title="No actuals recorded" />}</Card>
      </div>
      <Card title="Monthly spend" className="mb-4">{monthly.length ? <Combo data={monthly} height={240} bars={[{ key: "Actual", color: "#0a84ff" }, { key: "Committed", color: "#c7c7cc" }]} lines={[{ key: "Cumulative", color: "#5856d6" }]} /> : <Empty title="No transactions recorded" />}</Card>
      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Cost centre report" pad={false}><table className="table"><thead><tr><th>Cost centre</th><th className="text-end">Approved</th><th className="text-end">Forecast</th><th className="text-end">Actual</th><th className="text-end">Variance</th></tr></thead>
          <tbody>{cc.map((r) => <tr key={r.k}><td>{r.k}</td><td className="text-end">{M(r.approved)}</td><td className="text-end">{M(r.forecast)}</td><td className="text-end">{M(r.actual)}</td><td className="text-end" style={{ color: r.variance < 0 ? "#ff3b30" : undefined }}>{M(r.variance)}</td></tr>)}</tbody></table></Card>
        <Card title="Budget variance by project" pad={false}><table className="table"><thead><tr><th>Project</th><th>Health</th><th className="text-end">Approved</th><th className="text-end">EAC</th><th className="text-end">Variance</th><th>CPI</th></tr></thead>
          <tbody>{league.map((p) => { const v = p.fin.approved.minus(p.fin.eac); return <tr key={p.id}><td><Link className="text-accent" href={`/projects/${p.key}/finance`}>{p.key}</Link> <span className="text-xs muted">{p.name}</span></td><td><Health h={p.health} /></td><td className="text-end">{M(p.fin.approved)}</td><td className="text-end">{M(p.fin.eac)}</td><td className="text-end" style={{ color: v.isNegative() ? "#ff3b30" : "#34c759" }}>{M(v)}</td><td>{p.fin.cpi?.toString() ?? "—"}</td></tr>; })}</tbody></table></Card>
      </div>
    </>}
  </>);
}
