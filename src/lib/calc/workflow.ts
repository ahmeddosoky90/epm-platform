/** Pure workflow-rule evaluation so it can be unit tested without a DB. */
export interface TransitionRule {
  id: string; name: string; fromStatusId: string | null; toStatusId: string;
  allowedRoles: string[]; requiredFields: string[];
  conditions: { noOpenBlockers?: boolean; assigneeOnly?: boolean; requireApproval?: boolean };
}
export interface IssueSnapshot { statusId: string; assigneeId: string | null; [field: string]: unknown }
export interface Actor { userId: string; roleKey: string; isSuper: boolean }

export function evaluateTransition(
  issue: IssueSnapshot, t: TransitionRule, actor: Actor,
  ctx: { openBlockers: number; approved?: boolean; patch?: Record<string, unknown> },
): string[] {
  const errors: string[] = [];
  if (t.fromStatusId && t.fromStatusId !== issue.statusId) errors.push(`Transition "${t.name}" is not available from the current status`);
  if (!actor.isSuper && t.allowedRoles.length && !t.allowedRoles.includes(actor.roleKey)) errors.push(`Your role cannot perform "${t.name}"`);
  if (!actor.isSuper && t.conditions.assigneeOnly && issue.assigneeId !== actor.userId) errors.push("Only the assignee can perform this transition");
  if (t.conditions.noOpenBlockers && ctx.openBlockers > 0) errors.push(`Issue has ${ctx.openBlockers} unresolved blocker(s)`);
  if (t.conditions.requireApproval && !ctx.approved) errors.push("Reviewer approval is required before this transition");
  const merged = { ...issue, ...(ctx.patch ?? {}) };
  for (const f of t.requiredFields) {
    const v = merged[f];
    if (v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) errors.push(`Field "${f}" is required`);
  }
  return errors;
}

/** Reject links that would create a cycle in blocking/dependency graphs. */
export function wouldCreateCycle(edges: { from: string; to: string }[], from: string, to: string): boolean {
  if (from === to) return true;
  const adj = new Map<string, string[]>();
  for (const e of edges) adj.set(e.from, [...(adj.get(e.from) ?? []), e.to]);
  const stack = [to], seen = new Set<string>();
  while (stack.length) {
    const n = stack.pop()!;
    if (n === from) return true;
    if (seen.has(n)) continue;
    seen.add(n);
    stack.push(...(adj.get(n) ?? []));
  }
  return false;
}

/** Project key from name: initials of words (2–5 chars), uppercase; uniqueness resolved by caller. */
export function suggestProjectKey(name: string): string {
  const words = name.replace(/[^A-Za-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  let key = words.length >= 2 ? words.map((w) => w[0]).join("") : (words[0] ?? "PRJ").slice(0, 4);
  key = key.toUpperCase().slice(0, 5);
  if (key.length < 2) key = (key + "X").slice(0, 2);
  if (/^\d/.test(key)) key = "P" + key.slice(0, 4);
  return key;
}
