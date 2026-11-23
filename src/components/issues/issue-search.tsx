"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, Save, Search } from "lucide-react";
import { apiFetch } from "@/lib/client";
import { useToast } from "@/components/ui/toast";
import { Chip, Priority, Avatar, Empty } from "@/components/ui/bits";

type Row = { id: string; key: string; summary: string; priority: string; status: { name: string; color: string }; type: { name: string; color: string }; assignee: { name: string } | null; dueDate: string | null; storyPoints: string | null; isShowStopper: boolean; updatedAt: string };
type Meta = { members: { id: string; name: string }[] };

export function IssueSearch({ initialJql, lockedPrefix, showFilters = true, canExport }: { initialJql: string; lockedPrefix?: string; showFilters?: boolean; canExport?: boolean }) {
  const sp = useSearchParams(); const router = useRouter(); const toast = useToast();
  const [jql, setJql] = useState(sp.get("jql") ?? initialJql);
  const [rows, setRows] = useState<Row[] | null>(null); const [total, setTotal] = useState(0); const [page, setPage] = useState(1);
  const [err, setErr] = useState<string | null>(null); const [sel, setSel] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<{ id: string; name: string; jql: string; shared: boolean }[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const full = lockedPrefix ? `${lockedPrefix}${jql.trim() && !/^order by/i.test(jql.trim()) ? ` AND (${jql.replace(/\s+order by.*$/i, "")})` : ""}${/order by/i.test(jql) ? " " + jql.match(/order by.*$/i)![0] : ""}` : jql;
  const load = useCallback(async (q: string, pg = 1) => {
    setErr(null);
    try { const r = await apiFetch<{ items: Row[]; total: number }>(`/api/search?jql=${encodeURIComponent(q)}&page=${pg}&pageSize=50`); setRows(r.items); setTotal(r.total); setPage(pg); setSel(new Set()); }
    catch (e) { setErr((e as Error).message); setRows([]); }
  }, []);
  useEffect(() => { load(full); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  useEffect(() => { if (showFilters) apiFetch<typeof filters>("/api/filters").then(setFilters).catch(() => {}); apiFetch<Meta>("/api/meta").then(setMeta).catch(() => {}); }, [showFilters]);
  const run = (e?: React.FormEvent) => { e?.preventDefault(); load(full); if (!lockedPrefix) router.replace(`?jql=${encodeURIComponent(jql)}`); };
  const bulk = async (json: Record<string, unknown>) => {
    try { const r = await apiFetch<{ updated: number; failed: number; results: { key: string; error?: string }[] }>("/api/issues/bulk", { method: "POST", json: { keys: [...sel], ...json } });
      if (r.failed) toast.err(`${r.updated} updated, ${r.failed} failed: ${r.results.filter((x) => x.error).map((x) => `${x.key} ${x.error}`).join("; ")}`); else toast.ok(`${r.updated} issues updated`);
      load(full, page); } catch (e) { toast.err(e); }
  };
  return (
    <div>
      <form onSubmit={run} className="flex gap-2 mb-3 flex-wrap">
        {lockedPrefix && <span className="chip h-9 px-3 bg-black/5 text-ink-2 text-xs self-center">{lockedPrefix} AND</span>}
        <div className="relative flex-1 min-w-[300px]"><Search className="h-4 w-4 muted absolute start-3 top-1/2 -translate-y-1/2" />
          <input className="input ps-9 font-mono text-[13px]" value={jql} onChange={(e) => setJql(e.target.value)} placeholder='e.g. status = "In Progress" AND assignee = currentUser() ORDER BY dueDate' aria-label="Query" /></div>
        <button className="btn-primary">Search</button>
        {showFilters && <button type="button" className="btn-secondary" onClick={async () => { const name = (document.getElementById("save-name") as HTMLInputElement)?.value; if (!name) return toast.err("Enter a name for the filter first"); try { await apiFetch("/api/filters", { method: "POST", json: { name, jql: full, shared: (document.getElementById("save-shared") as HTMLInputElement).checked } }); toast.ok("Filter saved"); setFilters(await apiFetch("/api/filters")); } catch (x) { toast.err(x); } }}><Save className="h-4 w-4" />Save</button>}
        {canExport && <a className="btn-secondary" href={`/api/export/issues?format=xlsx&jql=${encodeURIComponent(full)}`}><Download className="h-4 w-4" />Excel</a>}
        {canExport && <a className="btn-secondary" href={`/api/export/issues?format=csv&jql=${encodeURIComponent(full)}`}>CSV</a>}
      </form>
      {showFilters && <div className="flex gap-2 items-center mb-4 flex-wrap text-xs">
        <input id="save-name" className="input !h-7 !w-44 text-xs" placeholder="Filter name to save" /><label className="flex items-center gap-1"><input id="save-shared" type="checkbox" />share</label>
        <span className="muted ms-2">Saved:</span>{filters.map((f) => <button key={f.id} className="chip bg-accent-soft text-accent h-6 px-2.5" onClick={() => { setJql(f.jql); load(f.jql); }}>{f.name}{f.shared ? " ·" : ""}</button>)}
        <span className="muted ms-2">Fields: project status statusCategory assignee reporter priority type labels sprint dueDate created updated resolved summary~ text~ storyPoints showStopper severity parent · functions: currentUser() today() now() openSprints() startOfWeek() -7d</span>
      </div>}
      {err && <div role="alert" className="card p-3 mb-3 text-sm text-[#ff3b30]">{err}</div>}
      {sel.size > 0 && meta && <div className="card p-2 mb-3 flex gap-2 items-center flex-wrap text-sm glass sticky top-16 z-10"><b className="px-2">{sel.size} selected</b>
        <select className="input !h-8 !w-44" defaultValue="" onChange={(e) => { if (e.target.value) bulk({ patch: { assigneeId: e.target.value === "none" ? null : e.target.value } }); e.target.value = ""; }}><option value="">Assign to…</option><option value="none">Unassigned</option>{meta.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
        <select className="input !h-8 !w-36" defaultValue="" onChange={(e) => { if (e.target.value) bulk({ patch: { priority: e.target.value } }); e.target.value = ""; }}><option value="">Priority…</option>{["Blocker", "Critical", "High", "Medium", "Low"].map((p) => <option key={p}>{p}</option>)}</select>
        <button className="btn-ghost btn-sm" onClick={() => setSel(new Set())}>Clear</button></div>}
      <div className="card overflow-x-auto">
        {rows === null ? <div className="p-6 text-sm muted">Loading…</div> : rows.length === 0 ? <Empty title="No issues match this query" /> :
        <table className="table"><thead><tr><th className="w-8"><input type="checkbox" aria-label="Select all" checked={sel.size === rows.length} onChange={(e) => setSel(e.target.checked ? new Set(rows.map((r) => r.key)) : new Set())} /></th><th>Key</th><th>Summary</th><th>Type</th><th>Status</th><th>Priority</th><th>Assignee</th><th>Points</th><th>Due</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.id}>
            <td><input type="checkbox" aria-label={`Select ${r.key}`} checked={sel.has(r.key)} onChange={(e) => { const s = new Set(sel); if (e.target.checked) s.add(r.key); else s.delete(r.key); setSel(s); }} /></td>
            <td className="whitespace-nowrap"><Link className="text-accent font-medium" href={`/issues/${r.key}`}>{r.key}</Link></td>
            <td className="max-w-[420px]"><span className="truncate block">{r.isShowStopper && <span className="text-[#ff3b30] font-semibold me-1">⛔</span>}{r.summary}</span></td>
            <td><Chip color={r.type.color}>{r.type.name}</Chip></td><td><Chip color={r.status.color}>{r.status.name}</Chip></td><td><Priority p={r.priority} /></td>
            <td><span className="flex items-center gap-1.5 text-xs"><Avatar name={r.assignee?.name} size={18} />{r.assignee?.name ?? "Unassigned"}</span></td>
            <td className="text-xs">{r.storyPoints ?? ""}</td><td className={`text-xs whitespace-nowrap ${r.dueDate && new Date(r.dueDate) < new Date() && r.status.name !== "Done" ? "text-[#ff3b30]" : ""}`}>{r.dueDate?.slice(0, 10) ?? ""}</td>
          </tr>)}</tbody></table>}
      </div>
      {total > 50 && <div className="flex justify-end gap-2 mt-3 items-center text-xs"><button className="btn-secondary btn-sm" disabled={page === 1} onClick={() => load(full, page - 1)}>Previous</button><span className="muted">Page {page} of {Math.ceil(total / 50)} · {total} issues</span><button className="btn-secondary btn-sm" disabled={page * 50 >= total} onClick={() => load(full, page + 1)}>Next</button></div>}
      {total <= 50 && rows && rows.length > 0 && <div className="text-xs muted mt-2 text-end">{total} issues</div>}
    </div>
  );
}
