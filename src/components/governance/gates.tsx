"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, XCircle, Clock } from "lucide-react";
import { apiFetch } from "@/lib/client";
import { useToast } from "@/components/ui/toast";
import { Chip } from "@/components/ui/bits";
import { ApprovalActions } from "./approval-actions";
import { dateTime, date } from "@/lib/format";

/* eslint-disable @typescript-eslint/no-explicit-any */
const COLOR: Record<string, string> = { APPROVED: "#34c759", IN_REVIEW: "#0a84ff", REJECTED: "#ff3b30", NOT_STARTED: "#8e8e93" };
export function GateList({ gates, canEdit, myRole, isSuper, canApprove, members, tz }: { gates: any[]; canEdit: boolean; myRole: string; isSuper: boolean; canApprove: boolean; members: { id: string; name: string }[]; tz: string }) {
  const toast = useToast(); const router = useRouter(); const [busy, setBusy] = useState(false);
  const call = async (id: string, json: Record<string, unknown>, msg: string) => { setBusy(true); try { await apiFetch(`/api/gates/${id}`, { method: "PATCH", json }); toast.ok(msg); router.refresh(); } catch (e) { toast.err(e); } finally { setBusy(false); } };
  return (
    <ol className="relative border-s-2 border-line ms-3 space-y-4">
      {gates.map((g) => {
        const state = g.checklistState as Record<string, boolean>; const done = g.stage.checklist.filter((c: string) => state[c]).length;
        const Icon = g.status === "APPROVED" ? CheckCircle2 : g.status === "REJECTED" ? XCircle : g.status === "IN_REVIEW" ? Clock : Circle;
        const current = g.approvals.find((a: any) => a.decision === "PENDING" && g.approvals.filter((x: any) => x.step < a.step).every((x: any) => x.decision === "APPROVED"));
        const expired = g.expiresAt && new Date(g.expiresAt) < new Date();
        return (
          <li key={g.id} className="ms-6">
            <span className="absolute -start-[13px] bg-[var(--bg)] rounded-full"><Icon className="h-6 w-6" style={{ color: COLOR[g.status] }} /></span>
            <div className="card p-4">
              <div className="flex items-center gap-2 flex-wrap mb-2"><h3 className="font-semibold">{g.stage.name}</h3><Chip color={COLOR[g.status]}>{g.status.replace("_", " ")}</Chip>{expired && <Chip color="#ff9f0a">Expired {date(g.expiresAt, tz)}</Chip>}
                <span className="text-xs muted ms-auto">{done}/{g.stage.checklist.length} checklist items{g.decidedAt && ` · decided ${dateTime(g.decidedAt, tz)}`}</span></div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1">{g.stage.checklist.map((c: string) => <label key={c} className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={!canEdit || busy || g.status === "APPROVED" || g.status === "IN_REVIEW"} checked={!!state[c]} onChange={(e) => call(g.id, { checklist: { ...state, [c]: e.target.checked } }, "Checklist updated")} />{c}</label>)}
                  {canEdit && (g.status === "NOT_STARTED" || g.status === "REJECTED") && <button className="btn-primary btn-sm mt-2" disabled={busy} onClick={() => call(g.id, { submit: true }, "Submitted for approval")}>{g.status === "REJECTED" ? "Resubmit" : "Submit for approval"}</button>}</div>
                <div>{g.approvals.length === 0 ? <p className="text-xs muted">Approvers: {g.stage.approverRoles.map((r: string) => r.replace(/_/g, " ").toLowerCase()).join(" → ")} (sequential)</p> :
                  <ul className="space-y-2">{g.approvals.map((a: any) => <li key={a.id} className="text-sm flex items-start gap-2"><span className="chip bg-black/5 text-ink-2 shrink-0">{a.step}</span><div className="flex-1"><div><span className="capitalize">{a.approverRole.replace(/_/g, " ").toLowerCase()}</span> · <Chip color={COLOR[a.decision === "PENDING" ? "NOT_STARTED" : a.decision]}>{a.decision}</Chip>{a.approver && <span className="muted text-xs"> {a.approver.name}{a.decidedAt && `, ${dateTime(a.decidedAt, tz)}`}</span>}{a.delegatedFromId && <span className="text-xs muted"> (delegated)</span>}</div>{a.comment && <div className="text-xs muted mt-0.5">“{a.comment}”</div>}
                    {current?.id === a.id && canApprove && (isSuper || a.approverRole === myRole) && <div className="mt-2"><ApprovalActions approvalId={a.id} members={members} /></div>}</div></li>)}</ul>}
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
