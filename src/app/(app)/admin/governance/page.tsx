import { requireCtx, pagePermission } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ConfigTable } from "@/components/admin/config-table";

export default async function GovernanceAdmin() {
  const ctx = await requireCtx(); pagePermission(ctx, "admin:workspace");
  const [stages, gates, criteria, roles] = await Promise.all([
    prisma.lifecycleStage.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { sortOrder: "asc" } }),
    prisma.governanceStageDef.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { sortOrder: "asc" } }),
    prisma.priorityCriterion.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { sortOrder: "asc" } }),
    prisma.role.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { name: "asc" } }),
  ]);
  const J = <T,>(x: T) => JSON.parse(JSON.stringify(x));
  const total = criteria.reduce((a, c) => a + Number(c.weight), 0);
  return (<>
    <ConfigTable entity="lifecycleStage" title="Lifecycle stages" note="Entering a stage marked “requires approval” needs governance approval rights" rows={J(stages)} fields={[{ key: "name", label: "Stage", required: true }, { key: "sortOrder", label: "Order", type: "number" }, { key: "requiresApproval", label: "Requires approval", type: "checkbox" }]} />
    <ConfigTable entity="gate" title="Stage gates" note="Approvers act in the listed order. New gates are added to every open project." rows={J(gates)} fields={[{ key: "name", label: "Gate", required: true }, { key: "checklist", label: "Checklist (one per line)", type: "list" }, { key: "approverRoles", label: "Approver roles (in order)", type: "multiselect", options: roles.map((r) => ({ value: r.key, label: r.name })) }, { key: "validityDays", label: "Valid for (days)", type: "number" }]} />
    <ConfigTable entity="criterion" title="Prioritisation criteria" note={`Weights total ${total}%${total !== 100 ? " — scores are normalised, but 100% is easier to read" : ""}`} rows={J(criteria.map((c) => ({ ...c, weight: Number(c.weight) })))} fields={[{ key: "name", label: "Criterion", required: true }, { key: "weight", label: "Weight %", type: "number", required: true }]} />
  </>);
}
