/**
 * EQL — a well-defined subset of a Jira-style query language, compiled to a Prisma where clause.
 *
 *   query     := orExpr [ORDER BY field [ASC|DESC] {, field [ASC|DESC]}]
 *   orExpr    := andExpr {OR andExpr}
 *   andExpr   := notExpr {AND notExpr}
 *   notExpr   := NOT notExpr | '(' orExpr ')' | clause
 *   clause    := field op value | field [NOT] IN '(' value {, value} ')' | field IS [NOT] EMPTY
 *   op        := = | != | > | >= | < | <= | ~ | !~
 *   value     := "quoted" | word | number | function '(' ')' | relative date (-7d, +2w)
 *   functions := currentUser() today() now() openSprints() startOfWeek() startOfMonth()
 */
import type { Prisma } from "@prisma/client";

export class EqlError extends Error {}

type Tok = { t: "word" | "str" | "op" | "lp" | "rp" | "comma"; v: string; pos: number };

export function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === "(") { out.push({ t: "lp", v: c, pos: i++ }); continue; }
    if (c === ")") { out.push({ t: "rp", v: c, pos: i++ }); continue; }
    if (c === ",") { out.push({ t: "comma", v: c, pos: i++ }); continue; }
    if (c === '"' || c === "'") {
      const q = c; let j = i + 1, s = "";
      while (j < src.length && src[j] !== q) { if (src[j] === "\\") j++; s += src[j++]; }
      if (j >= src.length) throw new EqlError(`Unterminated string at ${i}`);
      out.push({ t: "str", v: s, pos: i }); i = j + 1; continue;
    }
    const two = src.slice(i, i + 2);
    if ([">=", "<=", "!=", "!~"].includes(two)) { out.push({ t: "op", v: two, pos: i }); i += 2; continue; }
    if ("=<>~".includes(c)) { out.push({ t: "op", v: c, pos: i++ }); continue; }
    let j = i;
    while (j < src.length && /[^\s()=<>!~,"']/.test(src[j])) j++;
    if (j === i) throw new EqlError(`Unexpected character '${c}' at ${i}`);
    out.push({ t: "word", v: src.slice(i, j), pos: i }); i = j;
  }
  return out;
}

export type Node =
  | { k: "and" | "or"; l: Node; r: Node }
  | { k: "not"; e: Node }
  | { k: "cmp"; field: string; op: string; value: Val }
  | { k: "in"; field: string; neg: boolean; values: Val[] }
  | { k: "empty"; field: string; neg: boolean };
export type Val = { kind: "lit"; v: string } | { kind: "fn"; name: string };
export interface Parsed { where: Node | null; orderBy: { field: string; dir: "asc" | "desc" }[] }

export function parse(src: string): Parsed {
  const toks = tokenize(src);
  let p = 0;
  const peek = () => toks[p];
  const kw = (w: string) => peek()?.t === "word" && peek()!.v.toUpperCase() === w;
  const expect = (t: Tok["t"]) => { const x = toks[p++]; if (!x || x.t !== t) throw new EqlError(`Expected ${t} at ${x?.pos ?? "end"}`); return x; };

  const value = (): Val => {
    const x = toks[p++];
    if (!x) throw new EqlError("Expected a value");
    if (x.t === "str") return { kind: "lit", v: x.v };
    if (x.t === "word") {
      if (peek()?.t === "lp") { p++; expect("rp"); return { kind: "fn", name: x.v.toLowerCase() }; }
      return { kind: "lit", v: x.v };
    }
    throw new EqlError(`Unexpected '${x.v}' at ${x.pos}`);
  };
  const clause = (): Node => {
    const f = expect("word").v;
    if (kw("IS")) {
      p++; const neg = kw("NOT"); if (neg) p++;
      if (!kw("EMPTY") && !kw("NULL")) throw new EqlError("Expected EMPTY after IS");
      p++; return { k: "empty", field: f, neg };
    }
    let neg = false;
    if (kw("NOT")) { p++; neg = true; if (!kw("IN")) throw new EqlError("Expected IN after NOT"); }
    if (kw("IN")) {
      p++; expect("lp"); const values = [value()];
      while (peek()?.t === "comma") { p++; values.push(value()); }
      expect("rp"); return { k: "in", field: f, neg, values };
    }
    const op = expect("op").v;
    return { k: "cmp", field: f, op, value: value() };
  };
  const notExpr = (): Node => {
    if (kw("NOT")) { p++; return { k: "not", e: notExpr() }; }
    if (peek()?.t === "lp") { p++; const e = orExpr(); expect("rp"); return e; }
    return clause();
  };
  const andExpr = (): Node => { let l = notExpr(); while (kw("AND")) { p++; l = { k: "and", l, r: notExpr() }; } return l; };
  const orExpr = (): Node => { let l = andExpr(); while (kw("OR")) { p++; l = { k: "or", l, r: andExpr() }; } return l; };

  let where: Node | null = null;
  if (toks.length && !kw("ORDER")) where = orExpr();
  const orderBy: Parsed["orderBy"] = [];
  if (kw("ORDER")) {
    p++; if (!kw("BY")) throw new EqlError("Expected BY after ORDER"); p++;
    do {
      if (peek()?.t === "comma") p++;
      const field = expect("word").v; let dir: "asc" | "desc" = "asc";
      if (kw("ASC") || kw("DESC")) dir = toks[p++].v.toLowerCase() as "asc" | "desc";
      orderBy.push({ field, dir });
    } while (peek()?.t === "comma");
  }
  if (p < toks.length) throw new EqlError(`Unexpected '${toks[p].v}' at ${toks[p].pos}`);
  return { where, orderBy };
}

export interface CompileEnv { userId: string; now?: Date; resolveUser?: (s: string) => string | null }

const FIELDS: Record<string, string> = {
  project: "project", status: "status", statuscategory: "statusCategory", assignee: "assignee", reporter: "reporter",
  priority: "priority", type: "type", issuetype: "type", labels: "labels", label: "labels", sprint: "sprint",
  duedate: "dueDate", due: "dueDate", created: "createdAt", updated: "updatedAt", resolved: "resolvedAt",
  summary: "summary", text: "text", storypoints: "storyPoints", points: "storyPoints", key: "key",
  showstopper: "isShowStopper", severity: "severity", parent: "parent", epic: "parent", component: "components", resolution: "resolution",
};

function startOf(unit: "day" | "week" | "month", now: Date) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (unit === "week") d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  if (unit === "month") d.setUTCDate(1);
  return d;
}

function toDate(v: Val, env: CompileEnv): Date {
  const now = env.now ?? new Date();
  if (v.kind === "fn") {
    if (v.name === "today") return startOf("day", now);
    if (v.name === "now") return now;
    if (v.name === "startofweek") return startOf("week", now);
    if (v.name === "startofmonth") return startOf("month", now);
    throw new EqlError(`${v.name}() is not a date function`);
  }
  const rel = /^([+-]?\d+)([dwmh])$/.exec(v.v);
  if (rel) {
    const n = Number(rel[1]); const d = new Date(now);
    if (rel[2] === "h") d.setUTCHours(d.getUTCHours() + n);
    if (rel[2] === "d") d.setUTCDate(d.getUTCDate() + n);
    if (rel[2] === "w") d.setUTCDate(d.getUTCDate() + 7 * n);
    if (rel[2] === "m") d.setUTCMonth(d.getUTCMonth() + n);
    return d;
  }
  const d = new Date(v.v);
  if (isNaN(d.getTime())) throw new EqlError(`Invalid date '${v.v}'`);
  return d;
}

const lit = (v: Val) => { if (v.kind !== "lit") throw new EqlError(`Function ${v.name}() not valid here`); return v.v; };

function cmp(field: string, op: string, v: Val, env: CompileEnv): Prisma.IssueWhereInput {
  const f = FIELDS[field.toLowerCase()];
  if (!f) throw new EqlError(`Unknown field '${field}'`);
  const eqOnly = (w: Prisma.IssueWhereInput) => {
    if (op === "=") return w;
    if (op === "!=") return { NOT: w };
    throw new EqlError(`Operator ${op} not supported for ${field}`);
  };
  const user = (val: Val) => {
    if (val.kind === "fn") { if (val.name !== "currentuser") throw new EqlError(`Unknown function ${val.name}()`); return env.userId; }
    const r = env.resolveUser?.(val.v); return r ?? val.v;
  };
  switch (f) {
    case "project": return eqOnly({ project: { key: lit(v).toUpperCase() } });
    case "key": return eqOnly({ key: lit(v).toUpperCase() });
    case "status": return eqOnly({ status: { name: { equals: lit(v), mode: "insensitive" } } });
    case "statusCategory": {
      const m: Record<string, string> = { "to do": "TODO", todo: "TODO", "in progress": "IN_PROGRESS", done: "DONE" };
      return eqOnly({ status: { category: m[lit(v).toLowerCase()] ?? lit(v).toUpperCase() } });
    }
    case "priority": return eqOnly({ priority: { equals: lit(v), mode: "insensitive" } });
    case "severity": return eqOnly({ severity: lit(v).toUpperCase() });
    case "resolution": return eqOnly({ resolution: { equals: lit(v), mode: "insensitive" } });
    case "type": return eqOnly({ type: { name: { equals: lit(v), mode: "insensitive" } } });
    case "assignee": return eqOnly({ assigneeId: user(v) });
    case "reporter": return eqOnly({ reporterId: user(v) });
    case "labels": return eqOnly({ labels: { has: lit(v) } });
    case "components": return eqOnly({ components: { has: lit(v) } });
    case "parent": return eqOnly({ parent: { key: lit(v).toUpperCase() } });
    case "isShowStopper": return eqOnly({ isShowStopper: ["true", "yes", "1"].includes(lit(v).toLowerCase()) });
    case "sprint":
      if (v.kind === "fn") { if (v.name !== "opensprints") throw new EqlError(`Unknown function ${v.name}()`); return eqOnly({ sprint: { state: "ACTIVE" } }); }
      return eqOnly({ sprint: { name: { equals: lit(v), mode: "insensitive" } } });
    case "summary":
    case "text": {
      if (op !== "~" && op !== "!~") throw new EqlError(`Use ~ for text search on ${field}`);
      const s = lit(v);
      const w: Prisma.IssueWhereInput = f === "summary" ? { summary: { contains: s, mode: "insensitive" } }
        : { OR: [{ summary: { contains: s, mode: "insensitive" } }, { description: { contains: s, mode: "insensitive" } }, { key: { equals: s.toUpperCase() } }] };
      return op === "~" ? w : { NOT: w };
    }
    case "storyPoints": {
      const n = Number(lit(v)); if (isNaN(n)) throw new EqlError("storyPoints needs a number");
      return numericOrDate("storyPoints", op, n);
    }
    default: return numericOrDate(f, op, toDate(v, env));
  }
}

function numericOrDate(f: string, op: string, val: number | Date): Prisma.IssueWhereInput {
  const map: Record<string, string> = { "=": "equals", ">": "gt", ">=": "gte", "<": "lt", "<=": "lte" };
  if (op === "!=") return { NOT: { [f]: { equals: val } } };
  if (!map[op]) throw new EqlError(`Operator ${op} not supported for ${f}`);
  return { [f]: { [map[op]]: val } };
}

function emptyClause(field: string, neg: boolean): Prisma.IssueWhereInput {
  const f = FIELDS[field.toLowerCase()];
  if (!f) throw new EqlError(`Unknown field '${field}'`);
  const col: Record<string, string> = { assignee: "assigneeId", sprint: "sprintId", parent: "parentId" };
  const c = col[f] ?? f;
  if (c === "labels" || c === "components") return neg ? { NOT: { [c]: { isEmpty: true } } } : { [c]: { isEmpty: true } };
  return neg ? { NOT: { [c]: null } } : { [c]: null };
}

export function compile(node: Node | null, env: CompileEnv): Prisma.IssueWhereInput {
  if (!node) return {};
  switch (node.k) {
    case "and": return { AND: [compile(node.l, env), compile(node.r, env)] };
    case "or": return { OR: [compile(node.l, env), compile(node.r, env)] };
    case "not": return { NOT: compile(node.e, env) };
    case "cmp": return cmp(node.field, node.op, node.value, env);
    case "empty": return emptyClause(node.field, node.neg);
    case "in": {
      const w: Prisma.IssueWhereInput = { OR: node.values.map((v) => cmp(node.field, "=", v, env)) };
      return node.neg ? { NOT: w } : w;
    }
  }
}

const ORDER_FIELDS: Record<string, string> = {
  created: "createdAt", updated: "updatedAt", duedate: "dueDate", priority: "priority", key: "number", rank: "rank",
  storypoints: "storyPoints", summary: "summary", resolved: "resolvedAt",
};
export function compileOrder(order: Parsed["orderBy"]): Prisma.IssueOrderByWithRelationInput[] {
  if (!order.length) return [{ updatedAt: "desc" }];
  return order.map((o) => {
    const f = o.field.toLowerCase();
    if (f === "status") return { status: { sortOrder: o.dir } };
    if (f === "assignee") return { assignee: { name: o.dir } };
    const c = ORDER_FIELDS[f];
    if (!c) throw new EqlError(`Cannot sort by '${o.field}'`);
    return { [c]: o.dir };
  });
}
