"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Copy, Trash2, ArrowRightLeft, Paperclip, Link2, Clock, Plus, RotateCcw, Check, X } from "lucide-react";
import { apiFetch } from "@/lib/client";
import { useToast } from "@/components/ui/toast";
import { Modal, Confirm } from "@/components/ui/modal";
import { Avatar, Chip, Priority, Empty } from "@/components/ui/bits";
import { CreateIssueModal } from "./create-issue";
import { dateTime, date, minutes, ago } from "@/lib/format";

/* eslint-disable @typescript-eslint/no-explicit-any */
export function IssueView({ data }: { data: any }) {
  const { issue, transitions, historyUsers, members, types, sprints, versions, projects, me, perms, tz } = data;
  const toast = useToast(); const router = useRouter();
  const [tab, setTab] = useState<"comments" | "history" | "worklog">("comments");
  const [comment, setComment] = useState(""); const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<null | "link" | "log" | "move" | "delete" | "sub">(null);
  const [editing, setEditing] = useState<string | null>(null); const [draft, setDraft] = useState<string>("");
  const watching = issue.watchers.some((w: any) => w.userId === me);
  const run = async (fn: () => Promise<unknown>, ok?: string) => { setBusy(true); try { const r = await fn(); if (ok) toast.ok(ok); router.refresh(); return r; } catch (e) { toast.err(e); } finally { setBusy(false); } };
  const patch = (json: Record<string, unknown>) => run(() => apiFetch(`/api/issues/${issue.key}`, { method: "PATCH", json }), "Saved");
  const deleted = !!issue.deletedAt;
  const ro = !perms.edit || deleted;

  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => <div className="grid grid-cols-[110px_1fr] items-center gap-2 py-1.5"><span className="text-xs muted">{label}</span><div className="text-sm min-w-0">{children}</div></div>;
  const Sel = ({ value, onChange, options, empty }: { value: string | null; onChange: (v: string | null) => void; options: { v: string; l: string }[]; empty?: string }) =>
    <select disabled={ro} className="input !h-8" value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}>{empty !== undefined && <option value="">{empty}</option>}{options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</select>;

  return (
    <div>
      <nav className="text-xs muted mb-2 flex gap-1.5"><Link href="/projects" className="hover:text-ink-1">Projects</Link>/<Link href={`/projects/${issue.project.key}`} className="hover:text-ink-1">{issue.project.name}</Link>/{issue.parent && <><Link href={`/issues/${issue.parent.key}`} className="hover:text-ink-1">{issue.parent.key}</Link>/</>}<span>{issue.key}</span></nav>
      {deleted && <div className="card p-3 mb-4 flex items-center gap-3 border-[#ff9f0a]/50 bg-[#ff9f0a]/10 text-sm">This issue was deleted. Its key is kept and will never be reused.{perms.del && <button className="btn-secondary btn-sm ms-auto" onClick={() => run(() => apiFetch(`/api/issues/${issue.key}/restore`, { method: "POST" }), "Restored")}><RotateCcw className="h-3.5 w-3.5" />Restore</button>}</div>}
      <div className="grid lg:grid-cols-[1fr_340px] gap-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-2"><Chip color={issue.type.color}>{issue.type.name}</Chip><span className="text-sm muted font-medium">{issue.key}</span>{issue.isShowStopper && <Chip color="#ff3b30" solid>SHOW-STOPPER</Chip>}</div>
          {editing === "summary" ? (
            <form onSubmit={(e) => { e.preventDefault(); patch({ summary: draft }); setEditing(null); }} className="flex gap-2 mb-4"><input autoFocus className="input !h-11 text-xl font-semibold" value={draft} onChange={(e) => setDraft(e.target.value)} /><button className="btn-primary !px-3"><Check className="h-4 w-4" /></button><button type="button" className="btn-secondary !px-3" onClick={() => setEditing(null)}><X className="h-4 w-4" /></button></form>
          ) : <h1 className={`h1 mb-4 ${ro ? "" : "cursor-text hover:bg-black/5 rounded-lg -mx-2 px-2"}`} onClick={() => { if (!ro) { setEditing("summary"); setDraft(issue.summary); } }}>{issue.summary}</h1>}
          <div className="flex flex-wrap gap-2 mb-6">
            {perms.transition && !deleted && transitions.map((t: any) => <button key={t.id} disabled={busy} className="btn-secondary btn-sm" onClick={() => run(() => apiFetch(`/api/issues/${issue.key}/transitions`, { method: "POST", json: { transitionId: t.id } }), `Moved to ${t.toStatus.name}`)}>{t.name} → {t.toStatus.name}</button>)}
            <span className="flex-1" />
            {perms.comment && <button className="btn-secondary btn-sm" onClick={() => setModal("log")}><Clock className="h-3.5 w-3.5" />Log work</button>}
            {!ro && <button className="btn-secondary btn-sm" onClick={() => setModal("link")}><Link2 className="h-3.5 w-3.5" />Link</button>}
            {!ro && <label className="btn-secondary btn-sm cursor-pointer"><Paperclip className="h-3.5 w-3.5" />Attach<input type="file" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const fd = new FormData(); fd.append("file", f); await run(() => apiFetch(`/api/issues/${issue.key}/attachments`, { method: "POST", body: fd }), "Attached"); e.target.value = ""; }} /></label>}
            <button className="btn-secondary btn-sm" onClick={() => run(() => apiFetch(`/api/issues/${issue.key}/watch`, { method: "POST" }))}>{watching ? <><EyeOff className="h-3.5 w-3.5" />Unwatch</> : <><Eye className="h-3.5 w-3.5" />Watch</>}</button>
            {!ro && <button className="btn-secondary btn-sm" onClick={async () => { const c: any = await run(() => apiFetch(`/api/issues/${issue.key}/clone`, { method: "POST" }), "Cloned"); if (c?.key) router.push(`/issues/${c.key}`); }}><Copy className="h-3.5 w-3.5" />Clone</button>}
            {!ro && <button className="btn-secondary btn-sm" onClick={() => setModal("move")}><ArrowRightLeft className="h-3.5 w-3.5" />Move</button>}
            {perms.del && !deleted && <button className="btn-secondary btn-sm text-[#ff3b30]" onClick={() => setModal("delete")}><Trash2 className="h-3.5 w-3.5" />Delete</button>}
          </div>

          <section className="mb-6"><h2 className="text-sm font-semibold mb-2">Description</h2>
            {editing === "description" ? <div><textarea autoFocus rows={8} className="input" value={draft} onChange={(e) => setDraft(e.target.value)} /><div className="flex gap-2 mt-2"><button className="btn-primary btn-sm" onClick={() => { patch({ description: draft }); setEditing(null); }}>Save</button><button className="btn-secondary btn-sm" onClick={() => setEditing(null)}>Cancel</button></div></div>
              : <div className={`text-sm whitespace-pre-wrap rounded-lg p-3 -mx-3 ${ro ? "" : "cursor-text hover:bg-black/5"}`} onClick={() => { if (!ro) { setEditing("description"); setDraft(issue.description ?? ""); } }}>{issue.description || <span className="muted">Add a description…</span>}</div>}
          </section>

          <section className="mb-6"><div className="flex items-center justify-between mb-2"><h2 className="text-sm font-semibold">Child issues ({issue.children.length})</h2>{!ro && <button className="btn-ghost btn-sm" onClick={() => setModal("sub")}><Plus className="h-3.5 w-3.5" />Add child</button>}</div>
            {issue.children.length > 0 && <div className="card">{issue.children.map((c: any) => <div key={c.id} className="flex items-center gap-2 px-3 py-2 border-b border-line last:border-0 text-sm"><Chip color={c.type.color}>{c.type.name}</Chip><Link href={`/issues/${c.key}`} className="text-accent">{c.key}</Link><span className="flex-1 truncate">{c.summary}</span><span className="text-xs muted">{c.assignee?.name}</span><Chip color={c.status.color}>{c.status.name}</Chip></div>)}</div>}
          </section>

          {(issue.linksOut.length > 0 || issue.linksIn.length > 0) && <section className="mb-6"><h2 className="text-sm font-semibold mb-2">Linked issues</h2><div className="card">
            {[...issue.linksOut.map((l: any) => ({ id: l.id, label: { BLOCKS: "blocks", RELATES: "relates to", DUPLICATES: "duplicates", DEPENDS_ON: "depends on" }[l.type as string], other: l.target })),
              ...issue.linksIn.map((l: any) => ({ id: l.id, label: { BLOCKS: "is blocked by", RELATES: "relates to", DUPLICATES: "is duplicated by", DEPENDS_ON: "is required by" }[l.type as string], other: l.source }))].map((l) =>
              <div key={l.id} className="flex items-center gap-2 px-3 py-2 border-b border-line last:border-0 text-sm"><span className="muted text-xs w-28">{l.label}</span><Link href={`/issues/${l.other.key}`} className="text-accent">{l.other.key}</Link><span className="flex-1 truncate">{l.other.summary}</span><Chip color={l.other.status.color}>{l.other.status.name}</Chip>{!ro && <button aria-label="Remove link" onClick={() => run(() => apiFetch(`/api/issues/${issue.key}/links?linkId=${l.id}`, { method: "DELETE" }), "Link removed")}><X className="h-3.5 w-3.5 muted" /></button>}</div>)}
          </div></section>}

          {issue.attachments.length > 0 && <section className="mb-6"><h2 className="text-sm font-semibold mb-2">Attachments</h2><div className="flex flex-wrap gap-2">{issue.attachments.map((a: any) => <a key={a.id} className="card px-3 py-2 text-sm hover:border-accent" href={`/api/issues/${issue.key}/attachments?attachmentId=${a.id}`}><Paperclip className="inline h-3.5 w-3.5 me-1" />{a.fileName} <span className="muted text-xs">{Math.ceil(a.sizeBytes / 1024)} KB</span></a>)}</div></section>}

          <div className="inline-flex gap-1 p-1 rounded-full bg-black/[0.05] mb-3">{(["comments", "history", "worklog"] as const).map((t) => <button key={t} className={`tab ${tab === t ? "tab-active" : ""}`} onClick={() => setTab(t)}>{t === "comments" ? `Comments (${issue.comments.length})` : t === "history" ? "History" : `Work log (${issue.workLogs.length})`}</button>)}</div>
          {tab === "comments" && <div className="space-y-3">
            {issue.comments.map((c: any) => <div key={c.id} className="flex gap-3"><Avatar name={c.author.name} size={28} /><div className="flex-1"><div className="text-xs"><span className="font-medium">{c.author.name}</span> <span className="muted">{dateTime(c.createdAt, tz)}</span></div><div className="text-sm whitespace-pre-wrap mt-0.5">{c.body}</div></div></div>)}
            {perms.comment && !deleted && <form className="flex gap-3" onSubmit={async (e) => { e.preventDefault(); if (!comment.trim()) return; await run(() => apiFetch(`/api/issues/${issue.key}/comments`, { method: "POST", json: { body: comment } }), "Comment added"); setComment(""); }}>
              <textarea className="input" rows={2} placeholder="Add a comment… use @firstname.lastname to mention" value={comment} onChange={(e) => setComment(e.target.value)} /><button className="btn-primary self-end" disabled={busy || !comment.trim()}>Comment</button></form>}
          </div>}
          {tab === "history" && <ul className="space-y-2">{issue.history.map((h: any) => <li key={h.id} className="text-xs flex gap-2"><span className="muted w-32 shrink-0">{dateTime(h.createdAt, tz)}</span><span><span className="font-medium">{historyUsers[h.userId] ?? "System"}</span> {h.field === "created" ? "created the issue" : <>changed <b>{h.field}</b>{h.fromValue != null && <> from <span className="line-through muted">{h.fromValue}</span></>}{h.toValue != null && <> to <span>{h.toValue}</span></>}</>}</span></li>)}</ul>}
          {tab === "worklog" && (issue.workLogs.length === 0 ? <Empty title="No work logged" /> : <table className="table card"><thead><tr><th>Date</th><th>Who</th><th>Time</th><th>Note</th></tr></thead><tbody>{issue.workLogs.map((w: any) => <tr key={w.id}><td>{date(w.workDate, tz)}</td><td>{w.user.name}</td><td>{minutes(w.minutes)}</td><td className="muted">{w.note}</td></tr>)}</tbody></table>)}
        </div>

        <aside className="space-y-4">
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3"><Chip color={issue.status.color}>{issue.status.name}</Chip>{issue.resolution && <span className="text-xs muted">Resolution: {issue.resolution}</span>}</div>
            <Field label="Assignee"><div className="flex gap-2 items-center"><Sel value={issue.assigneeId} empty="Unassigned" options={members.map((m: any) => ({ v: m.id, l: m.name }))} onChange={(v) => patch({ assigneeId: v })} />{!ro && issue.assigneeId !== me && <button className="text-xs text-accent whitespace-nowrap" onClick={() => patch({ assigneeId: me })}>Me</button>}</div></Field>
            <Field label="Reporter">{issue.reporter.name}</Field>
            <Field label="Priority"><Sel value={issue.priority} options={["Blocker", "Critical", "High", "Medium", "Low"].map((p) => ({ v: p, l: p }))} onChange={(v) => patch({ priority: v })} /></Field>
            <Field label="Type"><Sel value={issue.typeId} options={types.map((t: any) => ({ v: t.id, l: t.name }))} onChange={(v) => patch({ typeId: v })} /></Field>
            {issue.type.name === "Bug" && <Field label="Severity"><Sel value={issue.severity} empty="—" options={["S1", "S2", "S3", "S4"].map((p) => ({ v: p, l: p }))} onChange={(v) => patch({ severity: v })} /></Field>}
            <Field label="Show-stopper"><input type="checkbox" disabled={ro} checked={issue.isShowStopper} onChange={(e) => patch({ isShowStopper: e.target.checked })} /></Field>
            <Field label="Sprint"><Sel value={issue.sprintId} empty="Backlog" options={[...sprints.map((s: any) => ({ v: s.id, l: s.name })), ...(issue.sprint && !sprints.find((s: any) => s.id === issue.sprintId) ? [{ v: issue.sprintId, l: issue.sprint.name }] : [])]} onChange={(v) => patch({ sprintId: v })} /></Field>
            <Field label="Fix version"><Sel value={issue.fixVersionId} empty="None" options={versions.map((s: any) => ({ v: s.id, l: s.name }))} onChange={(v) => patch({ fixVersionId: v })} /></Field>
            <Field label="Story points"><input disabled={ro} type="number" min={0} step={0.5} className="input !h-8" defaultValue={issue.storyPoints ?? ""} onBlur={(e) => { const v = e.target.value === "" ? null : Number(e.target.value); if (String(v) !== String(issue.storyPoints)) patch({ storyPoints: v }); }} /></Field>
            <Field label="Due date"><input disabled={ro} type="date" className="input !h-8" defaultValue={issue.dueDate?.slice(0, 10) ?? ""} onChange={(e) => patch({ dueDate: e.target.value || null })} /></Field>
            <Field label="Start date"><input disabled={ro} type="date" className="input !h-8" defaultValue={issue.startDate?.slice(0, 10) ?? ""} onChange={(e) => patch({ startDate: e.target.value || null })} /></Field>
            <Field label="Labels"><input disabled={ro} className="input !h-8" defaultValue={issue.labels.join(", ")} onBlur={(e) => { const v = e.target.value.split(",").map((s) => s.trim()).filter(Boolean); if (v.join() !== issue.labels.join()) patch({ labels: v }); }} /></Field>
            <Field label="Components"><input disabled={ro} className="input !h-8" defaultValue={issue.components.join(", ")} onBlur={(e) => { const v = e.target.value.split(",").map((s) => s.trim()).filter(Boolean); if (v.join() !== issue.components.join()) patch({ components: v }); }} /></Field>
          </div>
          <div className="card p-4 text-sm space-y-2">
            <div className="flex justify-between"><span className="muted text-xs">Original estimate</span>{minutes(issue.originalEstimateMin)}</div>
            <div className="flex justify-between"><span className="muted text-xs">Remaining</span>{minutes(issue.remainingEstimateMin)}</div>
            <div className="flex justify-between"><span className="muted text-xs">Logged</span>{minutes(issue.timeSpentMin)}</div>
            {issue.originalEstimateMin > 0 && <div className="h-1.5 rounded-full bg-black/5 overflow-hidden"><div className="h-full bg-accent" style={{ width: `${Math.min(100, (issue.timeSpentMin / issue.originalEstimateMin) * 100)}%` }} /></div>}
          </div>
          <div className="card p-4 text-xs space-y-1.5 muted">
            <div>Created {dateTime(issue.createdAt, tz)} ({ago(issue.createdAt)})</div><div>Updated {dateTime(issue.updatedAt, tz)}</div>
            {issue.resolvedAt && <div>Resolved {dateTime(issue.resolvedAt, tz)}</div>}
            <div>Watchers: {issue.watchers.map((w: any) => w.user.name).join(", ") || "none"}</div>
            {perms.transition && issue.assigneeId !== me && <div className="pt-2 flex gap-2"><button className="btn-secondary btn-sm" onClick={() => run(() => apiFetch(`/api/issues/${issue.key}/review`, { method: "POST", json: { decision: "APPROVED" } }), "Review approved")}>Approve review</button><button className="btn-secondary btn-sm" onClick={() => run(() => apiFetch(`/api/issues/${issue.key}/review`, { method: "POST", json: { decision: "CHANGES_REQUESTED" } }), "Changes requested")}>Request changes</button></div>}
          </div>
        </aside>
      </div>

      <LinkModal open={modal === "link"} onClose={() => setModal(null)} issueKey={issue.key} onDone={() => router.refresh()} />
      <LogModal open={modal === "log"} onClose={() => setModal(null)} issueKey={issue.key} onDone={() => router.refresh()} />
      <Modal open={modal === "move"} onClose={() => setModal(null)} title={`Move ${issue.key}`}>
        <form onSubmit={async (e) => { e.preventDefault(); const k = new FormData(e.currentTarget).get("p") as string; const r: any = await run(() => apiFetch(`/api/issues/${issue.key}/move`, { method: "POST", json: { projectKey: k } }), "Moved"); if (r?.key) router.push(`/issues/${r.key}`); setModal(null); }}>
          <p className="text-sm muted mb-3">The issue gets a new key in the target project. The old key stays in its history and is never reused.</p>
          <select name="p" className="input mb-4">{projects.filter((p: any) => p.key !== issue.project.key).map((p: any) => <option key={p.key} value={p.key}>{p.name} ({p.key})</option>)}</select>
          <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setModal(null)}>Cancel</button><button className="btn-primary">Move</button></div>
        </form>
      </Modal>
      <Confirm open={modal === "delete"} danger title={`Delete ${issue.key}?`} body="The issue is soft-deleted: it disappears from boards and searches but can be restored by authorised users. Its key is never reused." onCancel={() => setModal(null)} busy={busy}
        onConfirm={async () => { await run(() => apiFetch(`/api/issues/${issue.key}`, { method: "DELETE" }), "Deleted"); setModal(null); }} />
      <CreateIssueModal open={modal === "sub"} onClose={() => setModal(null)} projectId={issue.projectId} defaults={{ parentId: issue.id, typeId: types.find((t: any) => t.name === (issue.type.level >= 3 ? "Story" : "Subtask"))?.id }} />
    </div>
  );
}

function LinkModal({ open, onClose, issueKey, onDone }: { open: boolean; onClose: () => void; issueKey: string; onDone: () => void }) {
  const [type, setType] = useState("BLOCKS|outward"); const [target, setTarget] = useState(""); const toast = useToast();
  return <Modal open={open} onClose={onClose} title="Link issue"><form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); const [t, d] = type.split("|"); try { await apiFetch(`/api/issues/${issueKey}/links`, { method: "POST", json: { targetKey: target.trim(), type: t, direction: d } }); toast.ok("Linked"); onClose(); onDone(); } catch (x) { toast.err(x); } }}>
    <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
      <option value="BLOCKS|outward">blocks</option><option value="BLOCKS|inward">is blocked by</option><option value="RELATES|outward">relates to</option>
      <option value="DUPLICATES|outward">duplicates</option><option value="DUPLICATES|inward">is duplicated by</option><option value="DEPENDS_ON|outward">depends on</option><option value="DEPENDS_ON|inward">is required by</option>
    </select>
    <input className="input" placeholder="Issue key, e.g. MBM-12" value={target} onChange={(e) => setTarget(e.target.value)} required />
    <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary">Link</button></div>
  </form></Modal>;
}

function LogModal({ open, onClose, issueKey, onDone }: { open: boolean; onClose: () => void; issueKey: string; onDone: () => void }) {
  const [h, setH] = useState("1"); const [d, setD] = useState(new Date().toISOString().slice(0, 10)); const [note, setNote] = useState(""); const toast = useToast();
  return <Modal open={open} onClose={onClose} title="Log work"><form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); try { await apiFetch(`/api/issues/${issueKey}/worklogs`, { method: "POST", json: { minutes: Math.round(Number(h) * 60), workDate: d, note: note || undefined } }); toast.ok("Work logged"); onClose(); onDone(); } catch (x) { toast.err(x); } }}>
    <div className="grid grid-cols-2 gap-3"><div><label className="label">Hours</label><input className="input" type="number" min={0.25} step={0.25} value={h} onChange={(e) => setH(e.target.value)} /></div><div><label className="label">Date</label><input className="input" type="date" value={d} onChange={(e) => setD(e.target.value)} /></div></div>
    <div><label className="label">Note</label><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></div>
    <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary">Log</button></div>
  </form></Modal>;
}
