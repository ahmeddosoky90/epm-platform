import { notFound } from "next/navigation";
import Link from "next/link";
import { requireCtx, can, requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { portfolioSummary, raidSummary } from "@/lib/services/metrics";
import { weightedScore, rankProjects } from "@/lib/calc/prioritization";
import { capacityForPeriod } from "@/lib/calc/capacity";
import { PageHeader, Stat, Card, Health, Chip } from "@/components/ui/bits";
import { Donut, Bars } from "@/components/charts/charts";
import { Prioritisation } from "@/components/portfolio/prioritisation";
import { Scenarios } from "@/components/portfolio/scenarios";
import { money } from "@/lib/format";

export default async function PortfolioDetail({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireCtx(); requirePermission(ctx, "portfolio:view");
  const pf = await prisma.portfolio.findFirst({ where: { id: (await params).id, workspaceId: ctx.workspaceId }, include: { programs: true } });
  if (!pf) notFound();
  const s = await portfolioSummary(ctx, { portfolioId: pf.id });
  const ids = s.projects.map((p) => p.id);
  const [criteria, scores, raid, allocs, ws, objectives, scenarios] = await Promise.all([
    prisma.priorityCriterion.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { sortOrder: "asc" } }),
    prisma.projectScore.findMany({ where: { projectId: { in: ids } } }),
    raidSummary(ctx, ids),
    prisma.resourceAllocation.findMany({ where: { projectId: { in: ids } }, include: { resource: true } }),
    prisma.workspace.findUniqueOrThrow({ where: { id: ctx.workspaceId }, include: { holidays: true } }),
    prisma.strategicObjective.findMany({ where: { workspaceId: ctx.workspaceId }, include: { projects: { where: { projectId: { in: ids } }, include: { project: { select: { progress: true } } } } } }),
    prisma.scenario.findMany({ where: { portfolioId: pf.id }, orderBy: { createdAt: "desc" } }),
  ]);
  const crit = criteria.map((c) => ({ id: c.id, name: c.name, weight: Number(c.weight) }));
  const ranked = rankProjects(s.projects.filter((p) => p.status !== "COMPLETED" && p.status !== "CANCELLED").map((p) => ({ id: p.id, key: p.key, name: p.name, health: p.health, status: p.status, approved: Number(p.fin.approved),
    scores: Object.fromEntries(scores.filter((x) => x.projectId === p.id).map((x) => [x.criterionId, x.score])), score: weightedScore(crit, Object.fromEntries(scores.filter((x) => x.projectId === p.id).map((x) => [x.criterionId, x.score]))),
    override: p.priorityOverride, reason: p.priorityOverrideReason })));
  // Resource demand vs capacity over next 90 days
  const start = new Date(), end = new Date(Date.now() + 90 * 86400000);
  const cal = { workingDays: ws.workingDays, hoursPerDay: Number(ws.hoursPerDay), holidays: ws.holidays.map((h) => h.date) };
  const demandHours = allocs.reduce((a, x) => a + capacityForPeriod(start, end, cal, [x]).allocatedHours, 0);
  const people = [...new Set(allocs.map((a) => a.resourceId))].length;
  const capacityHours = people * capacityForPeriod(start, end, cal, []).availableHours;
  const c = ctx.workspace.currency; const fin = can(ctx, "finance:view");
  return (<>
    <PageHeader title={pf.name} subtitle={pf.description ?? undefined} crumbs={[{ label: "Portfolios", href: "/portfolios" }, { label: pf.name }]} actions={can(ctx, "report:export") && <a className="btn-secondary" href="/api/export/projects?format=xlsx">Export projects</a>} />
    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3 mb-4">
      <Stat label="Projects" value={s.totals.total} /><Stat label="Active" value={s.totals.active} /><Stat label="On track" value={s.totals.onTrack} tone="#34c759" /><Stat label="At risk / off" value={`${s.totals.atRisk} / ${s.totals.offTrack}`} tone="#ff9f0a" />
      {fin && <><Stat label="Approved investment" value={money(s.totals.approved, c, "en", true)} /><Stat label="Actual" value={money(s.totals.actual, c, "en", true)} /><Stat label="Forecast (EAC)" value={money(s.totals.forecast, c, "en", true)} tone={s.totals.forecast.greaterThan(s.totals.approved) ? "#ff3b30" : undefined} /><Stat label="Committed" value={money(s.totals.committed, c, "en", true)} /></>}
    </div>
    <div className="grid lg:grid-cols-4 gap-4 mb-4">
      <Card title="Health"><Donut height={150} data={s.byHealth.map((h) => ({ ...h, color: { GREEN: "#34c759", AMBER: "#ff9f0a", RED: "#ff3b30" }[h.name] }))} /></Card>
      {fin && <Card title="CAPEX vs OPEX"><Bars height={170} data={[{ name: "CAPEX", Approved: Number(s.totals.capexApproved), Actual: Number(s.totals.capexActual) }, { name: "OPEX", Approved: Number(s.totals.opexApproved), Actual: Number(s.totals.opexActual) }]} bars={[{ key: "Approved", color: "#c7c7cc" }, { key: "Actual", color: "#0a84ff" }]} /></Card>}
      <Card title="Resource demand (next 90 days)"><div className="text-3xl font-semibold">{Math.round(demandHours).toLocaleString()} h</div><div className="text-sm muted">vs {Math.round(capacityHours).toLocaleString()} h capacity of {people} allocated people</div><div className="mt-3 text-sm" style={{ color: demandHours > capacityHours ? "#ff3b30" : "#34c759" }}>{capacityHours ? Math.round((demandHours / capacityHours) * 100) : 0}% utilisation</div></Card>
      <Card title="Risk exposure"><div className="text-3xl font-semibold">{raid.openRisks}</div><div className="text-sm muted">open risks · {raid.highRisks} high · {raid.overdueRisks} overdue</div><div className="text-sm mt-2">{raid.criticalIssues} critical issues · {raid.unresolvedDeps} unresolved dependencies</div></Card>
    </div>
    <Card title="Strategic alignment" className="mb-4" pad={false}><table className="table"><thead><tr><th>Objective</th><th>Projects</th><th>Average progress</th></tr></thead><tbody>{objectives.map((o) => <tr key={o.id}><td><b>{o.code}</b> {o.title}</td><td>{o.projects.length}</td><td>{o.projects.length ? Math.round(o.projects.reduce((a, x) => a + x.project.progress, 0) / o.projects.length) : 0}%</td></tr>)}</tbody></table></Card>
    <Prioritisation criteria={crit} ranked={JSON.parse(JSON.stringify(ranked))} canEdit={can(ctx, "portfolio:manage")} />
    <Card title="Projects" pad={false} className="my-4"><table className="table"><thead><tr><th>Project</th><th>Program</th><th>Health</th><th>Status</th><th>Progress</th>{fin && <><th className="text-end">Approved</th><th className="text-end">Actual</th><th className="text-end">EAC</th><th>CPI</th></>}</tr></thead>
      <tbody>{s.projects.map((p) => <tr key={p.id}><td><Link className="text-accent" href={`/projects/${p.key}`}>{p.name}</Link>{p.delayed && <Chip color="#ff3b30">Delayed</Chip>}</td><td className="text-xs">{p.program?.name}</td><td><Health h={p.health} /></td><td className="text-xs">{p.status}</td><td>{p.progress}%</td>
        {fin && <><td className="text-end text-xs">{money(p.fin.approved, c, "en", true)}</td><td className="text-end text-xs">{money(p.fin.actual, c, "en", true)}</td><td className="text-end text-xs" style={{ color: p.fin.eac.greaterThan(p.fin.approved) ? "#ff3b30" : undefined }}>{money(p.fin.eac, c, "en", true)}</td><td className="text-xs">{p.fin.cpi?.toString() ?? "—"}</td></>}</tr>)}</tbody></table></Card>
    <Scenarios portfolioId={pf.id} projects={JSON.parse(JSON.stringify(ranked))} saved={JSON.parse(JSON.stringify(scenarios))} canEdit={can(ctx, "portfolio:manage")} currency={c} />
  </>);
}
