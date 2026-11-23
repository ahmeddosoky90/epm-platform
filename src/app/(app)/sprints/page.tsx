import Link from "next/link";
import { requireCtx } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { projectScope } from "@/lib/services/access";
import { PageHeader, Empty, Chip, Card } from "@/components/ui/bits";
import { date } from "@/lib/format";

const COLOR: Record<string, string> = { ACTIVE: "#0a84ff", FUTURE: "#8e8e93", CLOSED: "#34c759", CANCELLED: "#ff3b30" };
export default async function Sprints({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  const ctx = await requireCtx();
  const state = (await searchParams).state ?? "ACTIVE";
  const sprints = await prisma.sprint.findMany({ where: { project: { AND: [projectScope(ctx), { archivedAt: null }] }, ...(state === "ALL" ? {} : { state }) }, include: { project: { select: { key: true, name: true } }, issues: { where: { deletedAt: null }, select: { storyPoints: true, status: { select: { category: true } } } } }, orderBy: [{ startDate: "desc" }] });
  return (<><PageHeader title="Sprints" subtitle="Sprints across your projects" actions={<div className="inline-flex rounded-lg bg-black/5 dark:bg-white/10 p-0.5">{["ACTIVE", "FUTURE", "CLOSED", "ALL"].map((s) => <Link key={s} href={`?state=${s}`} className={`px-3 h-8 inline-flex items-center text-sm rounded-md capitalize ${state === s ? "bg-[var(--card)] shadow-sm font-medium" : ""}`}>{s.toLowerCase()}</Link>)}</div>} />
    {!sprints.length ? <Empty title="No sprints in this state" /> : <Card pad={false}><table className="table"><thead><tr><th>Sprint</th><th>Project</th><th>State</th><th>Dates</th><th>Goal</th><th className="text-end">Done / committed points</th></tr></thead>
      <tbody>{sprints.map((s) => { const total = s.issues.reduce((a, i) => a + Number(i.storyPoints ?? 0), 0); const done = s.issues.filter((i) => i.status.category === "DONE").reduce((a, i) => a + Number(i.storyPoints ?? 0), 0);
        return <tr key={s.id}><td><Link className="text-accent" href={`/projects/${s.project.key}/backlog`}>{s.name}</Link></td><td className="text-xs">{s.project.key} · {s.project.name}</td><td><Chip color={COLOR[s.state]}>{s.state.toLowerCase()}</Chip></td><td className="text-xs">{date(s.startDate)} → {date(s.endDate)}</td><td className="text-xs muted max-w-xs truncate">{s.goal}</td><td className="text-end text-sm">{done} / {total}</td></tr>; })}</tbody></table></Card>}
  </>);
}
