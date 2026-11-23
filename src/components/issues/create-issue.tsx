"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/client";

type Meta = { issueTypes: { id: string; name: string; level: number }[]; members: { id: string; name: string }[]; projects: { id: string; key: string; name: string }[]; sprints: { id: string; name: string }[]; epics: { id: string; key: string; summary: string }[] };

export function CreateIssueModal({ open, onClose, projectId, defaults, onCreated }: { open: boolean; onClose: () => void; projectId?: string; defaults?: Record<string, unknown>; onCreated?: () => void }) {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [f, setF] = useState<Record<string, unknown>>({ priority: "Medium" });
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const toast = useToast(); const router = useRouter();
  const pid = (f.projectId as string) || projectId || "";
  useEffect(() => {
    if (!open) return;
    apiFetch<Meta>(`/api/meta${pid ? `?projectId=${pid}` : ""}`).then((m) => {
      setMeta(m);
      setF((x) => ({ priority: "Medium", projectId: projectId ?? x.projectId ?? m.projects[0]?.id, typeId: x.typeId ?? m.issueTypes.find((t) => t.name === "Task")?.id, ...defaults, ...x }));
    }).catch(toast.err);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pid]);
  const set = (k: string, v: unknown) => { setF((x) => ({ ...x, [k]: v })); setDirty(true); };
  const typeName = meta?.issueTypes.find((t) => t.id === f.typeId)?.name;
  const submit = async () => {
    setBusy(true);
    try {
      const payload = {
        summary: f.summary, description: f.description || undefined, typeId: f.typeId, priority: f.priority,
        assigneeId: f.assigneeId || null, parentId: f.parentId || null, sprintId: f.sprintId || null,
        storyPoints: f.storyPoints ? Number(f.storyPoints) : null, dueDate: f.dueDate || null,
        labels: f.labels ? String(f.labels).split(",").map((s) => s.trim()).filter(Boolean) : [],
        severity: typeName === "Bug" ? (f.severity || null) : null, isShowStopper: !!f.isShowStopper,
        originalEstimateMin: f.estimateH ? Math.round(Number(f.estimateH) * 60) : null,
      };
      const issue = await apiFetch<{ key: string }>(`/api/projects/${pid}/issues`, { method: "POST", json: payload });
      toast.ok(`${issue.key} created`); setDirty(false); setF({ priority: "Medium", projectId: pid, typeId: f.typeId }); onClose();
      onCreated?.(); router.refresh();
    } catch (e) { toast.err(e); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={() => { setDirty(false); onClose(); }} title="Create issue" wide dirty={dirty}>
      {!meta ? <p className="muted text-sm">Loading…</p> : (
        <form className="grid grid-cols-2 gap-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <div><label className="label" htmlFor="ci-p">Project</label>
            <select id="ci-p" className="input" value={pid} onChange={(e) => set("projectId", e.target.value)} disabled={!!projectId} required>
              {meta.projects.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.key})</option>)}
            </select></div>
          <div><label className="label" htmlFor="ci-t">Type</label>
            <select id="ci-t" className="input" value={(f.typeId as string) ?? ""} onChange={(e) => set("typeId", e.target.value)} required>
              {meta.issueTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select></div>
          <div className="col-span-2"><label className="label" htmlFor="ci-s">Summary *</label><input id="ci-s" className="input" value={(f.summary as string) ?? ""} onChange={(e) => set("summary", e.target.value)} required maxLength={255} /></div>
          <div className="col-span-2"><label className="label" htmlFor="ci-d">Description</label><textarea id="ci-d" rows={4} className="input" value={(f.description as string) ?? ""} onChange={(e) => set("description", e.target.value)} /></div>
          <div><label className="label" htmlFor="ci-a">Assignee</label>
            <select id="ci-a" className="input" value={(f.assigneeId as string) ?? ""} onChange={(e) => set("assigneeId", e.target.value)}><option value="">Unassigned</option>{meta.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
          <div><label className="label" htmlFor="ci-pr">Priority</label>
            <select id="ci-pr" className="input" value={f.priority as string} onChange={(e) => set("priority", e.target.value)}>{["Blocker", "Critical", "High", "Medium", "Low"].map((p) => <option key={p}>{p}</option>)}</select></div>
          <div><label className="label" htmlFor="ci-e">Parent (epic)</label>
            <select id="ci-e" className="input" value={(f.parentId as string) ?? ""} onChange={(e) => set("parentId", e.target.value)}><option value="">None</option>{meta.epics.map((m) => <option key={m.id} value={m.id}>{m.key} {m.summary}</option>)}</select></div>
          <div><label className="label" htmlFor="ci-sp">Sprint</label>
            <select id="ci-sp" className="input" value={(f.sprintId as string) ?? ""} onChange={(e) => set("sprintId", e.target.value)}><option value="">Backlog</option>{meta.sprints.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
          <div><label className="label" htmlFor="ci-pts">Story points</label><input id="ci-pts" type="number" min={0} step={0.5} className="input" value={(f.storyPoints as string) ?? ""} onChange={(e) => set("storyPoints", e.target.value)} /></div>
          <div><label className="label" htmlFor="ci-est">Estimate (hours)</label><input id="ci-est" type="number" min={0} step={0.5} className="input" value={(f.estimateH as string) ?? ""} onChange={(e) => set("estimateH", e.target.value)} /></div>
          <div><label className="label" htmlFor="ci-due">Due date</label><input id="ci-due" type="date" className="input" value={(f.dueDate as string) ?? ""} onChange={(e) => set("dueDate", e.target.value)} /></div>
          <div><label className="label" htmlFor="ci-l">Labels (comma separated)</label><input id="ci-l" className="input" value={(f.labels as string) ?? ""} onChange={(e) => set("labels", e.target.value)} /></div>
          {typeName === "Bug" && <div><label className="label" htmlFor="ci-sev">Severity</label><select id="ci-sev" className="input" value={(f.severity as string) ?? ""} onChange={(e) => set("severity", e.target.value)}><option value="">—</option>{["S1", "S2", "S3", "S4"].map((s) => <option key={s}>{s}</option>)}</select></div>}
          <label className="flex items-center gap-2 text-sm col-span-2"><input type="checkbox" checked={!!f.isShowStopper} onChange={(e) => set("isShowStopper", e.target.checked)} />Show-stopper (blocks release / go-live)</label>
          <div className="col-span-2 flex justify-end gap-2 pt-2"><button type="button" className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy || !f.summary}>{busy ? "Creating…" : "Create"}</button></div>
        </form>
      )}
    </Modal>
  );
}
