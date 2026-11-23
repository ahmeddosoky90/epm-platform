"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/client";

type R = { id: string; key: string; name: string; description: string | null; isSystem: boolean; permissions: string[]; _count: { members: number } };
export function RolesAdmin({ roles, catalogue, isSuper }: { roles: R[]; catalogue: Record<string, string>; isSuper: boolean }) {
  const [sel, setSel] = useState<string>(roles[0]?.id ?? ""); const [draft, setDraft] = useState<string[] | null>(null);
  const [creating, setCreating] = useState(false); const [nf, setNf] = useState({ name: "", description: "", copyFrom: "" });
  const toast = useToast(); const router = useRouter();
  const role = roles.find((r) => r.id === sel);
  const perms = draft ?? role?.permissions ?? [];
  const full = perms.includes("*");
  const locked = !role || (full && !isSuper) || (role.isSystem && full);
  const groups = Object.entries(catalogue).reduce<Record<string, [string, string][]>>((a, [k, v]) => { const g = k.split(":")[0]; (a[g] ??= []).push([k, v]); return a; }, {});
  return (<div className="grid lg:grid-cols-[260px_1fr] gap-4">
    <div className="card p-2 self-start">
      {roles.map((r) => <button key={r.id} onClick={() => { setSel(r.id); setDraft(null); }} className={`w-full text-start px-3 py-2 rounded-lg ${sel === r.id ? "bg-accent text-white" : "hover:bg-black/5 dark:hover:bg-white/10"}`}><div className="text-sm font-medium">{r.name}</div><div className={`text-[11px] ${sel === r.id ? "text-white/80" : "muted"}`}>{r._count.members} user(s){r.isSystem ? " · built-in" : ""}</div></button>)}
      <button className="btn-secondary btn-sm w-full mt-2" onClick={() => setCreating(true)}><Plus className="h-3.5 w-3.5" />New role</button>
    </div>
    {role && <div className="card p-4">
      <div className="flex items-start justify-between gap-3 mb-3"><div><h2 className="font-semibold">{role.name}</h2><p className="text-sm muted">{role.description}</p>{full && <p className="text-sm mt-1" style={{ color: "#ff9f0a" }}>Super user: every permission, including all current and future ones.</p>}</div>
        <div className="flex gap-2">{!role.isSystem && role._count.members === 0 && <button className="btn-ghost btn-sm" onClick={async () => { try { await apiFetch(`/api/admin/roles/${role.id}`, { method: "DELETE" }); toast.ok("Role deleted"); setSel(roles[0].id); router.refresh(); } catch (e) { toast.err(e); } }}>Delete</button>}
          {draft && <><button className="btn-secondary btn-sm" onClick={() => setDraft(null)}>Discard</button><button className="btn-primary btn-sm" onClick={async () => { try { await apiFetch(`/api/admin/roles/${role.id}`, { method: "PATCH", json: { permissions: draft } }); toast.ok("Permissions saved. Affected users must sign in again."); setDraft(null); router.refresh(); } catch (e) { toast.err(e); } }}>Save</button></>}</div></div>
      <div className="grid md:grid-cols-2 gap-x-6 gap-y-4">{Object.entries(groups).map(([g, items]) => <fieldset key={g}><legend className="label capitalize">{g}</legend>{items.map(([k, v]) => <label key={k} className="flex items-start gap-2 text-sm py-0.5"><input type="checkbox" className="mt-1" disabled={locked} checked={full || perms.includes(k)} onChange={(e) => setDraft(e.target.checked ? [...perms, k] : perms.filter((x) => x !== k))} /><span>{v}<span className="block text-[11px] muted font-mono">{k}</span></span></label>)}</fieldset>)}</div>
      {locked && <p className="text-xs muted mt-3">{role.isSystem && full ? "The built-in super-user role always has full access." : "Only a super user can change this role."}</p>}
    </div>}
    <Modal open={creating} onClose={() => setCreating(false)} title="New role">
      <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); const base = roles.find((r) => r.id === nf.copyFrom); try { const r = await apiFetch<{ id: string }>("/api/admin/roles", { method: "POST", json: { name: nf.name, description: nf.description || undefined, permissions: (base?.permissions ?? []).filter((p) => p !== "*") } }); toast.ok("Role created"); setCreating(false); setSel(r.id); router.refresh(); } catch (x) { toast.err(x); } }}>
        <div><label className="label">Name *</label><input className="input" required minLength={2} value={nf.name} onChange={(e) => setNf({ ...nf, name: e.target.value })} /></div>
        <div><label className="label">Description</label><input className="input" value={nf.description} onChange={(e) => setNf({ ...nf, description: e.target.value })} /></div>
        <div><label className="label">Start from</label><select className="input" value={nf.copyFrom} onChange={(e) => setNf({ ...nf, copyFrom: e.target.value })}><option value="">No permissions</option>{roles.filter((r) => !r.permissions.includes("*")).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
        <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setCreating(false)}>Cancel</button><button className="btn-primary">Create</button></div>
      </form>
    </Modal>
  </div>);
}
