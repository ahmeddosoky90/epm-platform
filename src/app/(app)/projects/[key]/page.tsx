import Link from "next/link";
import { requireCtx, can } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { loadProject, canManageProject } from "@/lib/services/access";
import { projectFinancials, issueStats } from "@/lib/services/metrics";
import { Card, Stat, Progress, Health, Chip, Avatar, Empty } from "@/components/ui/bits";
import { Donut } from "@/components/charts/charts";
import { money, date, ago } from "@/lib/format";
import { riskBand } from "@/lib/calc/risk";
import { ProjectActions } from "@/components/projects/actions";

export default async function ProjectOverview({ params }: { params: Promise<{ key: string }> }) {
  const ctx = await requireCtx(); const p = await loadProject(ctx, (await params).key);
  const [full, fin, stats, milestones, risks, raid, allocations, activity, reports, deps, stages] = await Promise.all([
    prisma.project.findUniqueOrThrow({ where: { id: p.id }, include: { portfolio: true, program: true, objectives: { include: { objective: true } }, members: { include: { user: { select: { id: true, name: true, jobTitle: true } } } } } }),
    projectFinancials([p.id]).then((m) => m.get(p.id)!),
    issueStats(ctx, [p.id]),
    prisma.milestone.findMany({ where: { projectId: p.id }, orderBy: { dueDate: "asc" } }),
    prisma.risk.findMany({ where: { projectId: p.id, status: { not: "CLOSED" } }, orderBy: { score: "desc" }, take: 5 }),
    prisma.raidItem.findMany({ where: { projectId: p.id, kind: "ISSUE", status: "OPEN" }, take: 5 }),
    prisma.resourceAllocation.findMany({ where: { projectId: p.id }, include: { resource: true } }),
    prisma.issueHistory.findMany({ where: { issue: { projectId: p.id } }, orderBy: { createdAt: "desc" }, take: 12, include: { issue: { select: { key: true } } } }),
    prisma.statusReport.findMany({ where: { projectId: p.id }, orderBy: { createdAt: "desc" }, take: 3 }),
    prisma.projectDependency.findMany({ where: { OR: [{ fromId: p.id }, { toId: p.id }] }, include: { from: { select: { key: true, name: true } }, to: { select: { key: true, name: true } } } }),
    prisma.lifecycleStage.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { sortOrder: "asc" } }),
  ]);
  const users = Object.fromEntries((await prisma.user.findMany({ where: { id: { in: [...new Set([...activity.map((a) => a.userId), p.managerId ?? ""])] } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]));
  const now = new Date(); const tz = ctx.workspace.timezone; const cur = p.currency;
  const overdueMs = milestones.filter((m) => !m.completedAt && m.dueDate < now);
  const upcoming = milestones.filter((m) => !m.completedAt && m.dueDate >= now).slice(0, 5);
  const showFin = can(ctx, "finance:view") || canManageProject(ctx, p);
  return (
    <div className="space-y-4">
      <ProjectActions project={{ id: p.id, key: p.key, name: p.name, description: p.description, health: p.health, status: p.status, progress: p.progress, lifecycleStageId: p.lifecycleStageId, plannedEndDate: p.plannedEndDate?.toISOString().slice(0, 10) ?? "", startDate: p.startDate?.toISOString().slice(0, 10) ?? "", archived: !!p.archivedAt }}
        stages={stages.map((s) => ({ id: s.id, name: s.name, requiresApproval: s.requiresApproval }))} canEdit={canManageProject(ctx, p) && !p.archivedAt} canArchive={can(ctx, "project:archive")} />
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-4">
        <Stat label="Progress" value={`${p.progress}%`} sub={<Progress value={p.progress} />} />
        <Stat label="Open issues" value={stats.totalOpen} sub={`${stats.openBugs} bugs · ${stats.overdue} overdue`} />
        <Stat label="Show-stoppers" value={stats.openShowStoppers.length} tone={stats.openShowStoppers.length ? "#ff3b30" : undefined} />
        <Stat label="Open risks" value={risks.length} sub={`${risks.filter((r) => r.score >= 8).length} high`} />
        {showFin && <Stat label="Actual vs approved" value={`${fin.burnPercent.toString()}%`} sub={`${money(fin.actual, cur, "en", true)} of ${money(fin.approved, cur, "en", true)}`} />}
        {showFin && <Stat label="Forecast variance" value={money(fin.forecastVariance, cur, "en", true)} tone={fin.forecastVariance.isNegative() ? "#ff3b30" : "#34c759"} sub={`EAC ${money(fin.eac, cur, "en", true)}`} />}
      </div>
      <div className="grid lg:grid-cols-3 gap-4">
        <Card title="Summary" className="lg:col-span-2">
          <p className="text-sm text-ink-2 whitespace-pre-wrap mb-4">{p.description || "No description."}</p>
          <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 text-sm">
            {[
              ["Manager", users[p.managerId ?? ""] ?? "—"], ["Sponsor", p.sponsor ?? "—"], ["Business owner", p.businessOwner ?? "—"],
              ["Portfolio", full.portfolio ? <Link className="text-accent" href={`/portfolios/${full.portfolio.id}`}>{full.portfolio.name}</Link> : "—"], ["Program", full.program?.name ?? "—"], ["Business unit", p.businessUnit ?? "—"],
              ["Methodology", p.methodology], ["Priority", p.priority], ["Complexity", p.complexity ?? "—"],
              ["Planned", `${date(p.startDate, tz)} → ${date(p.plannedEndDate, tz)}`], ["Actual", `${date(p.actualStartDate, tz)} → ${date(p.actualEndDate, tz)}`],
              ["Objectives", full.objectives.map((o) => o.objective.code).join(", ") || "—"],
            ].map(([k, v], i) => <div key={i}><dt className="text-xs muted">{k}</dt><dd className="font-medium">{v}</dd></div>)}
          </dl>
        </Card>
        <Card title="Issues by status"><Donut data={stats.byStatus} /></Card>
      </div>
      <div className="grid lg:grid-cols-3 gap-4">
        <Card title="Milestones" pad={false}>
          {overdueMs.length > 0 && <div className="px-4 pb-2 text-xs text-[#ff3b30]">{overdueMs.length} overdue</div>}
          {milestones.length === 0 ? <Empty title="No milestones" /> : <ul>{[...overdueMs, ...upcoming].slice(0, 7).map((m) => {
            const slip = m.baselineDate ? Math.round((m.dueDate.getTime() - m.baselineDate.getTime()) / 86400000) : 0;
            return <li key={m.id} className="px-4 py-2 border-t border-line text-sm flex items-center gap-2"><span className="flex-1 truncate">{m.name}</span>{slip > 0 && <Chip color="#ff9f0a">+{slip}d slip</Chip>}<span className={m.dueDate < now ? "text-xs text-[#ff3b30]" : "text-xs muted"}>{date(m.dueDate, tz)}</span></li>;
          })}</ul>}
        </Card>
        <Card title="Top risks & issues" pad={false} action={<Link href={`/projects/${p.key}/raid`} className="text-xs text-accent">RAID log</Link>}>
          {risks.length + raid.length === 0 ? <Empty title="Nothing open" /> : <ul>
            {risks.map((r) => <li key={r.id} className="px-4 py-2 border-t border-line text-sm flex items-center gap-2"><Chip color={riskBand(r.score).color}>R{r.number} · {r.score}</Chip><span className="truncate">{r.title}</span></li>)}
            {raid.map((r) => <li key={r.id} className="px-4 py-2 border-t border-line text-sm flex items-center gap-2"><Chip color="#ff453a">Issue</Chip><span className="truncate">{r.title}</span></li>)}
          </ul>}
        </Card>
        <Card title="Dependencies" pad={false}>
          {deps.length === 0 ? <Empty title="No cross-project dependencies" /> : <ul>{deps.map((d) => <li key={d.id} className="px-4 py-2 border-t border-line text-sm"><div className="flex items-center gap-2"><span className="font-medium">{d.from.key}</span>→<span className="font-medium">{d.to.key}</span><Chip color={d.status === "AT_RISK" ? "#ff9f0a" : "#8e8e93"}>{d.status}</Chip></div><div className="text-xs muted truncate">{d.description}</div></li>)}</ul>}
        </Card>
      </div>
      <div className="grid lg:grid-cols-3 gap-4">
        <Card title="Team & allocation" pad={false}>
          <ul>{full.members.map((m) => { const a = allocations.filter((x) => x.resource.userId === m.user.id).reduce((s, x) => s + x.percent, 0);
            return <li key={m.id} className="px-4 py-2 border-t border-line text-sm flex items-center gap-2"><Avatar name={m.user.name} size={22} /><span className="flex-1 truncate">{m.user.name}<span className="muted text-xs"> · {m.projectRole}</span></span>{a > 0 && <span className="text-xs muted">{a}%</span>}</li>; })}
            {allocations.filter((a) => !a.resource.userId).map((a) => <li key={a.id} className="px-4 py-2 border-t border-line text-sm flex items-center gap-2"><Avatar name={a.resource.name} size={22} /><span className="flex-1 truncate">{a.resource.name}<span className="muted text-xs"> · {a.role}</span></span><span className="text-xs muted">{a.percent}%</span></li>)}</ul>
        </Card>
        <Card title="Status reports" pad={false}>
          {reports.length === 0 ? <Empty title="No status reports yet" /> : <ul>{reports.map((r) => <li key={r.id} className="px-4 py-2.5 border-t border-line text-sm"><div className="flex items-center gap-2 mb-0.5"><Health h={r.health} /><span className="text-xs muted">{date(r.createdAt, tz)}</span></div><div>{r.summary}</div>{r.nextSteps && <div className="text-xs muted mt-0.5">Next: {r.nextSteps}</div>}</li>)}</ul>}
        </Card>
        <Card title="Recent activity" pad={false}>
          {activity.length === 0 ? <Empty title="No activity" /> : <ul>{activity.map((a) => <li key={a.id} className="px-4 py-2 border-t border-line text-xs"><span className="font-medium">{users[a.userId] ?? "Someone"}</span> {a.field === "created" ? "created" : a.field === "status" ? `moved to ${a.toValue}` : `updated ${a.field} on`} <Link className="text-accent" href={`/issues/${a.issue.key}`}>{a.issue.key}</Link> <span className="muted">· {ago(a.createdAt)}</span></li>)}</ul>}
        </Card>
      </div>
    </div>
  );
}
