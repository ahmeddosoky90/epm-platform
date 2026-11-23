import Link from "next/link";
import { requireCtx, can } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { governanceCompliance } from "@/lib/services/metrics";
import { PageHeader, Card, Stat, Chip, Empty } from "@/components/ui/bits";
import { Bars } from "@/components/charts/charts";
import { ApprovalActions } from "@/components/governance/approval-actions";
import { date } from "@/lib/format";

export const metadata = { title: "Governance" };
export default async function GovernancePage() {
  const ctx = await requireCtx();
  const g = await governanceCompliance(ctx);
  const members = (await prisma.workspaceMember.findMany({ where: { workspaceId: ctx.workspaceId }, include: { user: { select: { id: true, name: true } } } })).map((m) => m.user);
  const isSuper = ctx.permissions.includes("*");
  const mine = g.actionable.filter((a) => isSuper || a.approverRole === ctx.roleKey || a.approverId === ctx.user.id);
  const stageCounts = Object.values(g.projects.reduce<Record<string, { name: string; value: number }>>((acc, p) => { const n = p.lifecycleStage?.name ?? "—"; acc[n] ??= { name: n, value: 0 }; acc[n].value++; return acc; }, {}));
  const kinds = Object.entries(g.exceptions.reduce<Record<string, number>>((a, e) => { a[e.kind] = (a[e.kind] ?? 0) + 1; return a; }, {})).map(([name, value]) => ({ name, value }));
  return (
    <>
      <PageHeader title="Governance" subtitle="Stage gates, approvals and compliance across the portfolio" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Stat label="Governance compliance" value={`${g.compliancePct}%`} tone={g.compliancePct < 80 ? "#ff9f0a" : "#34c759"} sub="projects without high-severity exceptions" />
        <Stat label="Exceptions" value={g.exceptions.length} tone={g.exceptions.length ? "#ff3b30" : undefined} />
        <Stat label="Pending approvals (all)" value={g.actionable.length} />
        <Stat label="Waiting on you" value={mine.length} tone={mine.length ? "#0a84ff" : undefined} />
      </div>
      {can(ctx, "governance:approve") && <Card title="Approvals waiting on you" pad={false} className="mb-4">
        {mine.length === 0 ? <Empty title="Nothing waiting on you" /> : <table className="table"><thead><tr><th>Item</th><th>Project</th><th>Step</th><th>Submitted</th><th /></tr></thead><tbody>{mine.map((a) => {
          const proj = a.gate?.project ?? a.changeRequest?.project; const link = a.gate ? `/projects/${proj!.key}/governance` : `/projects/${proj!.key}/changes`;
          return <tr key={a.id}><td><Link className="text-accent" href={link}>{a.gate ? `Gate · ${a.gate.stage.name}` : `Change · ${a.changeRequest!.title}`}</Link></td><td>{proj!.name}</td><td className="text-xs">{a.step} · {a.approverRole.replace(/_/g, " ").toLowerCase()}</td><td className="text-xs">{date(a.gate?.submittedAt ?? a.changeRequest?.createdAt, ctx.workspace.timezone)}</td><td><ApprovalActions approvalId={a.id} members={members} /></td></tr>; })}</tbody></table>}
      </Card>}
      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <Card title="Projects by lifecycle stage"><Bars data={stageCounts} bars={[{ key: "value", label: "Projects", color: "#5856d6" }]} horizontal height={260} /></Card>
        <Card title="Exceptions by type"><Bars data={kinds} bars={[{ key: "value", label: "Exceptions", color: "#ff9f0a" }]} horizontal height={260} /></Card>
      </div>
      <Card title="Governance exceptions" pad={false}>
        {g.exceptions.length === 0 ? <Empty title="No exceptions — all projects are compliant" /> : <table className="table"><thead><tr><th>Project</th><th>Exception</th><th>Detail</th><th>Severity</th></tr></thead><tbody>{g.exceptions.map((e, i) => <tr key={i}><td><Link className="text-accent" href={`/projects/${e.projectKey}/governance`}>{e.projectKey}</Link> <span className="muted text-xs">{e.projectName}</span></td><td>{e.kind}</td><td className="text-xs">{e.detail}</td><td><Chip color={e.severity === "high" ? "#ff3b30" : "#ff9f0a"}>{e.severity}</Chip></td></tr>)}</tbody></table>}
      </Card>
    </>
  );
}
