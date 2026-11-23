"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/client";

export function TeamEditor({ projectKey, members, candidates, managerId, canEdit }: { projectKey: string; members: { userId: string; name: string; email: string; projectRole: string; workspaceRole: string }[]; candidates: { id: string; name: string }[]; managerId: string | null; canEdit: boolean }) {
  const [add, setAdd] = useState({ userId: "", projectRole: "Member" });
  const toast = useToast(); const router = useRouter();
  const put = async (userId: string, projectRole: string | null, msg: string) => { try { await apiFetch(`/api/projects/${projectKey}/members`, { method: "PUT", json: { userId, projectRole } }); toast.ok(msg); router.refresh(); } catch (e) { toast.err(e); } };
  return (<>
    {canEdit && <form className="flex flex-wrap gap-2 mb-3" onSubmit={(e) => { e.preventDefault(); if (add.userId) put(add.userId, add.projectRole, "Member added").then(() => setAdd({ userId: "", projectRole: "Member" })); }}>
      <select className="input !w-64" value={add.userId} onChange={(e) => setAdd({ ...add, userId: e.target.value })} aria-label="Person"><option value="">Add a workspace member…</option>{candidates.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <select className="input !w-auto" value={add.projectRole} onChange={(e) => setAdd({ ...add, projectRole: e.target.value })} aria-label="Project role">{["Member", "Manager", "Viewer"].map((r) => <option key={r}>{r}</option>)}</select>
      <button className="btn-primary" disabled={!add.userId}><UserPlus className="h-4 w-4" />Add</button>
    </form>}
    <div className="card overflow-hidden"><table className="table">
      <thead><tr><th>Name</th><th>Email</th><th>Workspace role</th><th>Project role</th><th /></tr></thead>
      <tbody>{members.map((m) => <tr key={m.userId}>
        <td className="font-medium">{m.name}{m.userId === managerId && <span className="chip ms-2">Project manager</span>}</td><td className="text-xs">{m.email}</td><td className="text-xs">{m.workspaceRole}</td>
        <td>{canEdit && m.userId !== managerId ? <select className="input !w-auto !h-8 text-xs" value={m.projectRole} onChange={(e) => put(m.userId, e.target.value, "Role updated")} aria-label={`Project role for ${m.name}`}>{["Member", "Manager", "Viewer"].map((r) => <option key={r}>{r}</option>)}</select> : <span className="text-xs">{m.projectRole}</span>}</td>
        <td className="text-end">{canEdit && m.userId !== managerId && <button className="btn-ghost btn-sm" onClick={() => put(m.userId, null, "Member removed")}>Remove</button>}</td>
      </tr>)}</tbody></table></div>
    <p className="text-xs muted mt-2">Viewers can read the project but cannot change work items. Workspace roles still apply: a project role never grants more than the person&apos;s workspace permissions.</p>
  </>);
}
