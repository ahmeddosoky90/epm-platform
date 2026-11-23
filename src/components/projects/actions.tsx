"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, Confirm } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/client";

type P = { id: string; key: string; name: string; description: string | null; health: string; status: string; progress: number; lifecycleStageId: string | null; plannedEndDate: string; startDate: string; archived: boolean };

export function ProjectActions({ project, stages, canEdit, canArchive }: { project: P; stages: { id: string; name: string; requiresApproval: boolean }[]; canEdit: boolean; canArchive: boolean }) {
  const [mode, setMode] = useState<null | "edit" | "report" | "archive">(null);
  const [f, setF] = useState<Record<string, string | number>>({ ...project, description: project.description ?? "" } as unknown as Record<string, string | number>);
  const [r, setR] = useState({ health: project.health, summary: "", achievements: "", nextSteps: "" });
  const [busy, setBusy] = useState(false); const toast = useToast(); const router = useRouter();
  const run = async (fn: () => Promise<unknown>, msg: string) => { setBusy(true); try { await fn(); toast.ok(msg); setMode(null); router.refresh(); } catch (e) { toast.err(e); } finally { setBusy(false); } };
  if (!canEdit && !canArchive) return null;
  return (
    <div className="flex gap-2 justify-end -mt-2">
      {canEdit && <button className="btn-secondary btn-sm" onClick={() => setMode("report")}>Submit status report</button>}
      {canEdit && <button className="btn-secondary btn-sm" onClick={() => setMode("edit")}>Edit project</button>}
      {canArchive && <button className="btn-secondary btn-sm" onClick={() => setMode("archive")}>{project.archived ? "Restore" : "Archive"}</button>}
      <Modal open={mode === "edit"} onClose={() => setMode(null)} title={`Edit ${project.key}`} wide>
        <form className="grid grid-cols-2 gap-4" onSubmit={(e) => { e.preventDefault(); run(() => apiFetch(`/api/projects/${project.id}`, { method: "PATCH", json: { name: f.name, description: f.description, health: f.health, status: f.status, progress: Number(f.progress), lifecycleStageId: f.lifecycleStageId || undefined, startDate: f.startDate || null, plannedEndDate: f.plannedEndDate || null } }), "Project updated"); }}>
          <div className="col-span-2"><label className="label">Name</label><input className="input" value={f.name as string} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div className="col-span-2"><label className="label">Description</label><textarea className="input" rows={3} value={f.description as string} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
          <div><label className="label">Status</label><select className="input" value={f.status as string} onChange={(e) => setF({ ...f, status: e.target.value })}>{["PROPOSED", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"].map((s) => <option key={s}>{s}</option>)}</select></div>
          <div><label className="label">Health</label><select className="input" value={f.health as string} onChange={(e) => setF({ ...f, health: e.target.value })}><option value="GREEN">Green — on track</option><option value="AMBER">Amber — at risk</option><option value="RED">Red — off track</option></select></div>
          <div><label className="label">Lifecycle stage</label><select className="input" value={(f.lifecycleStageId as string) ?? ""} onChange={(e) => setF({ ...f, lifecycleStageId: e.target.value })}>{stages.map((s) => <option key={s.id} value={s.id}>{s.name}{s.requiresApproval ? " (approval)" : ""}</option>)}</select></div>
          <div><label className="label">Progress %</label><input type="number" min={0} max={100} className="input" value={f.progress} onChange={(e) => setF({ ...f, progress: e.target.value })} /></div>
          <div><label className="label">Start</label><input type="date" className="input" value={f.startDate as string} onChange={(e) => setF({ ...f, startDate: e.target.value })} /></div>
          <div><label className="label">Planned end</label><input type="date" className="input" value={f.plannedEndDate as string} onChange={(e) => setF({ ...f, plannedEndDate: e.target.value })} /></div>
          <div className="col-span-2 flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setMode(null)}>Cancel</button><button className="btn-primary" disabled={busy}>Save</button></div>
        </form>
      </Modal>
      <Modal open={mode === "report"} onClose={() => setMode(null)} title="Status report">
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); run(() => apiFetch(`/api/projects/${project.id}/status-reports`, { method: "POST", json: r }), "Status report submitted"); }}>
          <div><label className="label">Overall health</label><select className="input" value={r.health} onChange={(e) => setR({ ...r, health: e.target.value })}><option value="GREEN">Green</option><option value="AMBER">Amber</option><option value="RED">Red</option></select></div>
          <div><label className="label">Summary *</label><textarea required className="input" rows={3} value={r.summary} onChange={(e) => setR({ ...r, summary: e.target.value })} /></div>
          <div><label className="label">Achievements</label><textarea className="input" rows={2} value={r.achievements} onChange={(e) => setR({ ...r, achievements: e.target.value })} /></div>
          <div><label className="label">Next steps</label><textarea className="input" rows={2} value={r.nextSteps} onChange={(e) => setR({ ...r, nextSteps: e.target.value })} /></div>
          <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setMode(null)}>Cancel</button><button className="btn-primary" disabled={busy}>Submit</button></div>
        </form>
      </Modal>
      <Confirm open={mode === "archive"} title={project.archived ? "Restore project?" : "Archive project?"} body={project.archived ? "The project becomes editable again." : "Archived projects become read-only. Only administrators can restore them."} onCancel={() => setMode(null)} busy={busy}
        onConfirm={() => run(() => apiFetch(`/api/projects/${project.id}`, { method: "PATCH", json: { archived: !project.archived } }), project.archived ? "Project restored" : "Project archived")} />
    </div>
  );
}
