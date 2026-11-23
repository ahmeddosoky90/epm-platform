"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client";
import { useToast } from "@/components/ui/toast";
import { Card, Chip } from "@/components/ui/bits";
import { money } from "@/lib/format";

/* eslint-disable @typescript-eslint/no-explicit-any */
type A = { projectId: string; included: boolean; budgetOverride?: string | null };
/** What-if planning on a copy of assumptions — never writes to live projects. */
export function Scenarios({ portfolioId, projects, saved, canEdit, currency }: { portfolioId: string; projects: any[]; saved: any[]; canEdit: boolean; currency: string }) {
  const base: A[] = projects.map((p) => ({ projectId: p.id, included: true, budgetOverride: null }));
  const [cur, setCur] = useState<{ id?: string; name: string; assumptions: A[] }>({ name: "New scenario", assumptions: base });
  const [compare, setCompare] = useState<string>(""); const toast = useToast(); const router = useRouter();
  const total = (as: A[]) => as.filter((a) => a.included).reduce((s, a) => s + Number(a.budgetOverride ?? projects.find((p) => p.id === a.projectId)?.approved ?? 0), 0);
  const cmp = saved.find((s) => s.id === compare);
  const baseline = useMemo(() => total(base), [projects]); // eslint-disable-line react-hooks/exhaustive-deps
  return (<Card title="Scenario planning" action={<span className="text-xs muted">Scenarios never change live project data.</span>}>
    <div className="flex gap-2 mb-3 flex-wrap items-center">
      <input className="input !w-56" value={cur.name} onChange={(e) => setCur({ ...cur, name: e.target.value })} aria-label="Scenario name" />
      <select className="input !w-56" value={cur.id ?? ""} onChange={(e) => { const s = saved.find((x) => x.id === e.target.value); setCur(s ? { id: s.id, name: s.name, assumptions: base.map((b) => s.assumptions.find((a: A) => a.projectId === b.projectId) ?? b) } : { name: "New scenario", assumptions: base }); }}><option value="">New scenario</option>{saved.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
      {canEdit && <button className="btn-primary btn-sm" onClick={async () => { try { const r: any = await apiFetch(`/api/portfolios/${portfolioId}/scenarios`, { method: "POST", json: cur }); setCur({ ...cur, id: r.id }); toast.ok("Scenario saved"); router.refresh(); } catch (e) { toast.err(e); } }}>Save scenario</button>}
      <span className="text-xs muted ms-4">Compare with</span><select className="input !w-48" value={compare} onChange={(e) => setCompare(e.target.value)}><option value="">Live baseline</option>{saved.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
    </div>
    <div className="grid md:grid-cols-3 gap-3 mb-3 text-sm">
      <div className="card p-3"><div className="text-xs muted">This scenario</div><div className="text-xl font-semibold">{money(total(cur.assumptions), currency, "en", true)}</div><div className="text-xs muted">{cur.assumptions.filter((a) => a.included).length} projects</div></div>
      <div className="card p-3"><div className="text-xs muted">{cmp ? cmp.name : "Live baseline"}</div><div className="text-xl font-semibold">{money(cmp ? total(base.map((b) => cmp.assumptions.find((a: A) => a.projectId === b.projectId) ?? b)) : baseline, currency, "en", true)}</div></div>
      <div className="card p-3"><div className="text-xs muted">Difference</div>{(() => { const d = total(cur.assumptions) - (cmp ? total(base.map((b) => cmp.assumptions.find((a: A) => a.projectId === b.projectId) ?? b)) : baseline); return <div className="text-xl font-semibold" style={{ color: d > 0 ? "#ff3b30" : "#34c759" }}>{d > 0 ? "+" : ""}{money(d, currency, "en", true)}</div>; })()}</div>
    </div>
    <table className="table"><thead><tr><th>Include</th><th>Rank</th><th>Project</th><th className="text-end">Live budget</th><th>Scenario budget</th></tr></thead><tbody>{projects.map((p) => { const a = cur.assumptions.find((x) => x.projectId === p.id)!;
      return <tr key={p.id} className={a.included ? "" : "opacity-50"}><td><input type="checkbox" checked={a.included} onChange={(e) => setCur({ ...cur, assumptions: cur.assumptions.map((x) => x.projectId === p.id ? { ...x, included: e.target.checked } : x) })} aria-label={`Include ${p.name}`} /></td><td>#{p.rank}</td><td>{p.name}{p.status === "PROPOSED" && <Chip color="#5856d6">proposed</Chip>}</td><td className="text-end text-xs">{money(p.approved, currency, "en", true)}</td>
        <td><input className="input !h-8 !w-40" inputMode="decimal" placeholder="same as live" value={a.budgetOverride ?? ""} onChange={(e) => setCur({ ...cur, assumptions: cur.assumptions.map((x) => x.projectId === p.id ? { ...x, budgetOverride: e.target.value || null } : x) })} /></td></tr>; })}</tbody></table>
  </Card>);
}
