import { redirect } from "next/navigation";
import { getCtx, can } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Shell, type NavItem } from "@/components/shell/shell";
import { ToastProvider } from "@/components/ui/toast";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getCtx();
  if (!ctx) redirect("/login");
  const [workspaces, unread] = await Promise.all([
    prisma.workspaceMember.findMany({ where: { userId: ctx.user.id }, include: { workspace: { select: { id: true, name: true } } } }),
    prisma.notification.count({ where: { userId: ctx.user.id, readAt: null } }),
  ]);
  const P = (p: Parameters<typeof can>[1]) => can(ctx, p);
  const nav: NavItem[] = [
    { href: "/", label: "Home", icon: "home" },
    { href: "/my-work", label: "My Work", icon: "inbox" },
    { href: "/projects", label: "Projects", icon: "folder" },
    ...(P("portfolio:view") ? [{ href: "/portfolios", label: "Portfolios", icon: "layers" } as NavItem, { href: "/programs", label: "Programs", icon: "git-branch" } as NavItem, { href: "/roadmap", label: "Roadmap", icon: "map" } as NavItem] : []),
    { href: "/boards", label: "Boards", icon: "kanban", section: "Delivery" },
    { href: "/backlogs", label: "Backlogs", icon: "list" },
    { href: "/sprints", label: "Sprints", icon: "timer" },
    { href: "/search", label: "Issues & filters", icon: "search" },
    ...(P("report:view") ? [{ href: "/dashboards", label: "Dashboards", icon: "gauge", section: "Insight" } as NavItem, { href: "/reports", label: "Reports", icon: "bar-chart" } as NavItem] : []),
    ...(P("resource:view") ? [{ href: "/resources", label: "Resources", icon: "users", section: "PMO" } as NavItem] : []),
    ...(P("finance:view") ? [{ href: "/finance", label: "Financials", icon: "wallet", section: P("resource:view") ? undefined : "PMO" } as NavItem] : []),
    { href: "/governance", label: "Governance", icon: "shield", section: P("resource:view") || P("finance:view") ? undefined : "PMO" },
    { href: "/integrations", label: "Mail & files", icon: "mail", section: "Workspace" },
    ...(P("tech:access") ? [{ href: "/tech", label: "Technical portal", icon: "terminal" } as NavItem] : []),
    ...(P("admin:users") || P("admin:workflows") || P("admin:workspace") || P("audit:view") ? [{ href: "/admin", label: "Administration", icon: "settings" } as NavItem] : []),
  ];
  return (
    <ToastProvider>
      <Shell nav={nav} user={{ name: ctx.user.name, email: ctx.user.email, role: ctx.roleName }} workspace={ctx.workspace} workspaces={workspaces.map((w) => w.workspace)} unread={unread} canCreate={P("issue:create")}>
        {children}
      </Shell>
    </ToastProvider>
  );
}
