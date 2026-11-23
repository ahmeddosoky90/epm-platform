import Link from "next/link";
import { requireCtx, can, pagePermission } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { portfolioSummary } from "@/lib/services/metrics";
import { PageHeader, Card, Health, Progress } from "@/components/ui/bits";
import { CreateSimple } from "@/components/portfolio/create-simple";
import { money } from "@/lib/format";
export const metadata = { title: "Programs" };
export default async function Programs() {
  const ctx = await requireCtx(); pagePermission(ctx, "portfolio:view");
  const [programs, s] = await Promise.all([prisma.program.findMany({ where: { workspaceId: ctx.workspaceId }, include: { portfolio: true }, orderBy: { name: "asc" } }), portfolioSummary(ctx)]);
  return (<><PageHeader title="Programs" subtitle="Groups of related projects delivering a shared outcome" actions={can(ctx, "portfolio:manage") && <CreateSimple kind="program" />} />
    <div className="space-y-4">{programs.map((pg) => { const ps = s.projects.filter((p) => p.programId === pg.id); const prog = ps.length ? Math.round(ps.reduce((a, p) => a + p.progress, 0) / ps.length) : 0;
      return <Card key={pg.id} title={<span>{pg.name} <span className="muted font-normal text-xs">· {pg.portfolio?.name ?? "No portfolio"}</span></span>} action={<span className="text-xs muted">{ps.length} projects · {prog}% avg progress</span>} pad={false}>
        <table className="table"><tbody>{ps.map((p) => <tr key={p.id}><td><Link href={`/projects/${p.key}`} className="text-accent">{p.name}</Link></td><td><Health h={p.health} /></td><td className="w-40"><Progress value={p.progress} /></td><td className="text-xs">{p.status}</td>{can(ctx, "finance:view") && <td className="text-xs text-end">{money(p.fin.actual, p.currency, "en", true)} / {money(p.fin.approved, p.currency, "en", true)}</td>}</tr>)}</tbody></table>
      </Card>; })}</div></>);
}
