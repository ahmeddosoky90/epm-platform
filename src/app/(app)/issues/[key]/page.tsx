import { notFound } from "next/navigation";
import { requireCtx, can } from "@/lib/auth";
import { getIssueDetail } from "@/lib/services/issues";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/db";
import { IssueView } from "@/components/issues/issue-view";

export default async function IssuePage({ params }: { params: Promise<{ key: string }> }) {
  const ctx = await requireCtx();
  let d;
  try { d = await getIssueDetail(ctx, (await params).key); } catch (e) { if (e instanceof AppError && e.status === 404) notFound(); throw e; }
  const [members, types, sprints, versions, projects] = await Promise.all([
    prisma.workspaceMember.findMany({ where: { workspaceId: ctx.workspaceId, user: { isActive: true } }, include: { user: { select: { id: true, name: true } } } }),
    prisma.issueType.findMany({ where: { workspaceId: ctx.workspaceId } }),
    prisma.sprint.findMany({ where: { projectId: d.issue.projectId, state: { in: ["FUTURE", "ACTIVE"] } } }),
    prisma.version.findMany({ where: { projectId: d.issue.projectId } }),
    prisma.project.findMany({ where: { workspaceId: ctx.workspaceId, archivedAt: null }, select: { key: true, name: true } }),
  ]);
  const data = JSON.parse(JSON.stringify({ ...d, members: members.map((m) => m.user), types, sprints, versions, projects, me: ctx.user.id, tz: ctx.workspace.timezone,
    perms: { edit: can(ctx, "issue:edit") && !d.issue.project.archivedAt, del: can(ctx, "issue:delete"), comment: can(ctx, "issue:comment"), transition: can(ctx, "issue:transition") } }));
  return <IssueView data={data} />;
}
