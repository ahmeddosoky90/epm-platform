import { prisma } from "../db";
import type { Ctx } from "../auth";
import { loadProject } from "./access";
import { burndown, velocity, flowTimes, type ScopeEvent } from "../calc/agile";

/** Every series below is derived from persisted sprint events and issue history. */
export async function agileReports(ctx: Ctx, projectKey: string, sprintId?: string) {
  const p = await loadProject(ctx, projectKey);
  const sprints = await prisma.sprint.findMany({ where: { projectId: p.id, state: { in: ["ACTIVE", "CLOSED"] } }, orderBy: { startDate: "asc" }, include: { events: true } });
  const sprint = sprints.find((s) => s.id === sprintId) ?? sprints.find((s) => s.state === "ACTIVE") ?? sprints[sprints.length - 1];
  let burn: ReturnType<typeof burndown> = [];
  let sprintReport: { completed: unknown[]; notCompleted: unknown[]; added: string[]; removed: string[] } | null = null;
  if (sprint?.startDate && sprint.endDate) {
    const ev: ScopeEvent[] = sprint.events.map((e) => ({ kind: e.kind as ScopeEvent["kind"], points: Number(e.points ?? 0), at: e.createdAt }));
    burn = burndown(sprint.startDate, sprint.endDate, ev, sprint.completedAt ?? new Date());
    const issueIds = [...new Set(sprint.events.map((e) => e.issueId))];
    const issues = await prisma.issue.findMany({ where: { id: { in: issueIds } }, include: { status: true, type: true } });
    const doneIds = new Set(sprint.events.filter((e) => e.kind === "COMPLETED").map((e) => e.issueId));
    const reopened = new Set(sprint.events.filter((e) => e.kind === "REOPENED").map((e) => e.issueId));
    const startT = sprint.startDate.getTime() + 60_000;
    sprintReport = {
      completed: issues.filter((i) => doneIds.has(i.id) && !reopened.has(i.id)).map((i) => ({ key: i.key, summary: i.summary, points: i.storyPoints, status: i.status.name })),
      notCompleted: issues.filter((i) => !doneIds.has(i.id) || reopened.has(i.id)).map((i) => ({ key: i.key, summary: i.summary, points: i.storyPoints, status: i.status.name })),
      added: issues.filter((i) => sprint.events.some((e) => e.issueId === i.id && e.kind === "ADDED" && e.createdAt.getTime() > startT)).map((i) => i.key),
      removed: issues.filter((i) => sprint.events.some((e) => e.issueId === i.id && e.kind === "REMOVED")).map((i) => i.key),
    };
  }
  const vel = velocity(sprints.filter((s) => s.state === "CLOSED").map((s) => ({ name: s.name.replace(`${p.key} `, ""), committed: Number(s.committedPoints ?? 0), completed: Number(s.completedPoints ?? 0) })));

  // Flow metrics from status history (last 90 days)
  const since = new Date(Date.now() - 90 * 86400000);
  const statuses = await prisma.workflowStatus.findMany({ where: { workflowId: p.workflowId ?? "" } });
  const cat = new Map(statuses.map((s) => [s.name, s.category]));
  const histIssues = await prisma.issue.findMany({ where: { projectId: p.id, deletedAt: null, type: { level: { lt: 3 } } }, select: { id: true, key: true, createdAt: true, history: { where: { field: "status" }, orderBy: { createdAt: "asc" }, select: { toValue: true, createdAt: true } } } });
  const flows = histIssues.map((i) => ({ key: i.key, f: flowTimes(i.createdAt, i.history.map((h) => ({ to: h.toValue ?? "", category: cat.get(h.toValue ?? "") ?? "TODO", at: h.createdAt }))) })).filter((x) => x.f && x.f.doneAt >= since) as { key: string; f: NonNullable<ReturnType<typeof flowTimes>> }[];
  const control = flows.filter((x) => x.f.cycleDays != null).map((x) => ({ key: x.key, date: x.f.doneAt.toISOString().slice(0, 10), cycle: x.f.cycleDays! })).sort((a, b) => a.date.localeCompare(b.date));
  const avgCycle = control.length ? Math.round((control.reduce((a, c) => a + c.cycle, 0) / control.length) * 10) / 10 : null;
  const avgLead = flows.length ? Math.round((flows.reduce((a, c) => a + c.f.leadDays, 0) / flows.length) * 10) / 10 : null;
  const weeks = [...Array(12)].map((_, i) => { const end = new Date(Date.now() - (11 - i) * 7 * 86400000); const start = new Date(end.getTime() - 7 * 86400000);
    return { week: end.toISOString().slice(5, 10), throughput: flows.filter((x) => x.f.doneAt > start && x.f.doneAt <= end).length }; });

  // Cumulative flow: status category counts per day reconstructed from history (last 30 days)
  const days = [...Array(30)].map((_, i) => new Date(Date.now() - (29 - i) * 86400000));
  const cfd = days.map((d) => {
    const eod = new Date(d); eod.setUTCHours(23, 59, 59);
    const counts = { date: d.toISOString().slice(5, 10), "To Do": 0, "In Progress": 0, Done: 0 } as Record<string, number | string>;
    for (const i of histIssues) {
      if (i.createdAt > eod) continue;
      const last = [...i.history].reverse().find((h) => h.createdAt <= eod);
      const c = last ? cat.get(last.toValue ?? "") ?? "TODO" : "TODO";
      const k = c === "DONE" ? "Done" : c === "IN_PROGRESS" ? "In Progress" : "To Do";
      counts[k] = (counts[k] as number) + 1;
    }
    return counts;
  });

  // Epic burndown: remaining points per epic
  const epics = await prisma.issue.findMany({ where: { projectId: p.id, deletedAt: null, type: { level: 3 } }, select: { key: true, summary: true, children: { where: { deletedAt: null }, select: { storyPoints: true, status: { select: { category: true } } } } } });
  const epicBurn = epics.map((e) => { const total = e.children.reduce((a, c) => a + Number(c.storyPoints ?? 0), 0); const done = e.children.filter((c) => c.status.category === "DONE").reduce((a, c) => a + Number(c.storyPoints ?? 0), 0);
    return { name: e.key, summary: e.summary, done, remaining: total - done, pct: total ? Math.round((done / total) * 100) : 0 }; });
  // Release burndown per fix version
  const versions = await prisma.version.findMany({ where: { projectId: p.id }, include: { issues: { where: { deletedAt: null }, select: { storyPoints: true, status: { select: { category: true } } } } } });
  const release = versions.map((v) => { const t = v.issues.reduce((a, c) => a + Number(c.storyPoints ?? 0), 0); const d = v.issues.filter((c) => c.status.category === "DONE").reduce((a, c) => a + Number(c.storyPoints ?? 0), 0);
    return { name: v.name, releaseDate: v.releaseDate, total: t, done: d, remaining: t - d, sprintsNeeded: vel.average ? Math.ceil((t - d) / vel.average) : null }; });
  return { project: p, sprints: sprints.map((s) => ({ id: s.id, name: s.name, state: s.state })), sprint: sprint ? { id: sprint.id, name: sprint.name, goal: sprint.goal, state: sprint.state, committed: Number(sprint.committedPoints ?? 0) } : null,
    burn, sprintReport, velocity: vel, control, avgCycle, avgLead, throughput: weeks, cfd, epicBurn, release };
}
