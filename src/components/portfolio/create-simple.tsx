"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/client";
export function CreateSimple({ kind }: { kind: "portfolio" | "program" }) {
  const [open, setOpen] = useState(false); const [f, setF] = useState<Record<string, string>>({}); const [pfs, setPfs] = useState<{ id: string; name: string }[]>([]);
  const toast = useToast(); const router = useRouter();
  useEffect(() => { if (open && kind === "program") apiFetch<{ id: string; name: string }[]>("/api/portfolios").then(setPfs).catch(toast.err); }, [open, kind, toast]);
  return (<>
    <button className="btn-primary" onClick={() => setOpen(true)}><Plus className="h-4 w-4" />New {kind}</button>
    <Modal open={open} onClose={() => setOpen(false)} title={`New ${kind}`}>
      <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); try { await apiFetch(`/api/${kind}s`, { method: "POST", json: { ...f, portfolioId: f.portfolioId || null } }); toast.ok(`${kind} created`); setOpen(false); setF({}); router.refresh(); } catch (x) { toast.err(x); } }}>
        <div><label className="label">Name *</label><input className="input" required minLength={2} value={f.name ?? ""} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div><label className="label">Description</label><textarea className="input" rows={3} value={f.description ?? ""} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
        {kind === "program" && <div><label className="label">Portfolio</label><select className="input" value={f.portfolioId ?? ""} onChange={(e) => setF({ ...f, portfolioId: e.target.value })}><option value="">None</option>{pfs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>}
        <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button><button className="btn-primary">Create</button></div>
      </form>
    </Modal>
  </>);
}
