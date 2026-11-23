import { Prisma, PrismaClient } from "@prisma/client";
import { SYSTEM_ROLES } from "../rbac/permissions";

type Tx = Prisma.TransactionClient | PrismaClient;

export const DEFAULT_ISSUE_TYPES = [
  { name: "Epic", icon: "zap", color: "#af52de", level: 3 },
  { name: "Feature", icon: "star", color: "#5856d6", level: 3 },
  { name: "Story", icon: "bookmark", color: "#34c759", level: 2 },
  { name: "Task", icon: "check-square", color: "#0a84ff", level: 2 },
  { name: "Bug", icon: "bug", color: "#ff3b30", level: 2 },
  { name: "Requirement", icon: "file-text", color: "#64d2ff", level: 2 },
  { name: "Change Request", icon: "git-pull-request", color: "#ff9f0a", level: 2 },
  { name: "Risk", icon: "alert-triangle", color: "#ff9500", level: 2 },
  { name: "Issue", icon: "alert-octagon", color: "#ff453a", level: 2 },
  { name: "Milestone", icon: "flag", color: "#30b0c7", level: 2 },
  { name: "Deliverable", icon: "package", color: "#a2845e", level: 2 },
  { name: "Subtask", icon: "corner-down-right", color: "#8e8e93", level: 1 },
];

export const DEFAULT_LIFECYCLE = [
  ["Idea", false], ["Initial Assessment", false], ["Business Case Development", false], ["Business Case Approval", true],
  ["Initiation", true], ["Planning", false], ["Execution", true], ["Monitoring and Control", false], ["Closure", true], ["Closed", false],
] as const;

export const DEFAULT_GATES: { name: string; checklist: string[]; approverRoles: string[]; validityDays?: number }[] = [
  { name: "Idea Assessment", checklist: ["Problem statement", "Strategic alignment"], approverRoles: ["PORTFOLIO_MANAGER"] },
  { name: "Business Case Approval", checklist: ["Approved business case", "Cost estimate", "Benefits defined"], approverRoles: ["PORTFOLIO_MANAGER", "FINANCE", "EXECUTIVE"], validityDays: 365 },
  { name: "Project Initiation", checklist: ["Approved project charter", "Defined project team", "Approved budget"], approverRoles: ["PMO_ADMIN"] },
  { name: "Planning Approval", checklist: ["Approved project plan", "Defined milestones", "Risk assessment", "Architecture approval"], approverRoles: ["PMO_ADMIN", "EXECUTIVE"] },
  { name: "Execution Authorization", checklist: ["Security assessment", "Compliance assessment", "Procurement approval"], approverRoles: ["HEAD_OF_PMO"] },
  { name: "Mid-Project Review", checklist: ["Status report", "Updated forecast"], approverRoles: ["PMO_ADMIN"] },
  { name: "Closure Approval", checklist: ["Closure report", "Lessons learned", "Handover sign-off"], approverRoles: ["PMO_ADMIN", "EXECUTIVE"] },
  { name: "Benefits Realization Review", checklist: ["Benefits measured"], approverRoles: ["STRATEGY"] },
];

export const DEFAULT_CRITERIA = [
  ["Strategic Alignment", 25], ["Business Value", 25], ["Regulatory Importance", 20], ["Financial Return", 15], ["Delivery Feasibility", 15],
] as const;

/** Default workflow per BRD 5.2, with rules: Done requires no open blockers + resolution. */
export async function createDefaultWorkflow(tx: Tx, workspaceId: string) {
  const wf = await tx.workflow.create({ data: { workspaceId, name: "Default Delivery Workflow", description: "Open → To Do → In Progress → In Review → Testing → Done", isDefault: true } });
  const defs = [
    ["Open", "TODO", "#8e8e93", true], ["To Do", "TODO", "#8e8e93", false], ["In Progress", "IN_PROGRESS", "#0a84ff", false],
    ["In Review", "IN_PROGRESS", "#5e5ce6", false], ["Testing", "IN_PROGRESS", "#bf5af2", false], ["Done", "DONE", "#34c759", false],
    ["Blocked", "IN_PROGRESS", "#ff3b30", false], ["On Hold", "TODO", "#ff9f0a", false], ["Reopened", "TODO", "#ff9500", false], ["Cancelled", "DONE", "#636366", false],
  ] as const;
  const s: Record<string, string> = {};
  for (const [i, [name, category, color, isInitial]] of defs.entries()) {
    s[name] = (await tx.workflowStatus.create({ data: { workflowId: wf.id, name, category, color, sortOrder: i, isInitial } })).id;
  }
  const T = (name: string, from: string | null, to: string, extra: Partial<Prisma.WorkflowTransitionUncheckedCreateInput> = {}) =>
    tx.workflowTransition.create({ data: { workflowId: wf.id, name, fromStatusId: from ? s[from] : null, toStatusId: s[to], allowedRoles: [], requiredFields: [], ...extra } });
  await T("Plan", "Open", "To Do");
  await T("Start", "Open", "In Progress", { requiredFields: ["assigneeId"] });
  await T("Start", "To Do", "In Progress", { requiredFields: ["assigneeId"] });
  await T("Start", "Reopened", "In Progress", { requiredFields: ["assigneeId"] });
  await T("Back to To Do", "In Progress", "To Do");
  await T("Submit for review", "In Progress", "In Review");
  await T("Send to testing", "In Review", "Testing");
  await T("Request changes", "In Review", "In Progress");
  await T("Fail testing", "Testing", "In Progress");
  await T("Pass testing", "Testing", "Done", { conditions: { noOpenBlockers: true }, postFunctions: { setResolution: "Done" } });
  await T("Done", "In Review", "Done", { conditions: { noOpenBlockers: true }, postFunctions: { setResolution: "Done" } });
  await T("Done", "In Progress", "Done", { conditions: { noOpenBlockers: true }, postFunctions: { setResolution: "Done" } });
  await T("Done", "To Do", "Done", { conditions: { noOpenBlockers: true }, postFunctions: { setResolution: "Done" } });
  await T("Block", null, "Blocked");
  await T("Unblock", "Blocked", "In Progress");
  await T("Put on hold", null, "On Hold");
  await T("Resume", "On Hold", "To Do");
  await T("Reopen", "Done", "Reopened", { allowedRoles: ["HEAD_OF_PMO", "PROJECT_MANAGER", "PRODUCT_OWNER", "SCRUM_MASTER", "PMO_ADMIN"] });
  await T("Cancel", null, "Cancelled", { allowedRoles: ["HEAD_OF_PMO", "PROJECT_MANAGER", "PRODUCT_OWNER", "PMO_ADMIN"], postFunctions: { setResolution: "Won't Do" } });
  return { workflow: wf, statusIds: s };
}

/** Everything a new workspace needs to be usable. Idempotent per workspace creation call. */
export async function bootstrapWorkspace(tx: Tx, workspaceId: string) {
  for (const r of SYSTEM_ROLES) {
    await tx.role.create({ data: { workspaceId, key: r.key, name: r.name, description: r.description, isSystem: true, permissions: r.permissions } });
  }
  const types: Record<string, string> = {};
  for (const t of DEFAULT_ISSUE_TYPES) types[t.name] = (await tx.issueType.create({ data: { workspaceId, ...t, isSystem: true } })).id;
  for (const [i, [name, requiresApproval]] of DEFAULT_LIFECYCLE.entries()) await tx.lifecycleStage.create({ data: { workspaceId, name, sortOrder: i, requiresApproval } });
  for (const [i, g] of DEFAULT_GATES.entries()) await tx.governanceStageDef.create({ data: { workspaceId, sortOrder: i, ...g } });
  for (const [i, [name, weight]] of DEFAULT_CRITERIA.entries()) await tx.priorityCriterion.create({ data: { workspaceId, name, weight, sortOrder: i } });
  const wf = await createDefaultWorkflow(tx, workspaceId);
  await tx.projectTemplate.create({ data: { workspaceId, name: "Hybrid Delivery Project", methodology: "HYBRID", description: "Stage-gated project with agile delivery",
    definition: { milestones: [{ name: "Charter approved", offsetDays: 14 }, { name: "Plan baselined", offsetDays: 45 }, { name: "MVP release", offsetDays: 150 }, { name: "Go-live", offsetDays: 300 }],
      tasks: [{ summary: "Draft project charter", type: "Task" }, { summary: "Stakeholder analysis", type: "Task" }, { summary: "Define product backlog", type: "Epic" }],
      documents: ["Business Case", "Project Charter", "Project Plan"], boards: ["KANBAN", "SCRUM"] } } });
  await tx.projectTemplate.create({ data: { workspaceId, name: "Waterfall Infrastructure Project", methodology: "WATERFALL", description: "Classic phased delivery",
    definition: { milestones: [{ name: "Design complete", offsetDays: 30 }, { name: "Build complete", offsetDays: 120 }, { name: "UAT sign-off", offsetDays: 160 }, { name: "Cutover", offsetDays: 180 }],
      tasks: [{ summary: "Requirements sign-off", type: "Deliverable" }, { summary: "Solution design", type: "Deliverable" }], documents: ["Project Charter", "Architecture Documents", "Test Plans"], boards: ["KANBAN"] } } });
  return { types, workflow: wf };
}

export async function createDefaultBoards(tx: Tx, projectId: string, workflowId: string | null, methodology: string) {
  if (!workflowId) return;
  const st = await tx.workflowStatus.findMany({ where: { workflowId }, orderBy: { sortOrder: "asc" } });
  const ids = (...names: string[]) => st.filter((s) => names.includes(s.name)).map((s) => s.id);
  const columns = [
    { name: "To Do", statusIds: ids("Open", "To Do", "Reopened", "On Hold") },
    { name: "In Progress", statusIds: ids("In Progress", "Blocked"), wipLimit: 6 },
    { name: "Review", statusIds: ids("In Review"), wipLimit: 4 },
    { name: "Testing", statusIds: ids("Testing"), wipLimit: 4 },
    { name: "Done", statusIds: ids("Done", "Cancelled") },
  ];
  const kinds = methodology === "WATERFALL" ? ["KANBAN"] : ["KANBAN", "SCRUM"];
  for (const kind of kinds) {
    await tx.board.create({ data: { projectId, kind, name: kind === "KANBAN" ? "Kanban board" : "Scrum board", columns: { create: columns.map((c, i) => ({ ...c, sortOrder: i })) } } });
  }
}

