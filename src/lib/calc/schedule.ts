/**
 * Critical path method over plan tasks (BRD 9.x). Times are in calendar days relative to the
 * project's earliest start. Supports FS/SS/FF/SF links with lag. Summary tasks are excluded
 * from the network (their dates roll up from children).
 */
export interface CpmTask { id: string; start: Date; finish: Date; isSummary?: boolean }
export interface CpmLink { predecessorId: string; successorId: string; type: string; lagDays: number }
export interface CpmResult { id: string; es: number; ef: number; ls: number; lf: number; totalFloat: number; critical: boolean }

const DAY = 86400000;

/** Returns true if adding pred→succ would close a loop in the existing link graph. */
export function linkCreatesCycle(links: { predecessorId: string; successorId: string }[], pred: string, succ: string) {
  if (pred === succ) return true;
  const out = new Map<string, string[]>();
  for (const l of links) out.set(l.predecessorId, [...(out.get(l.predecessorId) ?? []), l.successorId]);
  const stack = [succ]; const seen = new Set<string>();
  while (stack.length) { const n = stack.pop()!; if (n === pred) return true; if (seen.has(n)) continue; seen.add(n); stack.push(...(out.get(n) ?? [])); }
  return false;
}

export function criticalPath(tasks: CpmTask[], links: CpmLink[]): Map<string, CpmResult> {
  const work = tasks.filter((t) => !t.isSummary);
  const ids = new Set(work.map((t) => t.id));
  const L = links.filter((l) => ids.has(l.predecessorId) && ids.has(l.successorId));
  const origin = Math.min(...work.map((t) => t.start.getTime()));
  const dur = new Map(work.map((t) => [t.id, Math.max(0, (t.finish.getTime() - t.start.getTime()) / DAY)]));
  const own = new Map(work.map((t) => [t.id, (t.start.getTime() - origin) / DAY]));

  // Topological order (Kahn). Tasks caught in a cycle keep their own dates.
  const indeg = new Map(work.map((t) => [t.id, 0]));
  for (const l of L) indeg.set(l.successorId, (indeg.get(l.successorId) ?? 0) + 1);
  const q = work.filter((t) => !indeg.get(t.id)).map((t) => t.id); const order: string[] = [];
  while (q.length) { const n = q.shift()!; order.push(n); for (const l of L.filter((x) => x.predecessorId === n)) { indeg.set(l.successorId, indeg.get(l.successorId)! - 1); if (!indeg.get(l.successorId)) q.push(l.successorId); } }
  for (const t of work) if (!order.includes(t.id)) order.push(t.id);

  const es = new Map<string, number>(), ef = new Map<string, number>();
  for (const id of order) {
    const d = dur.get(id)!;
    let s = own.get(id)!; // constraint: never earlier than the scheduled start (start-no-earlier-than)
    for (const l of L.filter((x) => x.successorId === id)) {
      const pS = es.get(l.predecessorId), pF = ef.get(l.predecessorId);
      if (pS === undefined || pF === undefined) continue;
      const lag = l.lagDays;
      const cand = l.type === "SS" ? pS + lag : l.type === "FF" ? pF + lag - d : l.type === "SF" ? pS + lag - d : pF + lag;
      if (cand > s) s = cand;
    }
    es.set(id, s); ef.set(id, s + d);
  }
  const end = Math.max(0, ...ef.values());
  const ls = new Map<string, number>(), lf = new Map<string, number>();
  for (const id of [...order].reverse()) {
    const d = dur.get(id)!;
    let f = end;
    for (const l of L.filter((x) => x.predecessorId === id)) {
      const sS = ls.get(l.successorId), sF = lf.get(l.successorId);
      if (sS === undefined || sF === undefined) continue;
      const lag = l.lagDays;
      const cand = l.type === "SS" ? sS - lag + d : l.type === "FF" ? sF - lag : l.type === "SF" ? sF - lag + d : sS - lag;
      if (cand < f) f = cand;
    }
    lf.set(id, f); ls.set(id, f - d);
  }
  const out = new Map<string, CpmResult>();
  for (const id of order) {
    const tf = Math.round((ls.get(id)! - es.get(id)!) * 100) / 100;
    out.set(id, { id, es: es.get(id)!, ef: ef.get(id)!, ls: ls.get(id)!, lf: lf.get(id)!, totalFloat: tf, critical: tf <= 0.01 });
  }
  return out;
}

/** Roll up summary task dates and % complete (duration-weighted) from their children. */
export function rollUp<T extends { id: string; parentId: string | null; start: Date; finish: Date; percentComplete: number; isSummary: boolean }>(tasks: T[]): T[] {
  const byParent = new Map<string, T[]>();
  for (const t of tasks) if (t.parentId) byParent.set(t.parentId, [...(byParent.get(t.parentId) ?? []), t]);
  const memo = new Map<string, T>();
  const visit = (t: T): T => {
    if (memo.has(t.id)) return memo.get(t.id)!;
    const kids = (byParent.get(t.id) ?? []).map(visit);
    if (!kids.length) { memo.set(t.id, t); return t; }
    const start = new Date(Math.min(...kids.map((k) => k.start.getTime())));
    const finish = new Date(Math.max(...kids.map((k) => k.finish.getTime())));
    const w = kids.map((k) => Math.max(1, k.finish.getTime() - k.start.getTime()));
    const pct = Math.round(kids.reduce((a, k, i) => a + k.percentComplete * w[i], 0) / w.reduce((a, x) => a + x, 0));
    const r = { ...t, start, finish, percentComplete: pct, isSummary: true };
    memo.set(t.id, r); return r;
  };
  return tasks.map(visit);
}
