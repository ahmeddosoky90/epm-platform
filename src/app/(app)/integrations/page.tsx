import Link from "next/link";
import { requireCtx, can } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { mailStatus } from "@/lib/services/mail";
import { projectScope } from "@/lib/services/access";
import { mailConfigured, mailProvider } from "@/lib/integrations/mail";
import { PageHeader, Card, Chip } from "@/components/ui/bits";
import { Mailbox, SmtpTest } from "@/components/integrations/mailbox";

export const metadata = { title: "Mail & files" };

export default async function IntegrationsPage() {
  const ctx = await requireCtx();
  const [status, projects, types] = await Promise.all([
    mailStatus(ctx),
    prisma.project.findMany({ where: { AND: [projectScope(ctx), { archivedAt: null }] }, select: { key: true, name: true }, orderBy: { key: "asc" } }),
    prisma.issueType.findMany({ where: { workspaceId: ctx.workspaceId, level: { lt: 3 } }, select: { id: true, name: true }, orderBy: [{ level: "desc" }, { name: "asc" }] }),
  ]);
  const admin = can(ctx, "integration:manage");
  const driver = process.env.STORAGE_DRIVER === "s3" ? "S3-compatible object storage" : "Local disk on the server";
  return (<>
    <PageHeader title="Mail & files" subtitle="Connect your own mailbox to turn emails into issues, and reach files on servers through the technical portal." />
    <Mailbox status={JSON.parse(JSON.stringify(status))} projects={projects} types={types} canCreate={can(ctx, "issue:create")} />
    <div className="grid lg:grid-cols-3 gap-4 mt-6">
      <Card title="Outgoing mail (notifications)">
        <div className="text-sm flex items-center gap-2">{mailConfigured() ? <Chip color="#34c759">Configured</Chip> : <Chip color="#8e8e93">Not configured</Chip>}</div>
        <p className="text-xs muted mt-2">{mailConfigured() ? `Assignment, mention, approval and reminder emails are sent through ${mailProvider() === "brevo" ? "the Brevo email API" : "the SMTP relay"} set on the server.` : "Notifications are shown in the app only. A server administrator sets BREVO_API_KEY or SMTP_HOST to enable email."}</p>
        {admin && mailConfigured() && <SmtpTest email={ctx.user.email} />}
      </Card>
      <Card title="Document storage">
        <div className="text-sm">{driver}</div>
        <p className="text-xs muted mt-2">Attachments and project documents are stored here with versioning. Executables and active content are rejected on upload.</p>
      </Card>
      <Card title="Remote files">
        <p className="text-sm">Browse, upload and download files on SSH/SFTP servers from the technical portal.</p>
        {can(ctx, "tech:access") ? <Link href="/tech" className="btn-secondary btn-sm mt-3 inline-flex">Open technical portal</Link> : <p className="text-xs muted mt-2">Your role does not include technical portal access.</p>}
      </Card>
    </div>
  </>);
}
