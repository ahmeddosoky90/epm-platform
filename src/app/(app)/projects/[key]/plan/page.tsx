import { requireCtx, can } from "@/lib/auth";
import { getPlan } from "@/lib/services/plan";
import { canManageProject } from "@/lib/services/access";
import { Gantt } from "@/components/plan/gantt";

export default async function PlanPage({ params }: { params: Promise<{ key: string }> }) {
  const ctx = await requireCtx();
  const { key } = await params;
  const plan = await getPlan(ctx, key);
  const canEdit = can(ctx, "plan:edit") && canManageProject(ctx, plan.project) && !plan.project.archivedAt;
  return <Gantt projectKey={plan.project.key} tasks={JSON.parse(JSON.stringify(plan.tasks))} deps={JSON.parse(JSON.stringify(plan.deps))} baselines={JSON.parse(JSON.stringify(plan.baselines))} canEdit={canEdit} now={Date.now()} />;
}
