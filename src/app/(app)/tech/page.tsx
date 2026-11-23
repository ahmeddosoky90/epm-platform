import { requireCtx, pagePermission, can } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { listConnections } from "@/lib/services/tech";
import { PageHeader, Card } from "@/components/ui/bits";
import { TechPortal } from "@/components/tech/portal";
import { dateTime } from "@/lib/format";

export const metadata = { title: "Technical portal" };
export default async function TechPage() {
  const ctx = await requireCtx(); pagePermission(ctx, "tech:access");
  const [connections, sessions] = await Promise.all([
    listConnections(ctx),
    prisma.techSession.findMany({ where: { connection: { workspaceId: ctx.workspaceId }, ...(can(ctx, "tech:manage") ? {} : { userId: ctx.user.id }) }, include: { connection: { select: { name: true, protocol: true } } }, orderBy: { startedAt: "desc" }, take: 25 }),
  ]);
  const users = await prisma.user.findMany({ where: { id: { in: [...new Set(sessions.map((s) => s.userId))] } }, select: { id: true, name: true } });
  return (<>
    <PageHeader title="Technical portal" subtitle="SSH terminal and SFTP in the browser, RDP through your own client. Restricted to authorised roles; every session is audited." />
    <TechPortal connections={JSON.parse(JSON.stringify(connections))} canManage={can(ctx, "tech:manage")} />
    <Card title="Recent sessions" className="mt-6" pad={false}>
      {sessions.length ? <table className="table"><thead><tr><th>Started</th><th>Connection</th><th>User</th><th>Duration</th><th>Data</th><th>Outcome</th></tr></thead>
        <tbody>{sessions.map((s) => <tr key={s.id}><td className="text-xs">{dateTime(s.startedAt, ctx.workspace.timezone)}</td><td className="text-sm">{s.connection.name}</td><td className="text-xs">{users.find((u) => u.id === s.userId)?.name}</td>
          <td className="text-xs">{s.endedAt ? `${Math.max(1, Math.round((s.endedAt.getTime() - s.startedAt.getTime()) / 60000))} min` : "open"}</td><td className="text-xs">{Math.round((s.bytesIn + s.bytesOut) / 1024)} KB</td><td className="text-xs">{s.outcome ?? "—"}</td></tr>)}</tbody></table>
        : <p className="p-4 text-sm muted">No sessions yet.</p>}
    </Card>
  </>);
}
