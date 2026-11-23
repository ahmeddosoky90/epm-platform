/** Agile metric calculations from persisted events (BRD 6.6). Pure functions → unit-testable. */
export interface ScopeEvent { kind: "ADDED" | "REMOVED" | "COMPLETED" | "REOPENED"; points: number; at: Date }

const day = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

/** Daily burndown: remaining = scope - completed, with an ideal line. */
export function burndown(start: Date, end: Date, events: ScopeEvent[], until = new Date()) {
  const out: { date: string; remaining: number | null; ideal: number; scope: number | null; completed: number | null }[] = [];
  const sorted = [...events].sort((a, b) => a.at.getTime() - b.at.getTime());
  const startDay = day(start), endDay = day(end);
  const totalDays = Math.max(1, Math.round((endDay.getTime() - startDay.getTime()) / 86400000));
  // Scope at start = everything added on or before the start day
  const initialScope = sorted.filter((e) => day(e.at) <= startDay).reduce((a, e) => a + (e.kind === "ADDED" ? e.points : e.kind === "REMOVED" ? -e.points : 0), 0);
  for (let i = 0; i <= totalDays; i++) {
    const d = new Date(startDay.getTime() + i * 86400000);
    const eod = new Date(d.getTime() + 86400000 - 1);
    const past = sorted.filter((e) => e.at <= eod);
    const scope = past.reduce((a, e) => a + (e.kind === "ADDED" ? e.points : e.kind === "REMOVED" ? -e.points : 0), 0);
    const completed = past.reduce((a, e) => a + (e.kind === "COMPLETED" ? e.points : e.kind === "REOPENED" ? -e.points : 0), 0);
    const future = d > day(until);
    out.push({
      date: d.toISOString().slice(0, 10),
      remaining: future ? null : Math.round((scope - completed) * 10) / 10,
      scope: future ? null : scope,
      completed: future ? null : completed,
      ideal: Math.round(initialScope * (1 - i / totalDays) * 10) / 10,
    });
  }
  return out;
}

export function velocity(sprints: { name: string; committed: number; completed: number }[]) {
  const done = sprints.map((s) => s.completed);
  const avg = done.length ? done.reduce((a, b) => a + b, 0) / done.length : 0;
  return { sprints, average: Math.round(avg * 10) / 10 };
}

/** Cycle time (first In Progress → Done) and lead time (created → Done) in days. */
export function flowTimes(created: Date, transitions: { to: string; category: string; at: Date }[]) {
  const started = transitions.find((t) => t.category === "IN_PROGRESS")?.at;
  const done = [...transitions].reverse().find((t) => t.category === "DONE")?.at;
  if (!done) return null;
  const d = (a: Date, b: Date) => Math.round(((b.getTime() - a.getTime()) / 86400000) * 10) / 10;
  return { leadDays: d(created, done), cycleDays: started ? d(started, done) : null, doneAt: done };
}
