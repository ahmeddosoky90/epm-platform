import { requireCtx, pagePermission } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UsersAdmin } from "@/components/admin/users";

export default async function UsersPage() {
  const ctx = await requireCtx(); pagePermission(ctx, "admin:users");
  const [members, roles, departments] = await Promise.all([
    prisma.workspaceMember.findMany({ where: { workspaceId: ctx.workspaceId }, include: { role: { select: { id: true, name: true } }, user: { select: { id: true, email: true, name: true, jobTitle: true, isActive: true, lockedUntil: true, lastLoginAt: true, mfaEnabled: true } } }, orderBy: { user: { name: "asc" } } }),
    prisma.role.findMany({ where: { workspaceId: ctx.workspaceId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.department.findMany({ where: { workspaceId: ctx.workspaceId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return <UsersAdmin members={JSON.parse(JSON.stringify(members))} roles={roles} departments={departments} me={ctx.user.id} />;
}
