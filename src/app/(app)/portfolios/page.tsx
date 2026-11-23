import Link from "next/link";
import { requireCtx, can, pagePermission } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { portfolioSummary } from "@/lib/services/metrics";
import { PageHeader, Stat, Card, Progress } from "@/components/ui/bits";
import { Donut, Bars } from "@/components/charts/charts";
import { CreateSimple } from "@/components/portfolio/create-simple";
import { money } from "@/lib/format";

export const metadata = { title: "Portfolios" };
export default async function Portfolios() {
  const ctx = await requireCtx(); pagePermission(ctx, "portfolio:view");
  const [s, portfolios] = await Promise.all([portfolioSummary(ctx), prisma.portfolio.findMany({ where: { workspaceId: ctx.workspaceId }, include: { programs: true } })]);
  const c = ctx.workspace.currency; const fin = can(ctx, "finance:view");
  return (<>
    <PageHeader title="Portfolios" subtitle="Enterprise portfolio overview from live project data" actions={can(ctx, "portfolio:manage") && <CreateSimple kind="portfolio" />} />
    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3 mb-6">
      <Stat label="Projects" value={s.totals.total} /><Stat label="Active" value={s.totals.active} /><Stat label="Completed" value={s.totals.completed} /><Stat label="On track" value={s.totals.onTrack} tone="#34c759" />
      <Stat label="At risk" value={s.totals.atRisk} tone="#ff9f0a" /><Stat label="Off track" value={s.totals.offTrack} tone="#ff3b30" /><Stat label="Delayed" value={s.totals.delayed} tone={s.totals.delayed ? "#ff3b30" : undefined} /><Stat label="On hold" value={s.totals.onHold} />
    </div>
    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
      {portfolios.map((pf) => { const ps = s.projects.filter((p) => p.portfolioId === pf.id); const approved = ps.reduce((a, p) => a + Number(p.fin.approved), 0); const actual = ps.reduce((a, p) => a + Number(p.fin.actual), 0);
        return <Link key={pf.id} href={`/portfolios/${pf.id}`} className="card p-5 hover:border-accent transition block">
          <h3 className="font-semibold mb-1">{pf.name}</h3><p className="text-xs muted mb-4 line-clamp-2">{pf.description}</p>
          <div className="grid grid-cols-3 gap-2 text-center mb-4"><div><div className="text-xl font-semibold">{ps.length}</div><div className="text-[11px] muted">projects</div></div><div><div className="text-xl font-semibold">{pf.programs.length}</div><div className="text-[11px] muted">programs</div></div><div><div className="text-xl font-semibold" style={{ color: ps.some((p) => p.health === "RED" && p.status === "ACTIVE") ? "#ff3b30" : undefined }}>{ps.filter((p) => p.status === "ACTIVE" && p.health !== "GREEN").length}</div><div className="text-[11px] muted">at risk</div></div></div>
          {fin && <><div className="flex justify-between text-xs mb-1"><span>{money(actual, c, "en", true)} spent</span><span className="muted">of {money(approved, c, "en", true)}</span></div><Progress value={approved ? (actual / approved) * 100 : 0} /></>}
        </Link>; })}
    </div>
    <div className="grid lg:grid-cols-3 gap-4 mt-6">
      <Card title="Project health"><Donut data={s.byHealth.map((h) => ({ ...h, color: { GREEN: "#34c759", AMBER: "#ff9f0a", RED: "#ff3b30" }[h.name] }))} /></Card>
      <Card title="Projects by business unit"><Bars data={s.byBU} bars={[{ key: "value", label: "Projects" }]} horizontal /></Card>
      <Card title="Projects by methodology"><Donut data={s.byMethodology} /></Card>
    </div>
  </>);
}
