import Link from "next/link";
import { requireCtx } from "@/lib/auth";
import { agileReports } from "@/lib/services/agile-reports";
import { Card, Stat, Chip, Empty } from "@/components/ui/bits";
import { Lines, Bars, Combo } from "@/components/charts/charts";

/* eslint-disable @typescript-eslint/no-explicit-any */
export default async function ProjectReports({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<{ sprint?: string }> }) {
  const ctx = await requireCtx(); const { key } = await params; const sp = await searchParams;
  const r = await agileReports(ctx, key, sp.sprint);
  const burnup = r.burn.map((b) => ({ date: b.date.slice(5), scope: b.scope, completed: b.completed }));
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap"><span className="text-sm muted">Sprint:</span>{r.sprints.length === 0 ? <span className="text-sm muted">No started sprints yet</span> : r.sprints.map((s) => <Link key={s.id} href={`?sprint=${s.id}`} className={`btn-sm ${s.id === r.sprint?.id ? "btn-primary" : "btn-secondary"}`}>{s.name}</Link>)}</div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Average velocity" value={`${r.velocity.average} pts`} sub={`${r.velocity.sprints.length} closed sprints`} />
        <Stat label="Avg cycle time" value={r.avgCycle != null ? `${r.avgCycle} d` : "—"} sub="In progress → done, 90 days" />
        <Stat label="Avg lead time" value={r.avgLead != null ? `${r.avgLead} d` : "—"} sub="Created → done" />
        <Stat label="Throughput (12 wks)" value={r.throughput.reduce((a, w) => a + w.throughput, 0)} sub="issues completed" />
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <Card title={`Sprint burndown${r.sprint ? ` · ${r.sprint.name}` : ""}`}><Lines data={r.burn.map((b) => ({ ...b, date: b.date.slice(5) }))} lines={[{ key: "remaining", label: "Remaining", color: "#0a84ff" }, { key: "ideal", label: "Ideal", color: "#8e8e93", dashed: true }]} /></Card>
        <Card title="Sprint burnup"><Lines data={burnup} lines={[{ key: "scope", label: "Scope", color: "#ff9f0a" }, { key: "completed", label: "Completed", color: "#34c759" }]} /></Card>
        <Card title="Velocity"><Combo data={r.velocity.sprints} bars={[{ key: "committed", label: "Committed", color: "#c7c7cc" }, { key: "completed", label: "Completed", color: "#0a84ff" }]} lines={[]} /></Card>
        <Card title="Cumulative flow (30 days)"><Lines area data={r.cfd as any} lines={[{ key: "Done", color: "#34c759" }, { key: "In Progress", color: "#0a84ff" }, { key: "To Do", color: "#c7c7cc" }]} /></Card>
        <Card title="Control chart (cycle time per issue, days)"><Lines data={r.control.map((c) => ({ date: c.date.slice(5), cycle: c.cycle, avg: r.avgCycle }))} lines={[{ key: "cycle", label: "Cycle time", color: "#5856d6" }, { key: "avg", label: "Average", color: "#ff9f0a", dashed: true }]} /></Card>
        <Card title="Weekly throughput"><Bars data={r.throughput} x="week" bars={[{ key: "throughput", label: "Issues done", color: "#34c759" }]} /></Card>
        <Card title="Epic burndown (story points)"><Bars data={r.epicBurn} bars={[{ key: "done", label: "Done", color: "#34c759" }, { key: "remaining", label: "Remaining", color: "#c7c7cc" }]} stacked /></Card>
        <Card title="Release burndown">{r.release.length === 0 ? <Empty title="No versions defined" /> : <table className="table"><thead><tr><th>Version</th><th>Release</th><th>Done / total</th><th>Remaining</th><th>Sprints needed*</th></tr></thead><tbody>{r.release.map((v) => <tr key={v.name}><td>{v.name}</td><td>{v.releaseDate?.toISOString().slice(0, 10) ?? "—"}</td><td>{v.done} / {v.total}</td><td>{v.remaining}</td><td>{v.sprintsNeeded ?? "—"}</td></tr>)}</tbody></table>}<p className="text-xs muted mt-2">*At average velocity.</p></Card>
      </div>
      {r.sprintReport && <Card title={`Sprint report · ${r.sprint?.name}`}>
        <p className="text-sm mb-3">{r.sprint?.goal} · committed {r.sprint?.committed} pts · added after start: {r.sprintReport.added.join(", ") || "none"} · removed: {r.sprintReport.removed.join(", ") || "none"}</p>
        <div className="grid md:grid-cols-2 gap-4">
          {(["completed", "notCompleted"] as const).map((k) => <div key={k}><h4 className="text-xs font-semibold mb-2">{k === "completed" ? "Completed" : "Not completed"} ({r.sprintReport![k].length})</h4>
            {(r.sprintReport![k] as any[]).map((i) => <div key={i.key} className="text-sm flex gap-2 py-0.5"><Link className="text-accent" href={`/issues/${i.key}`}>{i.key}</Link><span className="truncate flex-1">{i.summary}</span><Chip color="#8e8e93">{i.status}</Chip><span className="muted text-xs w-6">{i.points ? Number(i.points) : ""}</span></div>)}</div>)}
        </div>
      </Card>}
    </div>
  );
}
