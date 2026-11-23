"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, CalendarPlus, UserPlus } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/client";

type Opt = { id: string; name: string };

export function NewResource({ departments, users }: { departments: Opt[]; users: Opt[] }) {
  const [open, setOpen] = useState(false); const [f, setF] = useState<Record<string, string>>({ employmentType: "Employee" });
  const toast = useToast(); const router = useRouter();
  const set = (k: string) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  return (<>
    <button className="btn-primary" onClick={() => setOpen(true)}><UserPlus className="h-4 w-4" />New resource</button>
    <Modal open={open} onClose={() => setOpen(false)} title="New resource" dirty={Object.keys(f).length > 1}>
      <form className="grid grid-cols-2 gap-3" onSubmit={async (e) => {
        e.preventDefault();
        try {
          await apiFetch("/api/resources", { method: "POST", json: { name: f.name, userId: f.userId || null, departmentId: f.departmentId || null, jobTitle: f.jobTitle || null, grade: f.grade || null, employmentType: f.employmentType, skills: (f.skills ?? "").split(",").map((s) => s.trim()).filter(Boolean), ...(f.hourlyRate ? { hourlyRate: f.hourlyRate, dailyRate: String(Number(f.hourlyRate) * 8) } : {}), ...(f.hoursPerWeek ? { hoursPerWeek: f.hoursPerWeek } : {}) } });
          toast.ok("Resource created"); setOpen(false); setF({ employmentType: "Employee" }); router.refresh();
        } catch (x) { toast.err(x); }
      }}>
        <div className="col-span-2"><label className="label">Name *</label><input className="input" required minLength={2} value={f.name ?? ""} onChange={set("name")} /></div>
        <div><label className="label">Linked user</label><select className="input" value={f.userId ?? ""} onChange={(e) => { const u = users.find((x) => x.id === e.target.value); setF({ ...f, userId: e.target.value, name: f.name || u?.name || "" }); }}><option value="">None (external)</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
        <div><label className="label">Department</label><select className="input" value={f.departmentId ?? ""} onChange={set("departmentId")}><option value="">—</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
        <div><label className="label">Job title</label><input className="input" value={f.jobTitle ?? ""} onChange={set("jobTitle")} /></div>
        <div><label className="label">Grade</label><input className="input" value={f.grade ?? ""} onChange={set("grade")} /></div>
        <div><label className="label">Employment type</label><select className="input" value={f.employmentType} onChange={set("employmentType")}>{["Employee", "Contractor", "Vendor"].map((t) => <option key={t}>{t}</option>)}</select></div>
        <div><label className="label">Hours per week</label><input className="input" inputMode="decimal" placeholder="40" value={f.hoursPerWeek ?? ""} onChange={set("hoursPerWeek")} /></div>
        <div className="col-span-2"><label className="label">Skills (comma separated)</label><input className="input" value={f.skills ?? ""} onChange={set("skills")} /></div>
        <div className="col-span-2"><label className="label">Hourly rate (needs finance edit rights)</label><input className="input" inputMode="decimal" value={f.hourlyRate ?? ""} onChange={set("hourlyRate")} /></div>
        <div className="col-span-2 flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button><button className="btn-primary">Create</button></div>
      </form>
    </Modal>
  </>);
}

const today = () => new Date().toISOString().slice(0, 10);

export function ResourceRowActions({ id, name, projects, allocations, canManage, canLeave }: { id: string; name: string; projects: { id: string; key: string; name: string }[]; allocations: { id: string; projectKey: string; percent: number; start: string; end: string; role: string | null }[]; canManage: boolean; canLeave: boolean }) {
  const [mode, setMode] = useState<null | "alloc" | "leave">(null);
  const [f, setF] = useState<Record<string, string>>({});
  const toast = useToast(); const router = useRouter();
  const set = (k: string) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (mode === "alloc") {
        const r = await apiFetch<{ utilisation: number; overallocated: boolean }>(`/api/resources/${id}`, { method: "POST", json: { allocation: { projectId: f.projectId, percent: Number(f.percent), startDate: f.startDate, endDate: f.endDate, role: f.role || undefined } } });
        if (r.overallocated) toast.err(new Error(`${name} is now over-allocated (${r.utilisation}% across that period).`)); else toast.ok(`Allocated · ${r.utilisation}% utilisation in that period`);
      } else {
        await apiFetch(`/api/resources/${id}`, { method: "POST", json: { leave: { startDate: f.startDate, endDate: f.endDate, reason: f.reason || undefined } } });
        toast.ok("Leave recorded");
      }
      setMode(null); setF({}); router.refresh();
    } catch (x) { toast.err(x); }
  };
  return (<>
    <div className="flex gap-1 justify-end">
      {canManage && <button className="btn-secondary btn-sm" onClick={() => { setF({ startDate: today(), endDate: today(), percent: "50" }); setMode("alloc"); }} aria-label={`Allocate ${name}`}><Plus className="h-3.5 w-3.5" />Allocate</button>}
      {canLeave && <button className="btn-secondary btn-sm !px-2" onClick={() => { setF({ startDate: today(), endDate: today() }); setMode("leave"); }} aria-label={`Add leave for ${name}`} title="Add leave"><CalendarPlus className="h-3.5 w-3.5" /></button>}
    </div>
    <Modal open={!!mode} onClose={() => setMode(null)} title={mode === "alloc" ? `Allocate ${name}` : `Leave for ${name}`}>
      {mode === "alloc" && allocations.length > 0 && (
        <div className="mb-4"><div className="label">Current allocations</div>
          <ul className="text-sm divide-y divide-line">{allocations.map((a) => <li key={a.id} className="flex items-center justify-between py-1.5"><span><b>{a.projectKey}</b> · {a.percent}% · {a.start} → {a.end}{a.role ? ` · ${a.role}` : ""}</span>
            {canManage && <button className="btn-ghost btn-sm !px-1.5" aria-label="Remove allocation" onClick={async () => { try { await apiFetch(`/api/resources/${id}?allocationId=${a.id}`, { method: "DELETE" }); toast.ok("Allocation removed"); router.refresh(); } catch (x) { toast.err(x); } }}><Trash2 className="h-3.5 w-3.5" /></button>}</li>)}</ul>
        </div>)}
      <form className="grid grid-cols-2 gap-3" onSubmit={submit}>
        {mode === "alloc" && <>
          <div className="col-span-2"><label className="label">Project *</label><select className="input" required value={f.projectId ?? ""} onChange={set("projectId")}><option value="">Choose…</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.key} · {p.name}</option>)}</select></div>
          <div><label className="label">Allocation % *</label><input className="input" type="number" min={1} max={200} required value={f.percent ?? ""} onChange={set("percent")} /></div>
          <div><label className="label">Role</label><input className="input" value={f.role ?? ""} onChange={set("role")} /></div>
        </>}
        <div><label className="label">Start *</label><input className="input" type="date" required value={f.startDate ?? ""} onChange={set("startDate")} /></div>
        <div><label className="label">End *</label><input className="input" type="date" required min={f.startDate} value={f.endDate ?? ""} onChange={set("endDate")} /></div>
        {mode === "leave" && <div className="col-span-2"><label className="label">Reason</label><input className="input" value={f.reason ?? ""} onChange={set("reason")} /></div>}
        <div className="col-span-2 flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setMode(null)}>Cancel</button><button className="btn-primary">Save</button></div>
      </form>
    </Modal>
  </>);
}
