import { requireCtx, pagePermission } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ConfigTable } from "@/components/admin/config-table";

export default async function IssueTypesAdmin() {
  const ctx = await requireCtx(); pagePermission(ctx, "admin:workflows");
  const [types, fields] = await Promise.all([
    prisma.issueType.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: [{ level: "desc" }, { name: "asc" }] }),
    prisma.customField.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { name: "asc" } }),
  ]);
  const J = <T,>(x: T) => JSON.parse(JSON.stringify(x));
  return (<>
    <ConfigTable entity="issueType" title="Issue types" note="Level 3 items (epics) can parent level 2; level 2 can parent sub-tasks" rows={J(types)} lockedKey="isSystem"
      fields={[{ key: "name", label: "Name", required: true }, { key: "level", label: "Level", type: "select", options: [{ value: "3", label: "3 · Epic level" }, { value: "2", label: "2 · Standard" }, { value: "1", label: "1 · Sub-task" }] }, { key: "color", label: "Colour", type: "color" }, { key: "icon", label: "Icon" }]} />
    <ConfigTable entity="customField" title="Custom fields" note="Shown on issues of the selected types (all types when none selected)" rows={J(fields)}
      fields={[{ key: "name", label: "Name", required: true }, { key: "fieldType", label: "Type", type: "select", required: true, createOnly: true, options: ["TEXT", "NUMBER", "DATE", "SELECT", "MULTISELECT", "CHECKBOX", "USER", "URL", "CURRENCY", "PERCENT"].map((v) => ({ value: v, label: v.toLowerCase() })) }, { key: "options", label: "Choices (one per line, for select types)", type: "list" }, { key: "required", label: "Required", type: "checkbox" }, { key: "issueTypeIds", label: "Issue types", type: "multiselect", options: types.map((t) => ({ value: t.id, label: t.name })) }]} />
  </>);
}
