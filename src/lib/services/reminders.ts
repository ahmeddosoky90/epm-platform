import { prisma } from "../db";
import { notify } from "./notify";

/**
 * Scheduled reminders (BRD 16): overdue issues, milestones due soon or missed, approvals waiting,
 * risks past target date, status reports due. Idempotent per day via dedupe keys, so it can run
 * as often as the scheduler likes (cron → POST /api/jobs/reminders).
 */
export async function runReminders(now = new Date()) {
  const day = now.toISOString().slice(0, 10);
  const soon = new Date(now.getTime() + 7 * 86400000);
  let sent = 0;
  const count = async (fn: () => Promise<unknown>) => { await fn(); sent++; };

  const overdue = await prisma.issue.findMany({ where: { deletedAt: null, dueDate: { lt: now }, assigneeId: { not: null }, status: { category: { not: "DONE" } }, project: { archivedAt: null } }, select: { id: true, key: true, summary: true, assigneeId: true } });
  for (const i of overdue) await count(() => notify({ userIds: [i.assigneeId], kind: "issue.overdue", title: `${i.key} is overdue`, body: i.summary, link: `/issues/${i.key}`, dedupeKey: `overdue:${i.id}:${day}` }));

  const ms = await prisma.milestone.findMany({ where: { completedAt: null, dueDate: { lte: soon }, project: { archivedAt: null, status: "ACTIVE" } }, include: { project: { select: { key: true, managerId: true } } } });
  for (const m of ms) {
    const missed = m.dueDate < now;
    await count(() => notify({ userIds: [m.project.managerId], kind: missed ? "milestone.missed" : "milestone.due", title: `${m.project.key}: milestone "${m.name}" ${missed ? "is past due" : "is due within 7 days"}`, link: `/projects/${m.project.key}/plan`, dedupeKey: `ms:${m.id}:${missed ? "missed" : "due"}` }));
  }

  const pending = await prisma.approval.findMany({ where: { decision: "PENDING" }, include: { gate: { include: { stage: true, project: { select: { key: true, workspaceId: true } }, approvals: true } }, changeRequest: { include: { project: { select: { key: true, workspaceId: true } }, approvals: true } } } });
  for (const a of pending) {
    const chain = a.gate?.approvals ?? a.changeRequest?.approvals ?? [];
    const active = chain.filter((x) => x.step < a.step).every((x) => x.decision === "APPROVED") && (a.gate ? a.gate.status === "IN_REVIEW" : a.changeRequest?.status === "SUBMITTED");
    if (!active) continue;
    const ws = (a.gate?.project ?? a.changeRequest?.project)!.workspaceId;
    const users = a.approverId ? [a.approverId] : (await prisma.workspaceMember.findMany({ where: { workspaceId: ws, role: { key: a.approverRole } }, select: { userId: true } })).map((m) => m.userId);
    const what = a.gate ? `gate "${a.gate.stage.name}"` : `change request "${a.changeRequest!.title}"`;
    const key = (a.gate?.project ?? a.changeRequest?.project)!.key;
    await count(() => notify({ userIds: users, kind: "approval.waiting", title: `${key}: ${what} is waiting for your decision`, link: a.gate ? `/projects/${key}/governance` : `/projects/${key}/changes`, dedupeKey: `appr:${a.id}:${day}` }));
  }

  const risks = await prisma.risk.findMany({ where: { status: { not: "CLOSED" }, targetDate: { lt: now }, ownerId: { not: null } }, include: { project: { select: { key: true } } } });
  for (const r of risks) await count(() => notify({ userIds: [r.ownerId], kind: "risk.overdue", title: `${r.project.key}: risk response overdue`, body: r.title, link: `/projects/${r.project.key}/raid`, dedupeKey: `risk:${r.id}:${day.slice(0, 7)}` }));

  const active = await prisma.project.findMany({ where: { status: "ACTIVE", archivedAt: null }, include: { statusReports: { orderBy: { createdAt: "desc" }, take: 1 } } });
  for (const p of active) {
    const last = p.statusReports[0];
    if (!last || now.getTime() - last.createdAt.getTime() > 14 * 86400000) await count(() => notify({ userIds: [p.managerId], kind: "status.due", title: `${p.key}: status report due`, body: last ? `Last report was ${Math.floor((now.getTime() - last.createdAt.getTime()) / 86400000)} days ago` : "No status report yet", link: `/projects/${p.key}`, dedupeKey: `status:${p.id}:${day}` }));
  }
  return { checked: sent, at: now.toISOString() };
}
