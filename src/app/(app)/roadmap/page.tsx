import Link from "next/link";
import { requireCtx } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { projectScope } from "@/lib/services/access";
import { PageHeader, Card, Empty, HEALTH } from "@/components/ui/bits";
import { date } from "@/lib/format";

type SP = Record<string, string | undefined>;
const DAY = 86400000;

/** Portfolio roadmap: every in-scope project on one timeline, grouped, with milestones and gates. */
export default async function Roadmap({ searchParams }: { searchParams: Promise<SP> }) {
  const ctx = await requireCtx();
  const sp = await searchParams;
  const group = sp.group === "program" || sp.group === "bu" ? sp.group : "portfolio";
  const where = {
    AND: [projectScope(ctx), { archivedAt: null },
      sp.portfolio ? { portfolioId: sp.portfolio } : {},
      sp.status ? { status: sp.status as never } : { status: { not: "CANCELLED" as const } },
      sp.health ? { health: sp.health as never } : {}],
  };
  const [projects, portfolios] = await Promise.all([
    prisma.project.findMany({ where, orderBy: [{ startDate: "asc" }], include: { portfolio: { select: { name: true } }, program: { select: { name: true } }, milestones: { orderBy: { dueDate: "asc" } }, lifecycleStage: { select: { name: true } } } }),
    prisma.portfolio.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { name: "asc" } }),
  ]);
  const dated = projects.filter((p) => p.startDate && p.plannedEndDate);
  const undated = projects.filter((p) => !p.startDate || !p.plannedEndDate);

  // Timeline range snaps to whole quarters around the data
  const min = Math.min(...dated.map((p) => p.startDate!.getTime()), Date.now());
  const max = Math.max(...dated.map((p) => p.plannedEndDate!.getTime()), Date.now() + 90 * DAY);
  const s0 = new Date(min); const start = new Date(Date.UTC(s0.getUTCFullYear(), Math.floor(s0.getUTCMonth() / 3) * 3, 1));
  const e0 = new Date(max); const end = new Date(Date.UTC(e0.getUTCFullYear(), Math.floor(e0.getUTCMonth() / 3) * 3 + 3, 1));
  const span = end.getTime() - start.getTime();
  const pct = (d: Date) => ((d.getTime() - start.getTime()) / span) * 100;
  const quarters: { label: string; left: number; width: number }[] = [];
  for (let d = new Date(start); d < end; d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 3, 1))) {
    const n = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 3, 1));
    quarters.push({ label: `Q${Math.floor(d.getUTCMonth() / 3) + 1} ${d.getUTCFullYear()}`, left: pct(d), width: pct(n) - pct(d) });
  }
  const today = pct(new Date());
  const keyOf = (p: (typeof projects)[number]) => (group === "program" ? p.program?.name : group === "bu" ? p.businessUnit : p.portfolio?.name) ?? "Unassigned";
  const groups = [...new Set(dated.map(keyOf))].sort();
  const q = (o: SP) => "?" + new URLSearchParams(Object.entries({ ...sp, ...o }).filter(([, v]) => v) as [string, string][]).toString();

  return (<>
    <PageHeader title="Roadmap" subtitle="All projects you can see, on one timeline. Diamonds are milestones; the red line is today." />
    <form className="flex flex-wrap gap-2 mb-4" method="get">
      <select name="portfolio" defaultValue={sp.portfolio ?? ""} className="input !w-auto" aria-label="Portfolio"><option value="">All portfolios</option>{portfolios.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
      <select name="status" defaultValue={sp.status ?? ""} className="input !w-auto" aria-label="Status"><option value="">Any status (not cancelled)</option>{["PROPOSED", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"].map((s) => <option key={s}>{s}</option>)}</select>
      <select name="health" defaultValue={sp.health ?? ""} className="input !w-auto" aria-label="Health"><option value="">Any health</option>{["GREEN", "AMBER", "RED"].map((s) => <option key={s}>{s}</option>)}</select>
      <select name="group" defaultValue={group} className="input !w-auto" aria-label="Group by"><option value="portfolio">Group by portfolio</option><option value="program">Group by program</option><option value="bu">Group by business unit</option></select>
      <button className="btn-primary">Apply</button>
      {(sp.portfolio || sp.status || sp.health) && <Link className="btn-secondary" href={q({ portfolio: undefined, status: undefined, health: undefined })}>Clear</Link>}
    </form>
    {!dated.length ? <Empty title="No dated projects match">Projects need a start and planned end date to appear on the roadmap.</Empty> : (
      <Card pad={false} className="overflow-x-auto">
        <div className="min-w-[900px]">
          <div className="flex border-b border-line sticky top-0 bg-[var(--card)] z-10">
            <div className="w-64 shrink-0 px-4 py-2 text-xs muted">Project</div>
            <div className="relative flex-1 h-8">{quarters.map((x) => <div key={x.label} className="absolute top-0 h-full border-s border-line text-[11px] muted px-1 pt-2" style={{ left: `${x.left}%`, width: `${x.width}%` }}>{x.label}</div>)}</div>
          </div>
          {groups.map((g) => (
            <div key={g}>
              <div className="px-4 py-1.5 text-xs font-semibold bg-black/[.03] dark:bg-white/5">{g}</div>
              {dated.filter((p) => keyOf(p) === g).map((p) => {
                const l = pct(p.startDate!), w = Math.max(0.6, pct(p.plannedEndDate!) - l);
                const col = p.status === "ACTIVE" ? HEALTH[p.health].color : p.status === "COMPLETED" ? "#8e8e93" : "#5856d6";
                return (
                  <div key={p.id} className="flex border-b border-line/60 hover:bg-black/[.02] dark:hover:bg-white/[.03]">
                    <div className="w-64 shrink-0 px-4 py-2 min-w-0"><Link href={`/projects/${p.key}`} className="text-sm text-accent truncate block">{p.name}</Link><div className="text-[11px] muted truncate">{p.key} · {p.lifecycleStage?.name ?? p.status}</div></div>
                    <div className="relative flex-1 h-12">
                      {quarters.map((x) => <div key={x.label} className="absolute top-0 h-full border-s border-line/50" style={{ left: `${x.left}%` }} />)}
                      <div className="absolute top-0 h-full w-px bg-[#ff3b30]" style={{ left: `${today}%` }} />
                      <div title={`${p.name}: ${date(p.startDate)} → ${date(p.plannedEndDate)} · ${p.progress}%`} className="absolute top-3 h-6 rounded-md overflow-hidden" style={{ left: `${l}%`, width: `${w}%`, background: col + "33", border: `1px solid ${col}` }}>
                        <div className="h-full" style={{ width: `${p.progress}%`, background: col + "aa" }} />
                        <span className="absolute inset-0 px-2 text-[11px] leading-6 truncate">{p.progress}%</span>
                      </div>
                      {p.milestones.filter((m) => m.dueDate >= start && m.dueDate <= end).map((m) => {
                        const late = !m.completedAt && m.dueDate < new Date();
                        return <div key={m.id} title={`${m.name} · ${date(m.dueDate)}${m.completedAt ? " · done" : late ? " · overdue" : ""}`} className="absolute top-[34px] h-2.5 w-2.5 rotate-45 -translate-x-1/2" style={{ left: `${pct(m.dueDate)}%`, background: m.completedAt ? "#34c759" : late ? "#ff3b30" : "#0a84ff" }} />;
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </Card>
    )}
    {undated.length > 0 && <Card title="Not on the timeline (missing dates)" className="mt-4"><div className="flex flex-wrap gap-2">{undated.map((p) => <Link key={p.id} href={`/projects/${p.key}`} className="chip">{p.key} · {p.name}</Link>)}</div></Card>}
  </>);
}
