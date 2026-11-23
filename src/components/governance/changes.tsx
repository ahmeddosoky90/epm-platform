"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { apiFetch } from "@/lib/client";
import { useToast } from "@/components/ui/toast";
import { Modal } from "@/components/ui/modal";
import { Chip, Empty } from "@/components/ui/bits";
import { ApprovalActions } from "./approval-actions";
import { money, date } from "@/lib/format";

/* eslint-disable @typescript-eslint/no-explicit-any */
const C: Record<string, string> = { SUBMITTED: "#0a84ff", APPROVED: "#34c759", REJECTED: "#ff3b30", IMPLEMENTED: "#5856d6", CLOSED: "#8e8e93", DRAFT: "#8e8e93" };
export function ChangeList({ data, canCreate, canManage, myRole, isSuper, canApprove }: { data: any; canCreate: boolean; canManage: boolean; myRole: string; isSuper: boolean; canApprove: boolean }) {
  const [open, setOpen] = useState(false); const [f, setF] = useState<Record<string, string>>({ category: "Scope", scheduleImpactDays: "0", financialImpact: "0" });
  const toast = useToast(); const router = useRouter();
  const act = async (id: string, action: string) => { try { await apiFetch(`/api/changes/${id}`, { method: "POST", json: { action } }); toast.ok(action === "implement" ? "Change implemented — baseline, end date and budget updated" : "Closed"); router.refresh(); } catch (e) { toast.err(e); } };
  return (<div>
    <div className="flex justify-between items-center mb-4"><p className="text-sm muted">Approved changes update baselines, end date and budget only when implemented by the project manager.</p>{canCreate && <button className="btn-primary btn-sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" />Raise change request</button>}</div>
    {data.crs.length === 0 ? <div className="card"><Empty title="No change requests" /></div> : <div className="space-y-3">{data.crs.map((c: any) => {
      const current = c.approvals.find((a: any) => a.decision === "PENDING" && c.approvals.filter((x: any) => x.step < a.step).every((x: any) => x.decision === "APPROVED"));
      return <div key={c.id} className="card p-4">
        <div className="flex items-center gap-2 flex-wrap"><span className="text-xs muted font-medium">{data.project.key}-CR-{c.number}</span><h3 className="font-semibold">{c.title}</h3><Chip color={C[c.status]}>{c.status}</Chip><Chip color="#8e8e93">{c.category}</Chip>
          <span className="ms-auto text-xs muted">by {data.users[c.requesterId]} · {date(c.createdAt)}</span></div>
        {c.description && <p className="text-sm mt-2">{c.description}</p>}
        <div className="grid md:grid-cols-4 gap-3 mt-3 text-sm">
          <div><div className="text-xs muted">Schedule impact</div>{c.scheduleImpactDays} days</div><div><div className="text-xs muted">Financial impact</div>{money(c.financialImpact, data.project.currency)}</div>
          <div><div className="text-xs muted">Resource impact</div>{c.resourceImpact || "—"}</div><div><div className="text-xs muted">Risk impact</div>{c.riskImpact || "—"}</div>
        </div>
        {c.justification && <p className="text-xs muted mt-2">Justification: {c.justification}</p>}
        <div className="flex items-center gap-3 mt-3 flex-wrap">{c.approvals.map((a: any) => <span key={a.id} className="text-xs flex items-center gap-1"><span className="chip bg-black/5">{a.step}</span><span className="capitalize">{a.approverRole.replace(/_/g, " ").toLowerCase()}</span><Chip color={a.decision === "APPROVED" ? "#34c759" : a.decision === "REJECTED" ? "#ff3b30" : "#8e8e93"}>{a.decision}</Chip>{a.approver && <span className="muted">{a.approver.name}</span>}</span>)}
          <span className="flex-1" />
          {current && c.status === "SUBMITTED" && canApprove && (isSuper || current.approverRole === myRole) && <ApprovalActions approvalId={current.id} />}
          {canManage && c.status === "APPROVED" && <button className="btn-primary btn-sm" onClick={() => act(c.id, "implement")}>Implement change</button>}
          {canManage && ["IMPLEMENTED", "REJECTED"].includes(c.status) && <button className="btn-secondary btn-sm" onClick={() => act(c.id, "close")}>Close</button>}
        </div>
      </div>; })}</div>}
    <Modal open={open} onClose={() => setOpen(false)} title="Raise change request" wide>
      <form className="grid grid-cols-2 gap-3" onSubmit={async (e) => { e.preventDefault(); try { await apiFetch(`/api/projects/${data.project.id}/changes`, { method: "POST", json: { ...f, scheduleImpactDays: Number(f.scheduleImpactDays || 0), financialImpact: f.financialImpact || "0" } }); toast.ok("Change request submitted"); setOpen(false); router.refresh(); } catch (x) { toast.err(x); } }}>
        <div className="col-span-2"><label className="label">Title *</label><input className="input" required minLength={3} value={f.title ?? ""} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
        <div className="col-span-2"><label className="label">Description</label><textarea className="input" rows={3} value={f.description ?? ""} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
        <div><label className="label">Category</label><select className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{["Scope", "Schedule", "Budget", "Resource", "Quality", "Other"].map((x) => <option key={x}>{x}</option>)}</select></div>
        <div><label className="label">Business justification</label><input className="input" value={f.justification ?? ""} onChange={(e) => setF({ ...f, justification: e.target.value })} /></div>
        <div><label className="label">Schedule impact (days)</label><input type="number" className="input" value={f.scheduleImpactDays} onChange={(e) => setF({ ...f, scheduleImpactDays: e.target.value })} /></div>
        <div><label className="label">Financial impact ({data.project.currency})</label><input className="input" pattern="-?\d+(\.\d{1,2})?" value={f.financialImpact} onChange={(e) => setF({ ...f, financialImpact: e.target.value })} /></div>
        <div><label className="label">Scope impact</label><input className="input" value={f.scopeImpact ?? ""} onChange={(e) => setF({ ...f, scopeImpact: e.target.value })} /></div>
        <div><label className="label">Resource impact</label><input className="input" value={f.resourceImpact ?? ""} onChange={(e) => setF({ ...f, resourceImpact: e.target.value })} /></div>
        <div className="col-span-2"><label className="label">Risk impact</label><input className="input" value={f.riskImpact ?? ""} onChange={(e) => setF({ ...f, riskImpact: e.target.value })} /></div>
        <p className="col-span-2 text-xs muted">Approval chain is set automatically: project manager, then finance if there is a cost, then Head of PMO for changes over 500,000 or more than 14 days.</p>
        <div className="col-span-2 flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button><button className="btn-primary">Submit</button></div>
      </form>
    </Modal>
  </div>);
}
