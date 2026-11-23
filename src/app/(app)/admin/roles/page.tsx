import { requireCtx, pagePermission } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { RolesAdmin } from "@/components/admin/roles";

export default async function RolesPage() {
  const ctx = await requireCtx(); pagePermission(ctx, "admin:roles");
  const roles = await prisma.role.findMany({ where: { workspaceId: ctx.workspaceId }, include: { _count: { select: { members: true } } }, orderBy: [{ isSystem: "desc" }, { name: "asc" }] });
  return <RolesAdmin roles={JSON.parse(JSON.stringify(roles))} catalogue={PERMISSIONS} isSuper={ctx.permissions.includes("*")} />;
}
