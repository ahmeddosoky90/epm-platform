import { requireCtx, can } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { DOC_CATEGORIES, listDocuments, traceability } from "@/lib/services/documents";
import { canManageProject } from "@/lib/services/access";
import { DocumentLibrary, Traceability } from "@/components/projects/documents";

export default async function DocumentsPage({ params }: { params: Promise<{ key: string }> }) {
  const ctx = await requireCtx();
  const { key } = await params;
  const { project: p, docs, gates, users } = await listDocuments(ctx, key);
  const [reqs, member, objectives] = await Promise.all([
    traceability(ctx, key),
    prisma.projectMember.findUnique({ where: { projectId_userId: { projectId: p.id, userId: ctx.user.id } } }),
    prisma.strategicObjective.findMany({ where: { workspaceId: ctx.workspaceId }, select: { code: true }, orderBy: { code: "asc" } }),
  ]);
  const manager = canManageProject(ctx, p);
  const contributor = !p.archivedAt && (manager || (!!member && member.projectRole !== "Viewer"));
  return (<>
    <DocumentLibrary projectKey={p.key} docs={JSON.parse(JSON.stringify(docs))} gates={gates} users={users} categories={DOC_CATEGORIES} me={ctx.user.id}
      canUpload={contributor} canApprove={!p.archivedAt && can(ctx, "document:manage")} canDelete={!p.archivedAt && (manager || can(ctx, "document:manage"))} />
    <div className="mt-8"><Traceability projectKey={p.key} reqs={JSON.parse(JSON.stringify(reqs))} canEdit={contributor} objectives={objectives.map((o) => o.code)} /></div>
  </>);
}
