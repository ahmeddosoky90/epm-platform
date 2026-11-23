import { requireCtx } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader, Card } from "@/components/ui/bits";
import { ProfileForm, PasswordForm, MfaPanel, RevokeSessions } from "@/components/profile/profile";
import { dateTime } from "@/lib/format";

export const metadata = { title: "Profile & security" };
export default async function Profile() {
  const ctx = await requireCtx();
  const [u, sessions, events] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: ctx.user.id }, select: { name: true, email: true, jobTitle: true, locale: true, mfaEnabled: true, lastLoginAt: true, passwordChangedAt: true } }),
    prisma.session.findMany({ where: { userId: ctx.user.id, expiresAt: { gt: new Date() } }, orderBy: { lastSeenAt: "desc" } }),
    prisma.auditLog.findMany({ where: { userId: ctx.user.id, eventType: { startsWith: "auth." } }, orderBy: { createdAt: "desc" }, take: 15 }),
  ]);
  return (<>
    <PageHeader title="Profile & security" subtitle={`${ctx.roleName} in ${ctx.workspace.name}`} />
    <div className="grid lg:grid-cols-3 gap-4">
      <Card title="Profile"><ProfileForm user={u} /></Card>
      <Card title="Password"><PasswordForm /><p className="text-xs muted mt-3">Last changed {dateTime(u.passwordChangedAt)}</p></Card>
      <Card title="Two-step verification"><MfaPanel enabled={u.mfaEnabled} /></Card>
    </div>
    <div className="grid lg:grid-cols-2 gap-4 mt-4">
      <Card title="Active sessions" action={<RevokeSessions others={sessions.length - 1} />} pad={false}>
        <table className="table"><thead><tr><th>Device</th><th>IP</th><th>Last active</th></tr></thead><tbody>{sessions.map((s) => <tr key={s.id}><td className="text-xs max-w-[260px] truncate" title={s.userAgent ?? ""}>{s.userAgent?.slice(0, 60) ?? "Unknown"}{s.id === ctx.sessionId && <span className="chip ms-2">this device</span>}</td><td className="text-xs">{s.ip ?? "—"}</td><td className="text-xs">{dateTime(s.lastSeenAt)}</td></tr>)}</tbody></table>
      </Card>
      <Card title="Recent sign-in activity" pad={false}>
        <table className="table"><tbody>{events.map((e) => <tr key={e.id}><td className="text-xs">{e.eventType.replace("auth.", "").replace(/_/g, " ")}</td><td className="text-xs">{e.ip ?? ""}</td><td className="text-xs">{dateTime(e.createdAt)}</td></tr>)}</tbody></table>
      </Card>
    </div>
  </>);
}
