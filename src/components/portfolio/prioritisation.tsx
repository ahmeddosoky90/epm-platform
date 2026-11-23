"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client";
import { useToast } from "@/components/ui/toast";
import { Modal } from "@/components/ui/modal";
import { Card, Health, Chip } from "@/components/ui/bits";

/* eslint-disable @typescript-eslint/no-explicit-any */
export function Prioritisation({ criteria, ranked, canEdit }: { criteria: { id: string; name: string; weight: number }[]; ranked: any[]; canEdit: boolean }) {
  const [edit, setEdit] = useState<any | null>(null); const toast = useToast(); const router = useRouter();
  return (<Card title="Prioritisation (weighted scoring)" action={<span className="text-xs muted">{criteria.map((c) => `${c.name} ${c.weight}%`).join(" · ")}</span>} pad={false}>
    <div className="overflow-x-auto"><table className="table"><thead><tr><th>Rank</th><th>Project</th>{criteria.map((c) => <th key={c.id} className="text-center">{c.name.split(" ")[0]}</th>)}<th>Score</th><th>Health</th><th /></tr></thead>
      <tbody>{ranked.map((p) => <tr key={p.id}><td className="font-semibold">#{p.rank}{p.override != null && <span title={p.reason}> <Chip color="#ff9f0a">override</Chip></span>}</td><td><Link className="text-accent" href={`/projects/${p.key}`}>{p.name}</Link></td>
        {criteria.map((c) => <td key={c.id} className="text-center tabular-nums">{p.scores[c.id] ?? "–"}</td>)}<td className="font-semibold">{p.score}</td><td><Health h={p.health} /></td><td>{canEdit && <button className="btn-ghost btn-sm" onClick={() => setEdit({ ...p, scoresDraft: { ...p.scores }, overrideDraft: p.override ?? "", reasonDraft: p.reason ?? "" })}>Score</button>}</td></tr>)}</tbody></table></div>
    <Modal open={!!edit} onClose={() => setEdit(null)} title={`Score ${edit?.name ?? ""}`}>
      {edit && <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); try { await apiFetch(`/api/projects/${edit.id}/scores`, { method: "PUT", json: { scores: Object.fromEntries(Object.entries(edit.scoresDraft).map(([k, v]) => [k, Number(v)])), override: edit.overrideDraft === "" ? null : Number(edit.overrideDraft), reason: edit.reasonDraft || undefined } }); toast.ok("Prioritisation updated"); setEdit(null); router.refresh(); } catch (x) { toast.err(x); } }}>
        {criteria.map((c) => <div key={c.id} className="flex items-center gap-3"><label className="text-sm flex-1">{c.name} <span className="muted text-xs">({c.weight}%)</span></label><input type="range" min={0} max={10} value={edit.scoresDraft[c.id] ?? 0} onChange={(e) => setEdit({ ...edit, scoresDraft: { ...edit.scoresDraft, [c.id]: e.target.value } })} /><span className="w-6 text-end tabular-nums">{edit.scoresDraft[c.id] ?? 0}</span></div>)}
        <hr className="border-line" />
        <div className="grid grid-cols-[100px_1fr] gap-3"><div><label className="label">Override rank</label><input type="number" min={1} className="input" value={edit.overrideDraft} onChange={(e) => setEdit({ ...edit, overrideDraft: e.target.value })} /></div><div><label className="label">Justification {edit.overrideDraft !== "" && "(required)"}</label><input className="input" required={edit.overrideDraft !== ""} value={edit.reasonDraft} onChange={(e) => setEdit({ ...edit, reasonDraft: e.target.value })} /></div></div>
        <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setEdit(null)}>Cancel</button><button className="btn-primary">Save</button></div>
      </form>}
    </Modal>
  </Card>);
}
