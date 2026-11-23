import Link from "next/link";
import { requireCtx, requirePermission, can } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { projectScope } from "@/lib/services/access";
import { PageHeader, Card } from "@/components/ui/bits";

/** Report catalogue: every entry opens a live report or downloads an export built from current data. */
export default async function Reports() {
  const ctx = await requireCtx(); requirePermission(ctx, "report:view");
  const projects = await prisma.project.findMany({ where: { AND: [projectScope(ctx), { archivedAt: null }] }, select: { key: true, name: true, methodology: true }, orderBy: { key: "asc" } });
  const exp = can(ctx, "report:export"); const fin = can(ctx, "finance:view");
  const Row = ({ title, desc, links }: { title: string; desc: string; links: { label: string; href: string; dl?: boolean }[] }) => (
    <li className="flex items-start justify-between gap-4 py-3"><div><div className="font-medium text-sm">{title}</div><div className="text-xs muted">{desc}</div></div>
      <div className="flex gap-2 shrink-0">{links.map((l) => l.dl ? <a key={l.label} className="btn-secondary btn-sm" href={l.href}>{l.label}</a> : <Link key={l.label} className="btn-secondary btn-sm" href={l.href}>{l.label}</Link>)}</div></li>);
  return (<>
    <PageHeader title="Reports" subtitle="Live reports and exports. CSV and Excel files are generated from current data at download time." />
    <div className="grid lg:grid-cols-2 gap-4">
      <Card title="Portfolio & PMO"><ul className="divide-y divide-line">
        <Row title="Executive dashboard" desc="Health, investment, delayed projects and top risks" links={[{ label: "Open", href: "/dashboards?view=executive" }]} />
        <Row title="PMO governance" desc="Compliance, exceptions, approvals and lifecycle distribution" links={[{ label: "Open", href: "/dashboards?view=pmo" }, { label: "Governance", href: "/governance" }]} />
        <Row title="Roadmap" desc="Timeline of projects and milestones" links={[{ label: "Open", href: "/roadmap" }]} />
        {exp && <Row title="Project register" desc="All projects with status, health, dates and budget" links={[{ label: "Excel", href: "/api/export/projects?format=xlsx", dl: true }, { label: "CSV", href: "/api/export/projects?format=csv", dl: true }]} />}
        {can(ctx, "resource:view") && <Row title="Resource capacity" desc="Utilisation heatmap and over-allocation" links={[{ label: "Open", href: "/resources" }]} />}
      </ul></Card>
      <Card title="Delivery"><ul className="divide-y divide-line">
        <Row title="Issue search" desc="Any EQL query, saved filters and bulk export" links={[{ label: "Open", href: "/search" }]} />
        {exp && <Row title="Open bugs" desc="All unresolved bugs by severity" links={[{ label: "Excel", href: `/api/export/issues?format=xlsx&jql=${encodeURIComponent('type = Bug AND statusCategory != Done ORDER BY severity ASC')}`, dl: true }]} />}
        {exp && <Row title="Show-stoppers" desc="Every issue flagged as a show-stopper" links={[{ label: "Excel", href: `/api/export/issues?format=xlsx&jql=${encodeURIComponent("showStopper = true ORDER BY created DESC")}`, dl: true }]} />}
        {exp && <Row title="Overdue work" desc="Open issues past their due date" links={[{ label: "CSV", href: `/api/export/issues?format=csv&jql=${encodeURIComponent("dueDate < today() AND statusCategory != Done ORDER BY dueDate ASC")}`, dl: true }]} />}
      </ul></Card>
    </div>
    <Card title="Per project" className="mt-4" pad={false}><table className="table"><thead><tr><th>Project</th><th>Agile reports</th><th>Schedule</th>{fin && <th>Budget</th>}{exp && <th>Exports</th>}</tr></thead>
      <tbody>{projects.map((p) => <tr key={p.key}><td><b>{p.key}</b> <span className="text-sm">{p.name}</span></td>
        <td>{p.methodology !== "WATERFALL" ? <Link className="text-accent text-sm" href={`/projects/${p.key}/reports`}>Burndown, velocity, CFD…</Link> : <span className="text-xs muted">—</span>}</td>
        <td><Link className="text-accent text-sm" href={`/projects/${p.key}/plan`}>Gantt</Link> · <a className="text-accent text-sm" href={`/api/projects/${p.key}/plan/export`}>MS Project XML</a></td>
        {fin && <td><Link className="text-accent text-sm" href={`/projects/${p.key}/finance`}>Budget</Link>{exp && <> · <a className="text-accent text-sm" href={`/api/export/budget?projectId=${p.key}&format=xlsx`}>Excel</a></>}</td>}
        {exp && <td><a className="text-accent text-sm" href={`/api/export/issues?format=xlsx&jql=${encodeURIComponent(`project = ${p.key} ORDER BY created DESC`)}`}>Issues (Excel)</a></td>}</tr>)}</tbody></table></Card>
  </>);
}
