import { ReactNode } from "react";
import { requireCtx, can } from "@/lib/auth";
import { PageHeader } from "@/components/ui/bits";
import { AdminTabs } from "@/components/admin/tabs";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const ctx = await requireCtx();
  const tabs = [
    can(ctx, "admin:users") && { href: "/admin/users", label: "Users" },
    can(ctx, "admin:roles") && { href: "/admin/roles", label: "Roles & permissions" },
    can(ctx, "admin:workflows") && { href: "/admin/workflows", label: "Workflows" },
    can(ctx, "admin:workflows") && { href: "/admin/issue-types", label: "Issue types & fields" },
    can(ctx, "admin:workspace") && { href: "/admin/workspace", label: "Workspace & calendar" },
    can(ctx, "admin:workspace") && { href: "/admin/governance", label: "Lifecycle & gates" },
    can(ctx, "audit:view") && { href: "/admin/audit", label: "Audit log" },
  ].filter(Boolean) as { href: string; label: string }[];
  if (!tabs.length) return <><PageHeader title="Administration" /><div className="card p-10 text-center"><div className="font-medium">You don&apos;t have access to administration</div><div className="text-sm muted mt-1">Ask a workspace administrator if you need it.</div></div></>;
  return (<><PageHeader title="Administration" subtitle={ctx.workspace.name} /><AdminTabs tabs={tabs} /><div className="mt-4">{children}</div></>);
}
