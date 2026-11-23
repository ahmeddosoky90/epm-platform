/**
 * Permission catalogue. Roles hold a list of these keys; "*" grants everything.
 * Every protected backend operation calls `requirePermission` (see ../auth.ts).
 */
export const PERMISSIONS = {
  "admin:workspace": "Configure workspace settings, calendars, lifecycle",
  "admin:users": "Create, deactivate and assign roles to users",
  "admin:roles": "Create and edit roles and permissions",
  "admin:workflows": "Create and publish workflows, issue types, custom fields",
  "project:create": "Create projects",
  "project:view_all": "See every project in the workspace (otherwise membership only)",
  "project:edit_all": "Edit any project (otherwise only projects you manage)",
  "project:archive": "Archive and restore projects",
  "issue:create": "Create issues",
  "issue:edit": "Edit issues",
  "issue:delete": "Delete and restore issues",
  "issue:transition": "Move issues through the workflow",
  "issue:comment": "Comment and log work",
  "agile:manage": "Manage boards and sprints",
  "plan:edit": "Edit project schedule, milestones and baselines; import MS Project",
  "portfolio:view": "View portfolios, programs and roadmaps",
  "portfolio:manage": "Create portfolios/programs, scoring and scenarios",
  "governance:manage": "Configure stage gates and submit gates",
  "governance:approve": "Act on approvals assigned to your role",
  "finance:view": "View budgets and financials",
  "finance:edit": "Edit budget sheet and record transactions",
  "resource:view": "View resource capacity",
  "resource:manage": "Manage resources and allocations",
  "raid:manage": "Manage risks, issues, assumptions, dependencies",
  "change:create": "Raise change requests",
  "document:manage": "Upload and approve documents",
  "report:view": "View dashboards and reports",
  "report:export": "Export reports to CSV/Excel",
  "audit:view": "Read audit log",
  "tech:access": "Open SSH/RDP/SFTP sessions in the technical portal",
  "tech:manage": "Register technical connections and credentials",
  "integration:manage": "Configure mail, storage and other integrations",
} as const;

export type Permission = keyof typeof PERMISSIONS | "*";

const ALL_READ: Permission[] = ["project:view_all", "portfolio:view", "report:view", "finance:view", "resource:view"];
const DELIVERY: Permission[] = ["issue:create", "issue:edit", "issue:transition", "issue:comment"];

/** System roles seeded into every workspace. Custom roles can be added through Administration. */
export const SYSTEM_ROLES: { key: string; name: string; description: string; permissions: Permission[] }[] = [
  { key: "HEAD_OF_PMO", name: "Head of PMO", description: "Super user with full control of the workspace", permissions: ["*"] },
  { key: "PLATFORM_ADMIN", name: "Platform Administrator", description: "Configures users, roles, workflows and integrations",
    permissions: ["admin:workspace", "admin:users", "admin:roles", "admin:workflows", "integration:manage", "audit:view", "tech:access", "tech:manage", "project:view_all", "report:view"] },
  { key: "PMO_ADMIN", name: "Enterprise PMO Administrator", description: "Governance standards, templates and portfolio structures",
    permissions: [...ALL_READ, "admin:workspace", "admin:workflows", "project:create", "project:edit_all", "project:archive", "portfolio:manage", "governance:manage", "governance:approve", "raid:manage", "report:export", "audit:view", "document:manage", "plan:edit"] },
  { key: "PORTFOLIO_MANAGER", name: "Portfolio Manager", description: "Portfolios, programs, prioritisation",
    permissions: [...ALL_READ, "portfolio:manage", "governance:approve", "raid:manage", "report:export", "project:create"] },
  { key: "PROJECT_MANAGER", name: "Project Manager", description: "Runs projects end to end",
    permissions: ["project:create", "portfolio:view", "report:view", "report:export", "finance:view", "finance:edit", "resource:view", "resource:manage", ...DELIVERY, "issue:delete", "agile:manage", "plan:edit", "raid:manage", "change:create", "governance:manage", "document:manage"] },
  { key: "STRATEGY", name: "Strategy", description: "Strategic objectives, alignment and portfolio scenarios",
    permissions: [...ALL_READ, "portfolio:manage", "report:export", "governance:approve"] },
  { key: "DATA_ANALYST", name: "Data Analyst", description: "Read-only analytics across the workspace with export",
    permissions: [...ALL_READ, "report:export"] },
  { key: "PRODUCT_OWNER", name: "Product Owner", description: "Backlog, epics, releases",
    permissions: ["report:view", ...DELIVERY, "agile:manage", "change:create", "document:manage"] },
  { key: "SCRUM_MASTER", name: "Scrum Master", description: "Sprints, boards, blockers",
    permissions: ["report:view", ...DELIVERY, "agile:manage", "raid:manage"] },
  { key: "BUSINESS_ANALYST", name: "Business Analyst", description: "Requirements and traceability",
    permissions: ["report:view", ...DELIVERY, "change:create", "document:manage"] },
  { key: "TEAM_MEMBER", name: "Team Member", description: "Works assigned issues",
    permissions: [...DELIVERY] },
  { key: "EXECUTIVE", name: "Executive", description: "Dashboards and approvals",
    permissions: [...ALL_READ, "governance:approve", "report:export"] },
  { key: "FINANCE", name: "Finance User", description: "Budgets, actuals and forecasts",
    permissions: ["project:view_all", "report:view", "report:export", "finance:view", "finance:edit", "governance:approve"] },
  { key: "AUDITOR", name: "Auditor (read-only)", description: "Read-only with audit log access",
    permissions: [...ALL_READ, "audit:view", "report:export"] },
];

export function hasPermission(granted: string[], needed: Permission): boolean {
  return granted.includes("*") || granted.includes(needed);
}
