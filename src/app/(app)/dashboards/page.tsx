import Link from "next/link";
import { requireCtx, pagePermission, can } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { portfolioSummary, issueStats, raidSummary, governanceCompliance } from "@/lib/services/metrics";
import { PageHeader, Stat, Card, Health, Chip, Empty } from "@/components/ui/bits";
import { Bars, Donut, Lines } from "@/components/charts/charts";
import { money, date } from "@/lib/format";

const VIEWS = { executive: "Executive", pmo: "PMO", pm: "Project manager" } as const;
type View = keyof typeof VIEWS;

export default async function Dashboards({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const ctx = await requireCtx(); pagePermission(ctx, "report:view");
  const v = (await searchParams).view;
  const view: View = v === "pmo" || v === "pm" ? v : v === "executive" ? "executive" : ctx.roleKey === "PROJECT_MANAGER" ? "pm" : ctx.roleKey === "PMO_ADMIN" ? "pmo" : "executive";
  return (<>
    <PageHeader title="Dashboards" subtitle="Live figures from projects, issues, budgets and approvals." actions={<div className="inline-flex rounded-lg bg-black/5 dark:bg-white/10 p-0.5">{(Object.keys(VIEWS) as View[]).map((k) => <Link key={k} href={`?view=${k}`} className={`px-3 h-8 inline-flex items-center text-sm rounded-md ${view === k ? "bg-[var(--card)] shadow-sm font-medium" : ""}`}>{VIEWS[k]}</Link>)}</div>} />
    {view === "executive" ? <Executive /> : view === "pmo" ? <Pmo /> : <Pm />}
  </>);
}

async function Executive() {
  const ctx = await requireCtx();
  const [s, raid, gov] = await Promise.all([portfolioSummary(ctx), raidSummary(ctx), governanceCompliance(ctx)]);
  const fin = can(ctx, "finance:view"); const c = ctx.workspace.currency; const M = (x: unknown) => money(x, c, "en", true);
  const byPortfolio = Object.values(s.projects.reduce<Record<string, { name: string; GREEN: number; AMBER: number; RED: number; Other: number }>>((a, p) => {
    const k = p.portfolio?.name ?? "Unassigned"; a[k] ??= { name: k, GREEN: 0, AMBER: 0, RED: 0, Other: 0 };
    if (p.status === "ACTIVE") a[k][p.health as "GREEN"]++; else a[k].Other++; return a; }, {}));
  const delayed = s.projects.filter((p) => p.delayed || p.health === "RED");
  return (<>
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-4">
      <Stat label="Active projects" value={s.totals.active} sub={`${s.totals.total} in portfolio`} />
      <Stat label="On track" value={s.totals.onTrack} tone="#34c759" sub={`${s.totals.atRisk} at risk · ${s.totals.offTrack} off track`} />
      <Stat label="Delayed" value={s.totals.delayed} tone={s.totals.delayed ? "#ff3b30" : undefined} />
      {fin && <Stat label="Approved investment" value={M(s.totals.approved)} sub={`${M(s.totals.actual)} spent`} />}
      {fin && <Stat label="Forecast at completion" value={M(s.totals.forecast)} tone={s.totals.forecast.greaterThan(s.totals.approved) ? "#ff3b30" : "#34c759"} />}
      <Stat label="Governance compliance" value={`${gov.compliancePct}%`} tone={gov.compliancePct < 90 ? "#ff9f0a" : "#34c759"} />
    </div>
    <div className="grid lg:grid-cols-3 gap-4 mb-4">
      <Card title="Health by portfolio" className="lg:col-span-2"><Bars data={byPortfolio} stacked height={220} bars={[{ key: "GREEN", label: "On track", color: "#34c759" }, { key: "AMBER", label: "At risk", color: "#ff9f0a" }, { key: "RED", label: "Off track", color: "#ff3b30" }, { key: "Other", label: "Not active", color: "#c7c7cc" }]} /></Card>
      <Card title="Projects by status"><Donut data={s.byStatus} height={170} /></Card>
    </div>
    <div className="grid lg:grid-cols-2 gap-4">
      <Card title="Needs executive attention" pad={false}>{delayed.length ? <table className="table"><thead><tr><th>Project</th><th>Health</th><th>Planned end</th>{fin && <th className="text-end">EAC vs approved</th>}</tr></thead><tbody>{delayed.map((p) => <tr key={p.id}><td><Link className="text-accent" href={`/projects/${p.key}`}>{p.name}</Link>{p.delayed && <Chip color="#ff3b30">Delayed</Chip>}</td><td><Health h={p.health} /></td><td className="text-xs">{date(p.plannedEndDate)}</td>{fin && <td className="text-end text-xs" style={{ color: p.fin.eac.greaterThan(p.fin.approved) ? "#ff3b30" : undefined }}>{M(p.fin.eac.minus(p.fin.approved))}</td>}</tr>)}</tbody></table> : <Empty title="Nothing off track" />}</Card>
      <Card title="Top risks" pad={false}>{raid.risks.length ? <table className="table"><thead><tr><th>Risk</th><th>Project</th><th>Score</th></tr></thead><tbody>{raid.risks.slice(0, 8).map((r) => <tr key={r.id}><td className="text-sm">{r.title}</td><td><Link className="text-accent text-xs" href={`/projects/${r.project.key}/raid`}>{r.project.key}</Link></td><td><Chip color={raid.band(r.score).color}>{r.score}</Chip></td></tr>)}</tbody></table> : <Empty title="No open risks" />}</Card>
    </div>
  </>);
}

async function Pmo() {
  const ctx = await requireCtx();
  const [gov, raid, stats, crs] = await Promise.all([
    governanceCompliance(ctx), raidSummary(ctx), issueStats(ctx),
    prisma.changeRequest.groupBy({ by: ["status"], where: { project: { workspaceId: ctx.workspaceId } }, _count: true }),
  ]);
  const exByKind = Object.entries(gov.exceptions.reduce<Record<string, number>>((a, e) => { a[e.kind] = (a[e.kind] ?? 0) + 1; return a; }, {})).map(([name, value]) => ({ name, value }));
  const stageCounts = Object.entries(gov.projects.reduce<Record<string, number>>((a, p) => { const k = p.lifecycleStage?.name ?? "—"; a[k] = (a[k] ?? 0) + 1; return a; }, {})).map(([name, value]) => ({ name, value }));
  return (<>
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-4">
      <Stat label="Compliance" value={`${gov.compliancePct}%`} tone={gov.compliancePct < 90 ? "#ff9f0a" : "#34c759"} />
      <Stat label="Exceptions" value={gov.exceptions.length} tone={gov.exceptions.length ? "#ff3b30" : undefined} />
      <Stat label="Approvals in progress" value={gov.actionable.length} />
      <Stat label="High risks" value={raid.highRisks} tone={raid.highRisks ? "#ff3b30" : undefined} sub={`${raid.overdueRisks} past target date`} />
      <Stat label="Overdue actions" value={raid.overdueActions} />
      <Stat label="Open show-stoppers" value={stats.openShowStoppers.length} tone={stats.openShowStoppers.length ? "#ff3b30" : "#34c759"} />
    </div>
    <div className="grid lg:grid-cols-3 gap-4 mb-4">
      <Card title="Exceptions by type">{exByKind.length ? <Bars data={exByKind} horizontal height={220} bars={[{ key: "value", label: "Exceptions", color: "#ff9f0a" }]} /> : <Empty title="No exceptions" />}</Card>
      <Card title="Projects by lifecycle stage"><Bars data={stageCounts} horizontal height={220} bars={[{ key: "value", label: "Projects", color: "#5856d6" }]} /></Card>
      <Card title="Change requests"><Donut data={crs.map((c) => ({ name: c.status, value: c._count }))} height={170} /></Card>
    </div>
    <Card title="Governance exceptions" pad={false}><table className="table"><thead><tr><th>Project</th><th>Type</th><th>Detail</th><th>Severity</th></tr></thead><tbody>{gov.exceptions.map((e, i) => <tr key={i}><td><Link className="text-accent" href={`/projects/${e.projectKey}/governance`}>{e.projectKey}</Link></td><td className="text-sm">{e.kind}</td><td className="text-xs">{e.detail}</td><td><Chip color={e.severity === "high" ? "#ff3b30" : "#ff9f0a"}>{e.severity}</Chip></td></tr>)}</tbody></table></Card>
  </>);
}

async function Pm() {
  const ctx = await requireCtx();
  const mine = await prisma.project.findMany({ where: { workspaceId: ctx.workspaceId, archivedAt: null, OR: [{ managerId: ctx.user.id }, { members: { some: { userId: ctx.user.id, projectRole: "Manager" } } }] }, select: { id: true } });
  const ids = mine.map((p) => p.id);
  if (!ids.length) return <Empty title="You don't manage any projects">This view lists projects where you are the project manager. Switch to the Executive or PMO view above.</Empty>;
  const [s, stats, raid, milestones, sprints] = await Promise.all([
    portfolioSummary(ctx, { id: { in: ids } }), issueStats(ctx, ids), raidSummary(ctx, ids),
    prisma.milestone.findMany({ where: { projectId: { in: ids }, completedAt: null, dueDate: { lte: new Date(Date.now() + 45 * 86400000) } }, include: { project: { select: { key: true } } }, orderBy: { dueDate: "asc" } }),
    prisma.sprint.findMany({ where: { projectId: { in: ids }, state: "ACTIVE" }, include: { project: { select: { key: true } }, _count: { select: { issues: true } } } }),
  ]);
  const fin = can(ctx, "finance:view"); const M = (x: unknown) => money(x, ctx.workspace.currency, "en", true);
  return (<>
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-4">
      <Stat label="My projects" value={s.totals.total} />
      <Stat label="Open issues" value={stats.totalOpen} sub={`${stats.unassigned} unassigned`} />
      <Stat label="Overdue issues" value={stats.overdue} tone={stats.overdue ? "#ff3b30" : undefined} />
      <Stat label="Open bugs" value={stats.openBugs} />
      <Stat label="Open risks" value={raid.openRisks} sub={`${raid.highRisks} high`} />
      <Stat label="Milestones next 45 days" value={milestones.length} tone={milestones.some((m) => m.dueDate < new Date()) ? "#ff3b30" : undefined} />
    </div>
    <Card title="My projects" pad={false} className="mb-4"><table className="table"><thead><tr><th>Project</th><th>Health</th><th>Progress</th><th>Stage</th>{fin && <><th className="text-end">Spent</th><th>CPI</th><th>SPI</th></>}</tr></thead>
      <tbody>{s.projects.map((p) => <tr key={p.id}><td><Link className="text-accent" href={`/projects/${p.key}`}>{p.name}</Link></td><td><Health h={p.health} /></td><td>{p.progress}%</td><td className="text-xs">{p.status}</td>{fin && <><td className="text-end text-xs">{M(p.fin.actual)} / {M(p.fin.approved)}</td><td className="text-xs">{p.fin.cpi?.toString() ?? "—"}</td><td className="text-xs">{p.fin.spi?.toString() ?? "—"}</td></>}</tr>)}</tbody></table></Card>
    <div className="grid lg:grid-cols-3 gap-4">
      <Card title="Created vs resolved (30 days)" className="lg:col-span-2"><Lines data={stats.trend} height={200} lines={[{ key: "created", label: "Created", color: "#0a84ff" }, { key: "resolved", label: "Resolved", color: "#34c759" }]} /></Card>
      <Card title="Upcoming milestones" pad={false}>{milestones.length ? <ul className="divide-y divide-line">{milestones.map((m) => <li key={m.id} className="px-4 py-2 text-sm flex justify-between"><span><b className="text-xs">{m.project.key}</b> {m.name}</span><span className="text-xs" style={{ color: m.dueDate < new Date() ? "#ff3b30" : undefined }}>{date(m.dueDate)}</span></li>)}</ul> : <Empty title="None due" />}</Card>
    </div>
    {sprints.length > 0 && <Card title="Active sprints" pad={false} className="mt-4"><table className="table"><tbody>{sprints.map((sp) => <tr key={sp.id}><td><Link className="text-accent" href={`/projects/${sp.project.key}/backlog`}>{sp.project.key} · {sp.name}</Link></td><td className="text-xs">{date(sp.startDate)} → {date(sp.endDate)}</td><td className="text-xs">{sp._count.issues} issues</td><td className="text-xs muted">{sp.goal}</td></tr>)}</tbody></table></Card>}
  </>);
}
