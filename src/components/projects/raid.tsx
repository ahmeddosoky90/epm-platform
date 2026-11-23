"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { apiFetch } from "@/lib/client";
import { useToast } from "@/components/ui/toast";
import { Modal } from "@/components/ui/modal";
import { Chip, Stat, Card, Empty } from "@/components/ui/bits";
import { riskBand } from "@/lib/calc/risk";

/* eslint-disable @typescript-eslint/no-explicit-any */
export function RaidView({ data, canEdit }: { data: any; canEdit: boolean }) {
  const [tab, setTab] = useState<"RISK" | "ISSUE" | "ASSUMPTION" | "DEPENDENCY" | "ACTION">("RISK");
  const [edit, setEdit] = useState<any | null>(null); const toast = useToast(); const router = useRouter();
  const s = data.summary; const owner = (id: string | null) => data.members.find((m: any) => m.id === id)?.name ?? "—";
  const save = async () => {
    const isRisk = tab === "RISK"; const url = `/api/projects/${data.projectId}/${isRisk ? "risks" : "raid"}`;
    const json: any = { ...edit }; delete json.number; delete json.score; delete json.projectId; delete json.createdAt; delete json.updatedAt;
    if (isRisk) { json.probability = Number(json.probability); json.impact = Number(json.impact); } else json.kind = tab;
    if (json.dueDate) json.dueDate = json.dueDate.slice(0, 10); if (json.targetDate) json.targetDate = json.targetDate.slice(0, 10);
    for (const k of Object.keys(json)) if (json[k] === "") json[k] = k === "ownerId" || k.endsWith("Date") ? null : undefined;
    try { await apiFetch(url, { method: edit.id ? "PATCH" : "POST", json }); toast.ok("Saved"); setEdit(null); router.refresh(); } catch (e) { toast.err(e); }
  };
  const rows = tab === "RISK" ? data.risks : data.items.filter((i: any) => i.kind === tab);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
        <Stat label="Open risks" value={s.openRisks} /><Stat label="High risks" value={s.highRisks} tone={s.highRisks ? "#ff3b30" : undefined} /><Stat label="Overdue risks" value={s.overdueRisks} />
        <Stat label="Open issues" value={s.openIssues} /><Stat label="Critical issues" value={s.criticalIssues} tone={s.criticalIssues ? "#ff3b30" : undefined} /><Stat label="Overdue actions" value={s.overdueActions} /><Stat label="Unresolved deps" value={s.unresolvedDeps} />
      </div>
      <div className="grid lg:grid-cols-[280px_1fr] gap-4">
        <Card title="Risk matrix (open)">
          <div className="grid grid-cols-[auto_repeat(5,1fr)] gap-1 text-[11px]">
            {s.matrix.map((row: number[], i: number) => [<div key={`l${i}`} className="muted pe-1 self-center">P{5 - i}</div>, ...row.map((n, j) => { const sc = (5 - i) * (j + 1); return <div key={`${i}${j}`} className="aspect-square rounded-md flex items-center justify-center font-semibold" style={{ background: `${riskBand(sc).color}${n ? "cc" : "33"}`, color: n ? "#fff" : "transparent" }}>{n || "·"}</div>; })])}
            <div />{[1, 2, 3, 4, 5].map((n) => <div key={n} className="muted text-center">I{n}</div>)}
          </div><p className="text-xs muted mt-2">Score = probability × impact (1–5 each).</p>
        </Card>
        <div>
          <div className="flex items-center gap-2 mb-3"><div className="inline-flex gap-1 p-1 rounded-full bg-black/[0.05]">{(["RISK", "ISSUE", "ASSUMPTION", "DEPENDENCY", "ACTION"] as const).map((t) => <button key={t} className={`tab ${tab === t ? "tab-active" : ""}`} onClick={() => setTab(t)}>{t[0] + t.slice(1).toLowerCase()}s</button>)}</div>
            <span className="flex-1" />{canEdit && <button className="btn-primary btn-sm" onClick={() => setEdit(tab === "RISK" ? { probability: 3, impact: 3, response: "MITIGATE", category: "Delivery", status: "OPEN" } : { status: "OPEN" })}><Plus className="h-4 w-4" />Add</button>}</div>
          <div className="card overflow-x-auto">{rows.length === 0 ? <Empty title="Nothing logged" /> : <table className="table"><thead><tr>{tab === "RISK" ? <><th>#</th><th>Risk</th><th>Category</th><th>P×I</th><th>Score</th><th>Response</th><th>Owner</th><th>Target</th><th>Status</th></> : <><th>Title</th><th>Owner</th>{tab === "ISSUE" && <th>Severity</th>}<th>Due</th><th>Status</th>{tab === "DEPENDENCY" && <th>External</th>}{tab === "ISSUE" && <th>Escalated</th>}<th>Impact</th></>}</tr></thead>
            <tbody>{rows.map((r: any) => <tr key={r.id} className={canEdit ? "cursor-pointer" : ""} onClick={() => canEdit && setEdit({ ...r })}>{tab === "RISK" ? <><td>R{r.number}</td><td className="max-w-[300px] truncate">{r.title}</td><td>{r.category}</td><td>{r.probability}×{r.impact}</td><td><Chip color={riskBand(r.score).color}>{r.score} {riskBand(r.score).label}</Chip></td><td className="text-xs">{r.response}</td><td className="text-xs">{owner(r.ownerId)}</td><td className={`text-xs ${r.targetDate && new Date(r.targetDate) < new Date() && r.status !== "CLOSED" ? "text-[#ff3b30]" : ""}`}>{r.targetDate?.slice(0, 10) ?? "—"}</td><td><Chip color={r.status === "CLOSED" ? "#8e8e93" : "#0a84ff"}>{r.status}</Chip></td></>
              : <><td className="max-w-[300px] truncate">{r.title}</td><td className="text-xs">{owner(r.ownerId)}</td>{tab === "ISSUE" && <td>{r.severity && <Chip color={r.severity === "Critical" ? "#ff3b30" : "#ff9f0a"}>{r.severity}</Chip>}</td>}<td className={`text-xs ${r.dueDate && new Date(r.dueDate) < new Date() && r.status === "OPEN" ? "text-[#ff3b30]" : ""}`}>{r.dueDate?.slice(0, 10) ?? "—"}</td><td><Chip color="#0a84ff">{r.status}</Chip></td>{tab === "DEPENDENCY" && <td>{r.external ? "Yes" : "No"}</td>}{tab === "ISSUE" && <td>{r.escalated ? "Yes" : "—"}</td>}<td className="text-xs muted max-w-[200px] truncate">{r.impact}</td></>}</tr>)}</tbody></table>}</div>
        </div>
      </div>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={`${edit?.id ? "Edit" : "New"} ${tab.toLowerCase()}`} wide>
        {edit && <form className="grid grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); save(); }}>
          <div className="col-span-2"><label className="label">Title *</label><input className="input" required value={edit.title ?? ""} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></div>
          <div className="col-span-2"><label className="label">Description</label><textarea className="input" rows={2} value={edit.description ?? ""} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></div>
          <div><label className="label">Owner</label><select className="input" value={edit.ownerId ?? ""} onChange={(e) => setEdit({ ...edit, ownerId: e.target.value })}><option value="">—</option>{data.members.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
          {tab === "RISK" ? <>
            <div><label className="label">Category</label><select className="input" value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })}>{["Delivery", "Technical", "Regulatory", "Financial", "Resource", "Security", "Vendor"].map((x) => <option key={x}>{x}</option>)}</select></div>
            <div><label className="label">Probability (1–5)</label><input type="number" min={1} max={5} className="input" value={edit.probability} onChange={(e) => setEdit({ ...edit, probability: e.target.value })} /></div>
            <div><label className="label">Impact (1–5)</label><input type="number" min={1} max={5} className="input" value={edit.impact} onChange={(e) => setEdit({ ...edit, impact: e.target.value })} /></div>
            <div><label className="label">Response</label><select className="input" value={edit.response} onChange={(e) => setEdit({ ...edit, response: e.target.value })}>{["AVOID", "MITIGATE", "TRANSFER", "ACCEPT"].map((x) => <option key={x}>{x}</option>)}</select></div>
            <div><label className="label">Target date</label><input type="date" className="input" value={edit.targetDate?.slice(0, 10) ?? ""} onChange={(e) => setEdit({ ...edit, targetDate: e.target.value })} /></div>
            <div className="col-span-2"><label className="label">Mitigation plan</label><textarea className="input" rows={2} value={edit.mitigation ?? ""} onChange={(e) => setEdit({ ...edit, mitigation: e.target.value })} /></div>
            <div><label className="label">Status</label><select className="input" value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}>{["OPEN", "MITIGATING", "CLOSED"].map((x) => <option key={x}>{x}</option>)}</select></div>
            <div className="self-end text-sm">Score: <b>{Number(edit.probability) * Number(edit.impact)}</b> ({riskBand(Number(edit.probability) * Number(edit.impact)).label})</div>
          </> : <>
            <div><label className="label">Due / validation date</label><input type="date" className="input" value={edit.dueDate?.slice(0, 10) ?? ""} onChange={(e) => setEdit({ ...edit, dueDate: e.target.value })} /></div>
            {tab === "ISSUE" && <div><label className="label">Severity</label><select className="input" value={edit.severity ?? ""} onChange={(e) => setEdit({ ...edit, severity: e.target.value || null })}><option value="">—</option>{["Critical", "High", "Medium", "Low"].map((x) => <option key={x}>{x}</option>)}</select></div>}
            <div><label className="label">Status</label><select className="input" value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}>{(tab === "ASSUMPTION" ? ["OPEN", "VALIDATED", "INVALID"] : tab === "DEPENDENCY" ? ["OPEN", "ON_TRACK", "AT_RISK", "BLOCKED", "RESOLVED"] : ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]).map((x) => <option key={x}>{x}</option>)}</select></div>
            <div className="col-span-2"><label className="label">{tab === "ASSUMPTION" ? "Impact if invalid" : tab === "ISSUE" ? "Resolution plan / impact" : "Impact"}</label><input className="input" value={edit.impact ?? ""} onChange={(e) => setEdit({ ...edit, impact: e.target.value })} /></div>
            {tab === "DEPENDENCY" && <label className="flex gap-2 text-sm"><input type="checkbox" checked={!!edit.external} onChange={(e) => setEdit({ ...edit, external: e.target.checked })} />External dependency</label>}
            {tab === "ISSUE" && <label className="flex gap-2 text-sm"><input type="checkbox" checked={!!edit.escalated} onChange={(e) => setEdit({ ...edit, escalated: e.target.checked })} />Escalated</label>}
          </>}
          <div className="col-span-2 flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setEdit(null)}>Cancel</button><button className="btn-primary">Save</button></div>
        </form>}
      </Modal>
    </div>
  );
}
