import { api } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { runEql } from "@/lib/services/search";
import { exportResponse } from "@/lib/export";
import { audit } from "@/lib/audit";

export const GET = api(async (req, ctx) => {
  requirePermission(ctx, "report:export");
  const jql = req.nextUrl.searchParams.get("jql") ?? "";
  const { items } = await runEql(ctx, jql, 10000, 0);
  await audit({ workspaceId: ctx.workspaceId, userId: ctx.user.id, eventType: "report.exported", entityType: "Issue", after: { jql, rows: items.length }, ip: ctx.ip });
  return exportResponse(req.nextUrl.searchParams.get("format") ?? "xlsx", "issues", [
    { header: "Key", key: "key", width: 12 }, { header: "Summary", key: "summary", width: 60 }, { header: "Type", key: "type" }, { header: "Status", key: "status" },
    { header: "Priority", key: "priority" }, { header: "Assignee", key: "assignee", width: 20 }, { header: "Story points", key: "storyPoints" }, { header: "Show-stopper", key: "ss" },
    { header: "Severity", key: "severity" }, { header: "Due", key: "dueDate", numFmt: "yyyy-mm-dd" }, { header: "Created", key: "createdAt", numFmt: "yyyy-mm-dd" }, { header: "Resolved", key: "resolvedAt", numFmt: "yyyy-mm-dd" },
  ], items.map((i) => ({ key: i.key, summary: i.summary, type: i.type.name, status: i.status.name, priority: i.priority, assignee: i.assignee?.name ?? "", storyPoints: i.storyPoints ? Number(i.storyPoints) : null, ss: i.isShowStopper ? "Yes" : "", severity: i.severity, dueDate: i.dueDate, createdAt: i.createdAt, resolvedAt: i.resolvedAt })));
});
