import { redirect } from "next/navigation";
import { requireCtx, can } from "@/lib/auth";
export default async function AdminHome() {
  const ctx = await requireCtx();
  redirect(can(ctx, "admin:users") ? "/admin/users" : can(ctx, "admin:workflows") ? "/admin/workflows" : can(ctx, "admin:workspace") ? "/admin/workspace" : "/admin/audit");
}
