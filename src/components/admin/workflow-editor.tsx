"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ArrowRight } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/client";

type S = { id: string; name: string; category: string; color: string; isInitial: boolean };
type T = { id: string; name: string; fromStatusId: string | null; toStatusId: string; allowedRoles: string[]; requiredFields: string[]; conditions: Record<string, boolean>; postFunctions: Record<string, unknown> };
type W = { id: string; name: string; description: string | null; version: number; statuses: S[]; transitions: T[]; projects: { key: string }[] };
const FIELDS = [["assigneeId", "Assignee"], ["resolution", "Resolution"], ["storyPoints", "Story points"], ["dueDate", "Due date"], ["fixVersionId", "Fix version"], ["originalEstimateMin", "Estimate"]];
const CONDS = [["noOpenBlockers", "No open blocking issues"], ["assigneeOnly", "Only the assignee can do it"], ["requireApproval", "Requires approval recorded on the issue"]];

export function WorkflowEditor({ wf, roles, history }: { wf: W; roles: { key: string; name: string }[]; history: { id: string; createdAt: string; after: { op?: string } | null }[] }) {
  const [t, setT] = useState<T | null>(null); const [ns, setNs] = useState({ name: "", category: "TODO", color: "#8e8e93" }); const [nt, setNt] = useState({ name: "", fromStatusId: "", toStatusId: "" });
  const toast = useToast(); const router = useRouter();
  const op = async (json: Record<string, unknown>, msg: string) => { try { await apiFetch(`/api/admin/workflows/${wf.id}`, { method: "PATCH", json }); toast.ok(msg); router.refresh(); return true; } catch (e) { toast.err(e); return false; } };
  const sName = (id: string | null) => (id ? wf.statuses.find((s) => s.id === id)?.name : "Any status");
  return (<>
    <div className="flex items-center gap-2 mb-4"><Link href="/admin/workflows" className="text-sm text-accent">Workflows</Link><span className="muted">/</span><h2 className="font-semibold">{wf.name}</h2><span className="chip">v{wf.version}</span><span className="text-xs muted">Used by {wf.projects.map((p) => p.key).join(", ") || "no projects"}. Changes apply immediately and are versioned in the audit log.</span></div>
    <div className="grid lg:grid-cols-[340px_1fr] gap-4">
      <section className="card p-4 self-start"><h3 className="font-semibold text-sm mb-2">Statuses</h3>
        <ul className="divide-y divide-line">{wf.statuses.map((s) => <li key={s.id} className="py-2 flex items-center gap-2">
          <input type="color" value={s.color} onChange={(e) => op({ op: "updateStatus", id: s.id, color: e.target.value }, "Colour updated")} className="h-6 w-6 rounded border-0 bg-transparent" aria-label={`Colour for ${s.name}`} />
          <span className="text-sm flex-1">{s.name}{s.isInitial && <span className="chip ms-1">initial</span>}</span>
          <select className="input !h-7 !w-auto text-xs" value={s.category} onChange={(e) => op({ op: "updateStatus", id: s.id, category: e.target.value }, "Category updated")} aria-label={`Category for ${s.name}`}><option value="TODO">To do</option><option value="IN_PROGRESS">In progress</option><option value="DONE">Done</option></select>
          {!s.isInitial && <button className="btn-ghost btn-sm !px-1" title="Make initial" onClick={() => op({ op: "updateStatus", id: s.id, isInitial: true }, "Initial status set")}>★</button>}
          <button className="btn-ghost btn-sm !px-1" aria-label={`Delete ${s.name}`} onClick={() => op({ op: "deleteStatus", id: s.id }, "Status deleted")}><Trash2 className="h-3.5 w-3.5" /></button></li>)}</ul>
        <form className="flex gap-1 mt-3" onSubmit={async (e) => { e.preventDefault(); if (await op({ op: "addStatus", ...ns }, "Status added")) setNs({ name: "", category: "TODO", color: "#8e8e93" }); }}>
          <input className="input flex-1" placeholder="New status" required value={ns.name} onChange={(e) => setNs({ ...ns, name: e.target.value })} />
          <select className="input !w-auto" value={ns.category} onChange={(e) => setNs({ ...ns, category: e.target.value })} aria-label="Category"><option value="TODO">To do</option><option value="IN_PROGRESS">In progress</option><option value="DONE">Done</option></select>
          <button className="btn-secondary" aria-label="Add status"><Plus className="h-4 w-4" /></button></form>
      </section>
      <section className="card p-4"><h3 className="font-semibold text-sm mb-2">Transitions</h3>
        <table className="table"><thead><tr><th>Name</th><th>From → to</th><th>Rules</th><th /></tr></thead>
          <tbody>{wf.transitions.map((x) => <tr key={x.id} className="cursor-pointer" onClick={() => setT(x)}>
            <td className="text-sm font-medium">{x.name}</td><td className="text-xs">{sName(x.fromStatusId)} <ArrowRight className="inline h-3 w-3" /> {sName(x.toStatusId)}</td>
            <td className="text-[11px] muted">{[x.allowedRoles.length && `roles: ${x.allowedRoles.length}`, x.requiredFields.length && `needs: ${x.requiredFields.join(", ")}`, ...Object.entries(x.conditions ?? {}).filter(([, v]) => v).map(([k]) => k), ...Object.entries(x.postFunctions ?? {}).filter(([, v]) => v).map(([k, v]) => `${k}${typeof v === "string" ? `=${v}` : ""}`)].filter(Boolean).join(" · ") || "—"}</td>
            <td><button className="btn-ghost btn-sm !px-1" aria-label="Delete transition" onClick={(e) => { e.stopPropagation(); op({ op: "deleteTransition", id: x.id }, "Transition deleted"); }}><Trash2 className="h-3.5 w-3.5" /></button></td></tr>)}</tbody></table>
        <form className="flex flex-wrap gap-1 mt-3" onSubmit={async (e) => { e.preventDefault(); if (await op({ op: "addTransition", name: nt.name, fromStatusId: nt.fromStatusId || null, toStatusId: nt.toStatusId }, "Transition added")) setNt({ name: "", fromStatusId: "", toStatusId: "" }); }}>
          <input className="input !w-44" placeholder="Transition name" required value={nt.name} onChange={(e) => setNt({ ...nt, name: e.target.value })} />
          <select className="input !w-auto" value={nt.fromStatusId} onChange={(e) => setNt({ ...nt, fromStatusId: e.target.value })} aria-label="From"><option value="">From any status</option>{wf.statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          <select className="input !w-auto" required value={nt.toStatusId} onChange={(e) => setNt({ ...nt, toStatusId: e.target.value })} aria-label="To"><option value="">To…</option>{wf.statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          <button className="btn-secondary"><Plus className="h-4 w-4" />Add</button></form>
      </section>
    </div>
    <section className="card p-4 mt-4"><h3 className="font-semibold text-sm mb-2">Version history</h3>{history.length ? <ul className="text-xs space-y-1">{history.map((h) => <li key={h.id}>{new Date(h.createdAt).toLocaleString("en-GB")} · {h.after?.op ?? "change"}</li>)}</ul> : <p className="text-sm muted">No changes since the workflow was created.</p>}</section>
    <Modal open={!!t} onClose={() => setT(null)} title={`Transition · ${t?.name ?? ""}`}>
      {t && <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); if (await op({ op: "updateTransition", id: t.id, name: t.name, allowedRoles: t.allowedRoles, requiredFields: t.requiredFields, conditions: t.conditions, postFunctions: { setResolution: (t.postFunctions.setResolution as string) || null, clearResolution: !!t.postFunctions.clearResolution } }, "Transition saved")) setT(null); }}>
        <div><label className="label">Name</label><input className="input" required value={t.name} onChange={(e) => setT({ ...t, name: e.target.value })} /></div>
        <fieldset><legend className="label">Who can use it (none selected = anyone who may transition issues)</legend><div className="flex flex-wrap gap-1">{roles.map((r) => <label key={r.key} className="chip cursor-pointer"><input type="checkbox" className="me-1" checked={t.allowedRoles.includes(r.key)} onChange={(e) => setT({ ...t, allowedRoles: e.target.checked ? [...t.allowedRoles, r.key] : t.allowedRoles.filter((x) => x !== r.key) })} />{r.name}</label>)}</div></fieldset>
        <fieldset><legend className="label">Fields that must be filled</legend><div className="flex flex-wrap gap-1">{FIELDS.map(([k, l]) => <label key={k} className="chip cursor-pointer"><input type="checkbox" className="me-1" checked={t.requiredFields.includes(k)} onChange={(e) => setT({ ...t, requiredFields: e.target.checked ? [...t.requiredFields, k] : t.requiredFields.filter((x) => x !== k) })} />{l}</label>)}</div></fieldset>
        <fieldset><legend className="label">Conditions</legend>{CONDS.map(([k, l]) => <label key={k} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!t.conditions?.[k]} onChange={(e) => setT({ ...t, conditions: { ...t.conditions, [k]: e.target.checked } })} />{l}</label>)}</fieldset>
        <fieldset><legend className="label">After the move</legend>
          <label className="block text-sm">Set resolution to <input className="input !w-40 !inline-block ms-1" value={(t.postFunctions.setResolution as string) ?? ""} onChange={(e) => setT({ ...t, postFunctions: { ...t.postFunctions, setResolution: e.target.value } })} placeholder="e.g. Done" /></label>
          <label className="flex items-center gap-2 text-sm mt-1"><input type="checkbox" checked={!!t.postFunctions.clearResolution} onChange={(e) => setT({ ...t, postFunctions: { ...t.postFunctions, clearResolution: e.target.checked } })} />Clear resolution (for reopen)</label></fieldset>
        <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setT(null)}>Cancel</button><button className="btn-primary">Save</button></div>
      </form>}
    </Modal>
  </>);
}
