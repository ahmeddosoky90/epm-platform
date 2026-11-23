"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client";
import { useToast } from "@/components/ui/toast";
import { Modal } from "@/components/ui/modal";

export function ApprovalActions({ approvalId, members }: { approvalId: string; members?: { id: string; name: string }[] }) {
  const [mode, setMode] = useState<null | "APPROVED" | "REJECTED" | "delegate">(null);
  const [comment, setComment] = useState(""); const [to, setTo] = useState(""); const [busy, setBusy] = useState(false);
  const toast = useToast(); const router = useRouter();
  const go = async (json: Record<string, unknown>, msg: string) => { setBusy(true); try { await apiFetch(`/api/approvals/${approvalId}`, { method: "POST", json }); toast.ok(msg); setMode(null); setComment(""); router.refresh(); } catch (e) { toast.err(e); } finally { setBusy(false); } };
  return (<>
    <div className="flex gap-1.5"><button className="btn-primary btn-sm" onClick={() => setMode("APPROVED")}>Approve</button><button className="btn-secondary btn-sm text-[#ff3b30]" onClick={() => setMode("REJECTED")}>Reject</button>{members && <button className="btn-ghost btn-sm" onClick={() => setMode("delegate")}>Delegate</button>}</div>
    <Modal open={mode === "APPROVED" || mode === "REJECTED"} onClose={() => setMode(null)} title={mode === "APPROVED" ? "Approve" : "Reject"}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); go({ decision: mode, comment: comment || undefined }, mode === "APPROVED" ? "Approved" : "Rejected"); }}>
        <label className="label" htmlFor="ap-c">Comment {mode === "REJECTED" && "(required)"}</label>
        <textarea id="ap-c" className="input" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} required={mode === "REJECTED"} />
        <p className="text-xs muted">Your decision, the time and this comment are recorded permanently in the approval history and audit log.</p>
        <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setMode(null)}>Cancel</button><button className={mode === "APPROVED" ? "btn-primary" : "btn-danger"} disabled={busy}>{mode === "APPROVED" ? "Approve" : "Reject"}</button></div>
      </form>
    </Modal>
    <Modal open={mode === "delegate"} onClose={() => setMode(null)} title="Delegate approval">
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); go({ delegateTo: to }, "Delegated"); }}>
        <select className="input" value={to} onChange={(e) => setTo(e.target.value)} required><option value="">Choose a person</option>{members?.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
        <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setMode(null)}>Cancel</button><button className="btn-primary" disabled={busy || !to}>Delegate</button></div>
      </form>
    </Modal>
  </>);
}
