import Link from "next/link";
import { requireCtx, can } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { projectScope } from "@/lib/services/access";
import { PageHeader, Health, Chip, Progress, Avatar, STATUS_LABEL, Empty } from "@/components/ui/bits";
import { NewProjectButton } from "@/components/projects/new-project";
import { money, date } from "@/lib/format";
import type { Prisma } from "@prisma/client";

export const metadata = { title: "Projects" };

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const ctx = await requireCtx(); const sp = await searchParams;
  const where: Prisma.ProjectWhereInput = { AND: [projectScope(ctx), sp.archived ? { archivedAt: { not: null } } : { archivedAt: null },
    sp.status ? { status: sp.status } : {}, sp.portfolio ? { portfolioId: sp.portfolio } : {}, sp.pm ? { managerId: sp.pm } : {}, sp.bu ? { businessUnit: sp.bu } : {},
    sp.q ? { OR: [{ name: { contains: sp.q, mode: "insensitive" } }, { key: { contains: sp.q.toUpperCase() } }] } : {}] };
  const page = Math.max(1, Number(sp.page ?? 1)), size = 25;
  const [projects, total, portfolios, pms] = await Promise.all([
    prisma.project.findMany({ where, include: { portfolio: true, program: true, lifecycleStage: true }, orderBy: { name: "asc" }, take: size, skip: (page - 1) * size }),
    prisma.project.count({ where }),
    prisma.portfolio.findMany({ where: { workspaceId: ctx.workspaceId } }),
    prisma.user.findMany({ where: { memberships: { some: { workspaceId: ctx.workspaceId } } }, select: { id: true, name: true } }),
  ]);
  const mgrIds = [...new Set(projects.map((p) => p.managerId).filter(Boolean))] as string[];
  const managers = Object.fromEntries((await prisma.user.findMany({ where: { id: { in: mgrIds } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]));
  const qs = (o: Record<string, string | undefined>) => "?" + new URLSearchParams(Object.entries({ ...sp, ...o }).filter(([, v]) => v) as [string, string][]).toString();
  return (
    <>
      <PageHeader title="Projects" subtitle={`${total} ${sp.archived ? "archived" : "active and proposed"} projects you can access`} actions={can(ctx, "project:create") && <NewProjectButton />} />
      <form className="flex flex-wrap gap-2 mb-4" action="/projects">
        <input name="q" defaultValue={sp.q} placeholder="Filter by name or key" className="input !w-60" />
        <select name="status" defaultValue={sp.status ?? ""} className="input !w-40"><option value="">All statuses</option>{Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select name="portfolio" defaultValue={sp.portfolio ?? ""} className="input !w-60"><option value="">All portfolios</option>{portfolios.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <select name="pm" defaultValue={sp.pm ?? ""} className="input !w-48"><option value="">All managers</option>{pms.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <button className="btn-secondary">Apply</button>
        <Link href={sp.archived ? "/projects" : "/projects?archived=1"} className="btn-ghost">{sp.archived ? "Show active" : "Show archived"}</Link>
      </form>
      <div className="card overflow-x-auto">
        {projects.length === 0 ? <Empty title="No projects match">Try clearing filters{can(ctx, "project:create") ? " or create a new project" : ""}.</Empty> :
        <table className="table">
          <thead><tr><th>Project</th><th>Key</th><th>Status</th><th>Health</th><th>Stage</th><th>Manager</th><th>Portfolio / Program</th><th className="w-36">Progress</th><th>Budget</th><th>End</th></tr></thead>
          <tbody>{projects.map((p) => (
            <tr key={p.id}>
              <td><Link href={`/projects/${p.key}`} className="font-medium hover:text-accent">{p.name}</Link></td>
              <td className="muted">{p.key}</td>
              <td><Chip color="#8e8e93">{STATUS_LABEL[p.status] ?? p.status}</Chip></td>
              <td><Health h={p.health} /></td>
              <td className="text-xs">{p.lifecycleStage?.name ?? "—"}</td>
              <td><span className="flex items-center gap-2"><Avatar name={managers[p.managerId ?? ""]} size={20} /><span className="text-xs">{managers[p.managerId ?? ""] ?? "—"}</span></span></td>
              <td className="text-xs"><div>{p.portfolio?.name ?? "—"}</div><div className="muted">{p.program?.name}</div></td>
              <td><div className="flex items-center gap-2"><Progress value={p.progress} /><span className="text-xs muted w-8">{p.progress}%</span></div></td>
              <td className="text-xs whitespace-nowrap">{money(p.approvedBudget, p.currency, ctx.user.locale, true)}</td>
              <td className="text-xs whitespace-nowrap">{date(p.plannedEndDate, ctx.workspace.timezone)}</td>
            </tr>))}</tbody>
        </table>}
      </div>
      {total > size && <div className="flex justify-end gap-2 mt-3">{page > 1 && <Link className="btn-secondary btn-sm" href={qs({ page: String(page - 1) })}>Previous</Link>}<span className="text-xs muted self-center">Page {page} of {Math.ceil(total / size)}</span>{page * size < total && <Link className="btn-secondary btn-sm" href={qs({ page: String(page + 1) })}>Next</Link>}</div>}
    </>
  );
}
