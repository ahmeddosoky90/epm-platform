import Link from "next/link";
import { requireCtx } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { issueStats } from "@/lib/services/metrics";
import { projectScope } from "@/lib/services/access";
import { Card, PageHeader, Stat, Chip, Priority, Empty } from "@/components/ui/bits";
import { Bars, Donut, Lines } from "@/components/charts/charts";
import { date } from "@/lib/format";

export default async function Home() {
  const ctx = await requireCtx();
  const stats = await issueStats(ctx);
  const [mine, milestones] = await Promise.all([
    prisma.issue.findMany({ where: { assigneeId: ctx.user.id, deletedAt: null, status: { category: { not: "DONE" } }, project: projectScope(ctx) }, include: { status: true, project: { select: { key: true } }, type: true }, orderBy: [{ dueDate: "asc" }], take: 8 }),
    prisma.milestone.findMany({ where: { project: { ...projectScope(ctx), archivedAt: null }, completedAt: null, dueDate: { lte: new Date(Date.now() + 45 * 86400000) } }, include: { project: { select: { key: true, name: true } } }, orderBy: { dueDate: "asc" }, take: 8 }),
  ]);
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: ctx.workspace.timezone }).format(new Date()));
  return (
    <>
      <PageHeader title={`Good ${hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening"}, ${ctx.user.name.split(" ")[0]}`} subtitle={`${ctx.roleName} · ${ctx.workspace.name}`} />
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <Stat label="Open tickets" value={stats.totalOpen} sub={`${stats.unassigned} unassigned`} />
        <Stat label="Open bugs" value={stats.openBugs} tone="#ff9f0a" />
        <Stat label="Show-stoppers open" value={stats.openShowStoppers.length} tone={stats.openShowStoppers.length ? "#ff3b30" : undefined} sub={`${stats.showStoppersTotal} raised in total`} />
        <Stat label="Overdue" value={stats.overdue} tone={stats.overdue ? "#ff3b30" : undefined} />
        <Stat label="Assigned to me" value={mine.length} />
      </div>
      <div className="grid lg:grid-cols-3 gap-4 mb-4">
        <Card title="Tasks by status"><Bars horizontal data={stats.byStatus} bars={[{ key: "value", label: "Issues" }]} colors={stats.byStatus.map((s) => s.color)} /></Card>
        <Card title="Open tickets by type"><Donut data={stats.openByType} /></Card>
        <Card title="Open bugs by severity"><Bars data={stats.bugsBySeverity} bars={[{ key: "value", label: "Bugs" }]} colors={["#ff3b30", "#ff9f0a", "#ffcc00", "#34c759", "#8e8e93"]} /></Card>
      </div>
      <div className="grid lg:grid-cols-3 gap-4 mb-4">
        <Card title="Created vs resolved (30 days)" className="lg:col-span-2"><Lines data={stats.trend} lines={[{ key: "created", label: "Created", color: "#0a84ff" }, { key: "resolved", label: "Resolved", color: "#34c759" }, { key: "bugs", label: "Bugs raised", color: "#ff3b30", dashed: true }]} /></Card>
        <Card title="Open work by priority"><Bars data={stats.byPriority} bars={[{ key: "value", label: "Issues" }]} colors={["#ff3b30", "#ff453a", "#ff9f0a", "#0a84ff", "#8e8e93"]} /></Card>
      </div>
      <div className="grid lg:grid-cols-3 gap-4">
        <Card title="Open show-stoppers" action={<Link className="text-xs text-accent" href={`/search?jql=${encodeURIComponent("showStopper = true AND statusCategory != Done")}`}>View all</Link>} pad={false}>
          {stats.openShowStoppers.length === 0 ? <Empty title="No open show-stoppers" /> :
            <ul>{stats.openShowStoppers.slice(0, 8).map((i) => <li key={i.id} className="px-4 py-2.5 border-t border-line text-sm flex gap-2 items-center"><Link className="font-medium text-accent shrink-0" href={`/issues/${i.key}`}>{i.key}</Link><span className="truncate flex-1">{i.summary}</span><Chip color={i.status.color}>{i.status.name}</Chip></li>)}</ul>}
        </Card>
        <Card title="My open work" action={<Link className="text-xs text-accent" href="/my-work">All</Link>} pad={false}>
          {mine.length === 0 ? <Empty title="Nothing assigned to you" /> :
            <ul>{mine.map((i) => <li key={i.id} className="px-4 py-2.5 border-t border-line text-sm flex gap-2 items-center"><Link className="font-medium text-accent shrink-0" href={`/issues/${i.key}`}>{i.key}</Link><span className="truncate flex-1">{i.summary}</span><Priority p={i.priority} /></li>)}</ul>}
        </Card>
        <Card title="Upcoming milestones (45 days)" pad={false}>
          {milestones.length === 0 ? <Empty title="No milestones due soon" /> :
            <ul>{milestones.map((m) => <li key={m.id} className="px-4 py-2.5 border-t border-line text-sm flex gap-2 items-center"><Link href={`/projects/${m.project.key}`} className="text-accent shrink-0">{m.project.key}</Link><span className="truncate flex-1">{m.name}</span><span className={m.dueDate < new Date() ? "text-[#ff3b30] text-xs" : "muted text-xs"}>{date(m.dueDate, ctx.workspace.timezone)}</span></li>)}</ul>}
        </Card>
      </div>
    </>
  );
}
