import Link from "next/link";
import { requireCtx, pagePermission } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { auditQuery } from "@/lib/services/admin";
import { dateTime } from "@/lib/format";

type SP = Record<string, string | undefined>;
export default async function AuditPage({ searchParams }: { searchParams: Promise<SP> }) {
  const ctx = await requireCtx(); pagePermission(ctx, "audit:view");
  const sp = await searchParams;
  const r = await auditQuery(ctx, { q: sp.q, eventType: sp.eventType, userId: sp.userId, entityType: sp.entityType, from: sp.from, to: sp.to, page: Number(sp.page ?? 1) });
  const [users, types] = await Promise.all([
    prisma.workspaceMember.findMany({ where: { workspaceId: ctx.workspaceId }, include: { user: { select: { id: true, name: true } } } }),
    prisma.auditLog.groupBy({ by: ["entityType"], where: { workspaceId: ctx.workspaceId }, _count: true }),
  ]);
  const qs = (o: SP) => "?" + new URLSearchParams(Object.entries({ ...sp, ...o }).filter(([, v]) => v) as [string, string][]).toString();
  const pages = Math.ceil(r.total / 50);
  return (<>
    <form method="get" className="flex flex-wrap gap-2 mb-3">
      <input name="eventType" defaultValue={sp.eventType} className="input !w-44" placeholder="Event (e.g. auth., issue.)" aria-label="Event type prefix" />
      <select name="userId" defaultValue={sp.userId ?? ""} className="input !w-auto" aria-label="User"><option value="">Any user</option>{users.map((u) => <option key={u.userId} value={u.userId}>{u.user.name}</option>)}</select>
      <select name="entityType" defaultValue={sp.entityType ?? ""} className="input !w-auto" aria-label="Entity"><option value="">Any entity</option>{types.map((t) => <option key={t.entityType}>{t.entityType}</option>)}</select>
      <input type="date" name="from" defaultValue={sp.from} className="input !w-auto" aria-label="From" /><input type="date" name="to" defaultValue={sp.to} className="input !w-auto" aria-label="To" />
      <input name="q" defaultValue={sp.q} className="input !w-56" placeholder="Entity ID or text" aria-label="Search" />
      <button className="btn-primary">Filter</button>
      {r.canExport && <a className="btn-secondary" href={`/api/admin/audit${qs({ format: "xlsx", page: undefined })}`}>Export Excel</a>}
    </form>
    <p className="text-xs muted mb-2">{r.total.toLocaleString()} events. The log is append-only: the database rejects updates and deletes.</p>
    <div className="card overflow-x-auto"><table className="table">
      <thead><tr><th>Time</th><th>User</th><th>Event</th><th>Entity</th><th>IP</th><th>Change</th></tr></thead>
      <tbody>{r.items.map((i) => <tr key={i.id}>
        <td className="text-xs whitespace-nowrap">{dateTime(i.createdAt, ctx.workspace.timezone)}</td>
        <td className="text-xs">{i.userId ? r.users[i.userId] ?? "—" : "system"}</td>
        <td className="text-xs font-mono">{i.eventType}</td>
        <td className="text-xs">{i.entityType}{i.entityId && <span className="muted block font-mono text-[10px]">{i.entityId.slice(0, 8)}</span>}</td>
        <td className="text-xs">{i.ip ?? ""}</td>
        <td className="text-[11px] max-w-[460px]">{i.before != null && <div className="muted truncate" title={JSON.stringify(i.before)}>before: {JSON.stringify(i.before)}</div>}{i.after != null && <div className="truncate" title={JSON.stringify(i.after)}>after: {JSON.stringify(i.after)}</div>}</td>
      </tr>)}</tbody></table></div>
    {pages > 1 && <div className="flex justify-center gap-2 mt-3">{r.page > 1 && <Link className="btn-secondary btn-sm" href={qs({ page: String(r.page - 1) })}>Previous</Link>}<span className="text-sm self-center">Page {r.page} of {pages}</span>{r.page < pages && <Link className="btn-secondary btn-sm" href={qs({ page: String(r.page + 1) })}>Next</Link>}</div>}
  </>);
}
