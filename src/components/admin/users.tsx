"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Copy } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/client";

type M = { id: string; roleId: string; user: { id: string; email: string; name: string; jobTitle: string | null; isActive: boolean; lockedUntil: string | null; lastLoginAt: string | null; mfaEnabled: boolean }; role: { id: string; name: string } };
type Invite = { link: string | null; emailed: boolean };

export function UsersAdmin({ members, roles, departments, me }: { members: M[]; roles: { id: string; name: string }[]; departments: { id: string; name: string }[]; me: string }) {
  const [open, setOpen] = useState(false); const [f, setF] = useState<Record<string, string>>({});
  const [link, setLink] = useState<string | null>(null); const [q, setQ] = useState("");
  const toast = useToast(); const router = useRouter();
  const showInvite = (inv?: Invite) => { if (inv?.link) setLink(inv.link); else if (inv?.emailed) toast.ok("A password link was emailed"); };
  const patch = async (id: string, json: Record<string, unknown>, msg: string) => { try { const r = await apiFetch<{ invite?: Invite }>(`/api/admin/users/${id}`, { method: "PATCH", json }); toast.ok(msg); showInvite(r.invite); router.refresh(); } catch (e) { toast.err(e); } };
  const shown = members.filter((m) => !q || `${m.user.name} ${m.user.email} ${m.role.name}`.toLowerCase().includes(q.toLowerCase()));
  return (<>
    <div className="flex items-center gap-2 mb-3"><input className="input !w-72" placeholder="Filter by name, email or role" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter users" /><span className="text-sm muted">{members.filter((m) => m.user.isActive).length} active of {members.length}</span><div className="flex-1" /><button className="btn-primary" onClick={() => setOpen(true)}><UserPlus className="h-4 w-4" />Add user</button></div>
    <div className="card overflow-x-auto"><table className="table">
      <thead><tr><th>Name</th><th>Role</th><th>Status</th><th>Last sign-in</th><th>MFA</th><th /></tr></thead>
      <tbody>{shown.map((m) => { const locked = m.user.lockedUntil && new Date(m.user.lockedUntil) > new Date(); const self = m.user.id === me; return (
        <tr key={m.id} className={m.user.isActive ? "" : "opacity-60"}>
          <td><div className="font-medium">{m.user.name}</div><div className="text-[11px] muted">{m.user.email}{m.user.jobTitle ? ` · ${m.user.jobTitle}` : ""}</div></td>
          <td>{self ? <span className="text-sm">{m.role.name}</span> : <select className="input !h-8 !w-auto text-xs" value={m.roleId} onChange={(e) => patch(m.user.id, { roleId: e.target.value }, "Role changed. The user's sessions were signed out.")} aria-label={`Role for ${m.user.name}`}>{roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>}</td>
          <td className="text-xs">{!m.user.isActive ? "Deactivated" : locked ? <span style={{ color: "#ff3b30" }}>Locked</span> : "Active"}</td>
          <td className="text-xs">{m.user.lastLoginAt ? new Date(m.user.lastLoginAt).toLocaleString("en-GB") : "Never"}</td>
          <td className="text-xs">{m.user.mfaEnabled ? "On" : "Off"}</td>
          <td><div className="flex gap-1 justify-end">
            {locked && <button className="btn-secondary btn-sm" onClick={() => patch(m.user.id, { unlock: true }, "Unlocked")}>Unlock</button>}
            {m.user.isActive && <button className="btn-secondary btn-sm" onClick={() => patch(m.user.id, { resetLink: true }, "Password link issued")}>Reset password</button>}
            {!self && (m.user.isActive ? <button className="btn-ghost btn-sm" onClick={() => patch(m.user.id, { isActive: false }, "User deactivated and signed out")}>Deactivate</button> : <button className="btn-secondary btn-sm" onClick={() => patch(m.user.id, { isActive: true }, "User reactivated")}>Reactivate</button>)}
          </div></td>
        </tr>); })}</tbody></table></div>
    <Modal open={open} onClose={() => setOpen(false)} title="Add user">
      <form className="grid grid-cols-2 gap-3" onSubmit={async (e) => {
        e.preventDefault();
        try { const r = await apiFetch<{ invite: Invite }>("/api/admin/users", { method: "POST", json: { email: f.email, name: f.name, jobTitle: f.jobTitle || undefined, roleId: f.roleId, departmentId: f.departmentId || null } }); toast.ok("User added"); setOpen(false); setF({}); showInvite(r.invite); router.refresh(); } catch (x) { toast.err(x); }
      }}>
        <div className="col-span-2"><label className="label">Email *</label><input className="input" type="email" required value={f.email ?? ""} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
        <div className="col-span-2"><label className="label">Full name *</label><input className="input" required minLength={2} value={f.name ?? ""} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div><label className="label">Role *</label><select className="input" required value={f.roleId ?? ""} onChange={(e) => setF({ ...f, roleId: e.target.value })}><option value="">Choose…</option>{roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
        <div><label className="label">Department</label><select className="input" value={f.departmentId ?? ""} onChange={(e) => setF({ ...f, departmentId: e.target.value })}><option value="">—</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
        <div className="col-span-2"><label className="label">Job title</label><input className="input" value={f.jobTitle ?? ""} onChange={(e) => setF({ ...f, jobTitle: e.target.value })} /></div>
        <p className="col-span-2 text-xs muted">The person sets their own password from a one-time link. It is emailed when SMTP is configured; otherwise you will see the link to pass on securely.</p>
        <div className="col-span-2 flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button><button className="btn-primary">Add user</button></div>
      </form>
    </Modal>
    <Modal open={!!link} onClose={() => setLink(null)} title="One-time password link">
      <p className="text-sm mb-2">Email is not configured, so send this link to the person through a secure channel. It works once and expires. It will not be shown again.</p>
      <div className="flex gap-2"><input className="input font-mono text-xs" readOnly value={link ?? ""} onFocus={(e) => e.target.select()} /><button className="btn-secondary" onClick={() => { navigator.clipboard.writeText(link ?? ""); toast.ok("Copied"); }}><Copy className="h-4 w-4" /></button></div>
    </Modal>
  </>);
}
