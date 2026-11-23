import Link from "next/link";
import { requireCtx, requirePermission, can } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { capacityGrid } from "@/lib/services/resources";
import { projectScope } from "@/lib/services/access";
import { PageHeader, Stat, Card, Empty, Chip, Avatar } from "@/components/ui/bits";
import { Bars } from "@/components/charts/charts";
import { NewResource, ResourceRowActions } from "@/components/resources/resource-actions";
import { money } from "@/lib/format";

type SP = Record<string, string | undefined>;
const heat = (u: number) => (u === 0 ? "transparent" : u > 100 ? "#ff3b30" : u >= 85 ? "#ff9f0a" : u >= 50 ? "#34c759" : "#34c75966");

export default async function ResourcesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const ctx = await requireCtx(); requirePermission(ctx, "resource:view");
  const sp = await searchParams;
  const months = sp.months === "12" ? 12 : 6;
  const [grid, departments, members, projects, allSkills] = await Promise.all([
    capacityGrid(ctx, months, { departmentId: sp.dept, skill: sp.skill, q: sp.q }),
    prisma.department.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { name: "asc" } }),
    prisma.workspaceMember.findMany({ where: { workspaceId: ctx.workspaceId, user: { isActive: true } }, include: { user: { select: { id: true, name: true } } } }),
    prisma.project.findMany({ where: { AND: [projectScope(ctx), { archivedAt: null, status: { in: ["PROPOSED", "ACTIVE", "ON_HOLD"] } }] }, select: { id: true, key: true, name: true }, orderBy: { key: "asc" } }),
    prisma.resource.findMany({ where: { workspaceId: ctx.workspaceId }, select: { skills: true } }),
  ]);
  const skills = [...new Set(allSkills.flatMap((r) => r.skills))].sort();
  const manage = can(ctx, "resource:manage"); const fin = can(ctx, "finance:view");
  const over = grid.rows.filter((r) => r.overallocated);
  const under = grid.rows.filter((r) => r.currentUtil < 50);
  const avg = grid.rows.length ? Math.round(grid.rows.reduce((a, r) => a + r.currentUtil, 0) / grid.rows.length) : 0;
  const deptUtil = departments.map((d) => { const rs = grid.rows.filter((r) => r.departmentId === d.id); return { name: d.name, Allocated: Math.round(rs.reduce((a, r) => a + r.cells[0].allocatedHours, 0)), Available: Math.round(rs.reduce((a, r) => a + r.cells[0].availableHours, 0)) }; }).filter((d) => d.Available > 0);

  return (<>
    <PageHeader title="Resources" subtitle="Capacity uses the workspace calendar (working days, holidays) and recorded leave." actions={manage && <NewResource departments={departments} users={members.map((m) => m.user)} />} />
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
      <Stat label="People" value={grid.rows.length} />
      <Stat label="Average utilisation (this month)" value={`${avg}%`} />
      <Stat label="Over-allocated" value={over.length} tone={over.length ? "#ff3b30" : "#34c759"} sub={`in the next ${months} months`} />
      <Stat label="Under 50% this month" value={under.length} tone={under.length ? "#ff9f0a" : undefined} />
    </div>
    <form method="get" className="flex flex-wrap gap-2 mb-4">
      <input name="q" defaultValue={sp.q} className="input !w-56" placeholder="Search by name" aria-label="Search by name" />
      <select name="dept" defaultValue={sp.dept ?? ""} className="input !w-auto" aria-label="Department"><option value="">All departments</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
      <select name="skill" defaultValue={sp.skill ?? ""} className="input !w-auto" aria-label="Skill"><option value="">Any skill</option>{skills.map((s) => <option key={s}>{s}</option>)}</select>
      <select name="months" defaultValue={String(months)} className="input !w-auto" aria-label="Horizon"><option value="6">6 months</option><option value="12">12 months</option></select>
      <button className="btn-primary">Apply</button>
    </form>
    {!grid.rows.length ? <Empty title="No resources match">Add people with “New resource”, or clear the filters.</Empty> : (
      <Card title="Capacity heatmap" action={<span className="text-xs muted">Cell = % of available hours allocated · red &gt; 100%</span>} pad={false} className="mb-4 overflow-x-auto">
        <table className="table min-w-[900px]">
          <thead><tr><th>Person</th><th>Department</th><th>Skills</th>{fin && <th className="text-end">Rate / h</th>}{grid.buckets.map((b) => <th key={b} className="text-center">{b}</th>)}<th /></tr></thead>
          <tbody>{grid.rows.map((r) => (
            <tr key={r.id}>
              <td><div className="flex items-center gap-2"><Avatar name={r.name} /><div><div className="font-medium">{r.name}{r.overallocated && <Chip color="#ff3b30">over</Chip>}</div><div className="text-[11px] muted">{r.jobTitle ?? "—"} · {r.employmentType}{r.leaves.some((l) => l.endDate >= new Date()) ? " · leave booked" : ""}</div></div></div></td>
              <td className="text-xs">{r.department?.name ?? "—"}</td>
              <td className="text-xs max-w-[180px]"><div className="flex flex-wrap gap-1">{r.skills.map((s) => <Link key={s} href={`?skill=${encodeURIComponent(s)}`} className="chip !text-[10px]">{s}</Link>)}</div></td>
              {fin && <td className="text-end text-xs">{money(r.hourlyRate, ctx.workspace.currency)}</td>}
              {r.cells.map((c, i) => <td key={i} className="text-center text-xs p-1"><div title={`${c.allocatedHours} h allocated of ${c.availableHours} h available`} className="rounded-md py-1.5" style={{ background: heat(c.utilisation), color: c.utilisation > 100 ? "#fff" : undefined }}>{c.utilisation ? `${Math.round(c.utilisation)}%` : "—"}</div></td>)}
              <td><ResourceRowActions id={r.id} name={r.name} projects={projects} canManage={manage} canLeave={manage || r.userId === ctx.user.id}
                allocations={r.allocations.map((a) => ({ id: a.id, projectKey: a.project.key, percent: a.percent, start: a.startDate.toISOString().slice(0, 10), end: a.endDate.toISOString().slice(0, 10), role: a.role }))} /></td>
            </tr>))}</tbody>
        </table>
      </Card>)}
    <div className="grid lg:grid-cols-2 gap-4">
      <Card title="This month by department (hours)">{deptUtil.length ? <Bars data={deptUtil} height={220} bars={[{ key: "Available", color: "#c7c7cc" }, { key: "Allocated", color: "#0a84ff" }]} /> : <Empty title="No department data" />}</Card>
      <Card title="Over-allocation detail" pad={false}>{over.length ? <table className="table"><thead><tr><th>Person</th><th>Peak month</th><th>Projects</th></tr></thead><tbody>{over.map((r) => { const i = r.cells.reduce((m, c, j) => (c.utilisation > r.cells[m].utilisation ? j : m), 0); return <tr key={r.id}><td>{r.name}</td><td>{grid.buckets[i]} · <b style={{ color: "#ff3b30" }}>{Math.round(r.cells[i].utilisation)}%</b></td><td className="text-xs">{r.allocations.map((a) => `${a.project.key} ${a.percent}%`).join(", ")}</td></tr>; })}</tbody></table> : <Empty title="Nobody is over-allocated" />}</Card>
    </div>
  </>);
}
