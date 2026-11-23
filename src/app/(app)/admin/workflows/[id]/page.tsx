import { requireCtx, pagePermission } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { workflowDetail } from "@/lib/services/admin";
import { WorkflowEditor } from "@/components/admin/workflow-editor";

export default async function WorkflowPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireCtx(); pagePermission(ctx, "admin:workflows");
  const wf = await workflowDetail(ctx, (await params).id);
  const [roles, history] = await Promise.all([
    prisma.role.findMany({ where: { workspaceId: ctx.workspaceId }, select: { key: true, name: true }, orderBy: { name: "asc" } }),
    prisma.auditLog.findMany({ where: { entityType: "Workflow", entityId: wf.id }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  return <WorkflowEditor wf={JSON.parse(JSON.stringify(wf))} roles={roles} history={JSON.parse(JSON.stringify(history))} />;
}
