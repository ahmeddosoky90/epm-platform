"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/client";

type Meta = { members: { id: string; name: string; role: string }[]; portfolios: { id: string; name: string }[]; programs: { id: string; name: string; portfolioId: string | null }[]; templates: { id: string; name: string }[]; me: string; currency: string };

export function NewProjectButton() {
  const [open, setOpen] = useState(false); const [meta, setMeta] = useState<Meta | null>(null);
  const [f, setF] = useState<Record<string, string>>({ methodology: "HYBRID", priority: "Medium" });
  const [busy, setBusy] = useState(false); const toast = useToast(); const router = useRouter();
  useEffect(() => { if (open && !meta) apiFetch<Meta>("/api/meta").then((m) => { setMeta(m); setF((x) => ({ ...x, managerId: m.me, currency: m.currency })); }).catch(toast.err); }, [open, meta, toast]);
  const set = (k: string) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const submit = async () => {
    setBusy(true);
    try {
      const body: Record<string, unknown> = { ...f };
      for (const k of Object.keys(body)) if (body[k] === "") delete body[k];
      for (const k of ["approvedBudget", "capexBudget", "opexBudget"]) if (body[k]) body[k] = String(body[k]);
      const p = await apiFetch<{ key: string }>("/api/projects", { method: "POST", json: body });
      toast.ok(`Project ${p.key} created`); setOpen(false); router.push(`/projects/${p.key}`);
    } catch (e) { toast.err(e); } finally { setBusy(false); }
  };
  return (<>
    <button className="btn-primary" onClick={() => setOpen(true)}><Plus className="h-4 w-4" />New project</button>
    <Modal open={open} onClose={() => setOpen(false)} title="New project" wide>
      {!meta ? <p className="muted text-sm">Loading…</p> :
      <form className="grid grid-cols-2 gap-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <div className="col-span-2 grid grid-cols-[1fr_140px] gap-4">
          <div><label className="label" htmlFor="np-name">Project name *</label><input id="np-name" className="input" required minLength={2} value={f.name ?? ""} onChange={set("name")} /></div>
          <div><label className="label" htmlFor="np-key">Key (auto if blank)</label><input id="np-key" className="input uppercase" maxLength={10} pattern="[A-Za-z][A-Za-z0-9]{1,9}" value={f.key ?? ""} onChange={set("key")} /></div>
        </div>
        <div className="col-span-2"><label className="label" htmlFor="np-d">Description</label><textarea id="np-d" className="input" rows={3} value={f.description ?? ""} onChange={set("description")} /></div>
        <div><label className="label">Template</label><select className="input" value={f.templateId ?? ""} onChange={set("templateId")}><option value="">Blank project</option>{meta.templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
        <div><label className="label">Methodology</label><select className="input" value={f.methodology} onChange={set("methodology")}><option value="AGILE">Agile</option><option value="WATERFALL">Waterfall</option><option value="HYBRID">Hybrid</option></select></div>
        <div><label className="label">Project manager</label><select className="input" value={f.managerId ?? ""} onChange={set("managerId")}>{meta.members.map((m) => <option key={m.id} value={m.id}>{m.name} — {m.role}</option>)}</select></div>
        <div><label className="label">Priority</label><select className="input" value={f.priority} onChange={set("priority")}>{["Critical", "High", "Medium", "Low"].map((p) => <option key={p}>{p}</option>)}</select></div>
        <div><label className="label">Portfolio</label><select className="input" value={f.portfolioId ?? ""} onChange={set("portfolioId")}><option value="">None</option>{meta.portfolios.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
        <div><label className="label">Program</label><select className="input" value={f.programId ?? ""} onChange={set("programId")}><option value="">None</option>{meta.programs.filter((p) => !f.portfolioId || p.portfolioId === f.portfolioId).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
        <div><label className="label">Business unit</label><input className="input" value={f.businessUnit ?? ""} onChange={set("businessUnit")} /></div>
        <div><label className="label">Sponsor</label><input className="input" value={f.sponsor ?? ""} onChange={set("sponsor")} /></div>
        <div><label className="label">Start date</label><input type="date" className="input" value={f.startDate ?? ""} onChange={set("startDate")} /></div>
        <div><label className="label">Planned end date</label><input type="date" className="input" value={f.plannedEndDate ?? ""} onChange={set("plannedEndDate")} /></div>
        <div><label className="label">Approved budget ({f.currency})</label><input inputMode="decimal" pattern="\d+(\.\d{1,2})?" className="input" value={f.approvedBudget ?? ""} onChange={set("approvedBudget")} /></div>
        <div className="grid grid-cols-2 gap-2"><div><label className="label">CAPEX</label><input inputMode="decimal" className="input" value={f.capexBudget ?? ""} onChange={set("capexBudget")} /></div><div><label className="label">OPEX</label><input inputMode="decimal" className="input" value={f.opexBudget ?? ""} onChange={set("opexBudget")} /></div></div>
        <p className="col-span-2 text-xs muted">Budgets need the Finance edit permission. Governance gates and default boards are created automatically.</p>
        <div className="col-span-2 flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button><button className="btn-primary" disabled={busy}>{busy ? "Creating…" : "Create project"}</button></div>
      </form>}
    </Modal>
  </>);
}
