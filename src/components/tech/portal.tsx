"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Plus, TerminalSquare, Monitor, FolderOpen, Pencil, Trash2, PlugZap, Folder, File, Download, Upload, ArrowUp } from "lucide-react";
import { Modal, Confirm } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/client";

const Terminal = dynamic(() => import("./terminal").then((m) => m.Terminal), { ssr: false });
const RdpViewer = dynamic(() => import("./rdp").then((m) => m.RdpViewer), { ssr: false });
type C = { id: string; name: string; protocol: string; host: string; port: number; username: string; authType: string; domain: string | null; notes: string | null; hasSecret: boolean; hostKeySha256: string | null; ignoreCert: boolean };
const PORT: Record<string, number> = { SSH: 22, SFTP: 22, RDP: 3389 };

export function TechPortal({ connections, canManage, rdpGateway }: { connections: C[]; canManage: boolean; rdpGateway: boolean }) {
  const [rdp, setRdp] = useState<{ id: string; password?: string } | null>(null); const [ask, setAsk] = useState<C | null>(null); const [pw, setPw] = useState("");
  const [edit, setEdit] = useState<Partial<C> & { secret?: string; resetHostKey?: boolean } | null>(null);
  const [term, setTerm] = useState<string | null>(null); const [files, setFiles] = useState<C | null>(null); const [del, setDel] = useState<C | null>(null);
  const toast = useToast(); const router = useRouter();
  return (<>
    {canManage && <div className="flex justify-end mb-3"><button className="btn-primary" onClick={() => setEdit({ protocol: "SSH", port: 22, authType: "PASSWORD" })}><Plus className="h-4 w-4" />Add connection</button></div>}
    {!connections.length ? <div className="card p-10 text-center"><div className="font-medium">No connections yet</div><div className="text-sm muted mt-1">{canManage ? "Add an SSH, SFTP or RDP server. Credentials are encrypted at rest and never sent to the browser." : "Ask a technical administrator to register servers."}</div></div> : (
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">{connections.map((c) => (
        <div key={c.id} className="card p-4">
          <div className="flex items-center gap-2"><span className="chip">{c.protocol}</span><span className="font-medium truncate">{c.name}</span>
            {canManage && <span className="ms-auto flex"><button className="btn-ghost btn-sm !px-1.5" aria-label="Edit" onClick={() => setEdit(c)}><Pencil className="h-3.5 w-3.5" /></button><button className="btn-ghost btn-sm !px-1.5" aria-label="Delete" onClick={() => setDel(c)}><Trash2 className="h-3.5 w-3.5" /></button></span>}</div>
          <div className="text-sm muted mt-1 font-mono truncate">{c.domain ? `${c.domain}\\` : ""}{c.username}@{c.host}:{c.port}</div>
          {c.notes && <div className="text-xs muted mt-1">{c.notes}</div>}
          <div className="text-[11px] muted mt-1">{c.protocol !== "RDP" ? (c.hostKeySha256 ? `Host key pinned · SHA256:${c.hostKeySha256.slice(0, 16)}…` : "Host key will be pinned on first connect") : c.hasSecret ? "" : ""}</div>
          <div className="flex flex-wrap gap-2 mt-3">
            {c.protocol === "SSH" && <button className="btn-primary btn-sm" onClick={() => setTerm(c.id)}><TerminalSquare className="h-3.5 w-3.5" />Open terminal</button>}
            {(c.protocol === "SSH" || c.protocol === "SFTP") && <button className="btn-secondary btn-sm" onClick={() => setFiles(c)}><FolderOpen className="h-3.5 w-3.5" />Files</button>}
            {c.protocol === "RDP" && rdpGateway && <button className="btn-primary btn-sm" onClick={() => (c.hasSecret ? setRdp({ id: c.id }) : (setPw(""), setAsk(c)))}><Monitor className="h-3.5 w-3.5" />Open in browser</button>}
            {c.protocol === "RDP" && <a className={rdpGateway ? "btn-secondary btn-sm" : "btn-primary btn-sm"} href={`/api/tech/connections/${c.id}/rdp`}><Monitor className="h-3.5 w-3.5" />Download .rdp</a>}
            <button className="btn-secondary btn-sm" onClick={async () => { try { const r = await apiFetch<{ ok: boolean; detail: string }>(`/api/tech/connections/${c.id}/test`, { method: "POST" }); (r.ok ? toast.ok : (m: string) => toast.err(new Error(m)))(r.detail); router.refresh(); } catch (e) { toast.err(e); } }}><PlugZap className="h-3.5 w-3.5" />Test</button>
          </div>
        </div>))}</div>)}
    {rdp && <RdpViewer connectionId={rdp.id} password={rdp.password} onClose={() => { setRdp(null); router.refresh(); }} />}
    <Modal open={!!ask} onClose={() => setAsk(null)} title={`Sign in to ${ask?.name ?? ""}`}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); setRdp({ id: ask!.id, password: pw }); setAsk(null); }}>
        <p className="text-sm muted">The password is used once for this session and is not stored.</p>
        <div><label className="label">Password for {ask?.domain ? `${ask.domain}\\` : ""}{ask?.username}</label><input className="input" type="password" autoFocus autoComplete="off" value={pw} onChange={(e) => setPw(e.target.value)} /></div>
        <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setAsk(null)}>Cancel</button><button className="btn-primary">Connect</button></div>
      </form>
    </Modal>
    {term && <Terminal connectionId={term} onClose={() => { setTerm(null); router.refresh(); }} />}
    {files && <SftpBrowser c={files} onClose={() => setFiles(null)} />}
    <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? "Edit connection" : "Add connection"}>
      {edit && <form className="grid grid-cols-2 gap-3" onSubmit={async (e) => {
        e.preventDefault();
        const json = { name: edit.name, protocol: edit.protocol, host: edit.host, port: Number(edit.port), username: edit.username, authType: edit.authType, secret: edit.secret || undefined, domain: edit.domain || null, notes: edit.notes || null, ignoreCert: !!edit.ignoreCert, resetHostKey: !!edit.resetHostKey };
        try { await apiFetch(`/api/tech/connections${edit.id ? `/${edit.id}` : ""}`, { method: edit.id ? "PATCH" : "POST", json }); toast.ok("Saved"); setEdit(null); router.refresh(); } catch (x) { toast.err(x); }
      }}>
        <div className="col-span-2"><label className="label">Name *</label><input className="input" required value={edit.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
        <div><label className="label">Protocol</label><select className="input" value={edit.protocol} onChange={(e) => setEdit({ ...edit, protocol: e.target.value, port: PORT[e.target.value] })}>{["SSH", "SFTP", "RDP"].map((p) => <option key={p}>{p}</option>)}</select></div>
        <div><label className="label">Port</label><input className="input" type="number" min={1} max={65535} required value={edit.port ?? ""} onChange={(e) => setEdit({ ...edit, port: Number(e.target.value) })} /></div>
        <div className="col-span-2"><label className="label">Host *</label><input className="input font-mono" required placeholder="server.example.com or 10.0.0.5" value={edit.host ?? ""} onChange={(e) => setEdit({ ...edit, host: e.target.value })} /></div>
        <div><label className="label">Username *</label><input className="input" required autoComplete="off" value={edit.username ?? ""} onChange={(e) => setEdit({ ...edit, username: e.target.value })} /></div>
        {edit.protocol === "RDP" ? <div><label className="label">Domain</label><input className="input" value={edit.domain ?? ""} onChange={(e) => setEdit({ ...edit, domain: e.target.value })} /></div>
          : <div><label className="label">Authentication</label><select className="input" value={edit.authType} onChange={(e) => setEdit({ ...edit, authType: e.target.value })}><option value="PASSWORD">Password</option><option value="KEY">Private key</option></select></div>}
        {edit.protocol === "RDP" && <div className="col-span-2"><label className="label">Password (optional){edit.id && edit.hasSecret ? " — leave empty to keep the stored one" : ""}</label><input className="input" type="password" autoComplete="new-password" value={edit.secret ?? ""} onChange={(e) => setEdit({ ...edit, secret: e.target.value })} /><p className="text-[11px] muted mt-0.5">Stored encrypted for in-browser sessions. Leave empty to be asked each time. The .rdp download never contains it.</p></div>}
        {edit.protocol === "RDP" && <label className="col-span-2 text-sm flex items-center gap-2"><input type="checkbox" checked={!!edit.ignoreCert} onChange={(e) => setEdit({ ...edit, ignoreCert: e.target.checked })} />Accept the server&apos;s self-signed certificate</label>}
        {edit.protocol !== "RDP" && <div className="col-span-2"><label className="label">{edit.authType === "KEY" ? "Private key (OpenSSH/PEM)" : "Password"}{edit.id && edit.hasSecret ? " — leave empty to keep the stored one" : ""}</label>
          {edit.authType === "KEY" ? <textarea className="input font-mono text-xs" rows={4} autoComplete="off" value={edit.secret ?? ""} onChange={(e) => setEdit({ ...edit, secret: e.target.value })} /> : <input className="input" type="password" autoComplete="new-password" value={edit.secret ?? ""} onChange={(e) => setEdit({ ...edit, secret: e.target.value })} />}</div>}
        <div className="col-span-2"><label className="label">Notes</label><input className="input" value={edit.notes ?? ""} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></div>
        {edit.id && edit.protocol !== "RDP" && edit.hostKeySha256 && <label className="col-span-2 text-sm flex items-center gap-2"><input type="checkbox" checked={!!edit.resetHostKey} onChange={(e) => setEdit({ ...edit, resetHostKey: e.target.checked })} />Forget the pinned host key (only if the server was legitimately rebuilt)</label>}
        <div className="col-span-2 flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setEdit(null)}>Cancel</button><button className="btn-primary">Save</button></div>
      </form>}
    </Modal>
    <Confirm open={!!del} title="Delete connection?" body={`“${del?.name}” and its stored credential will be removed.`} danger onCancel={() => setDel(null)} onConfirm={async () => { const c = del!; setDel(null); try { await apiFetch(`/api/tech/connections/${c.id}`, { method: "DELETE" }); toast.ok("Deleted"); router.refresh(); } catch (e) { toast.err(e); } }} />
  </>);
}

type Entry = { name: string; size: number; mtime: number; dir: boolean };
function SftpBrowser({ c, onClose }: { c: C; onClose: () => void }) {
  const [dir, setDir] = useState<{ path: string; entries: Entry[] } | null>(null); const [busy, setBusy] = useState(false);
  const toast = useToast();
  const load = async (p: string) => { setBusy(true); try { setDir(await apiFetch(`/api/tech/connections/${c.id}/sftp?path=${encodeURIComponent(p)}`)); } catch (e) { toast.err(e); } finally { setBusy(false); } };
  if (!dir && !busy) void load(".");
  const join = (n: string) => (dir!.path === "/" ? `/${n}` : `${dir!.path}/${n}`);
  return (
    <Modal open onClose={onClose} title={`Files · ${c.name}`} wide>
      <div className="flex items-center gap-2 mb-2">
        <button className="btn-secondary btn-sm !px-2" disabled={!dir || dir.path === "/"} onClick={() => load(dir!.path.replace(/\/[^/]+$/, "") || "/")} aria-label="Up"><ArrowUp className="h-3.5 w-3.5" /></button>
        <code className="text-xs flex-1 truncate">{dir?.path ?? "…"}</code>
        <label className="btn-secondary btn-sm cursor-pointer"><Upload className="h-3.5 w-3.5" />Upload<input type="file" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; if (!f || !dir) return; const fd = new FormData(); fd.set("file", f); fd.set("dir", dir.path); try { await apiFetch(`/api/tech/connections/${c.id}/sftp`, { method: "POST", body: fd }); toast.ok("Uploaded"); load(dir.path); } catch (x) { toast.err(x); } }} /></label>
      </div>
      <div className="max-h-[60vh] overflow-auto border border-line rounded-lg"><table className="table"><tbody>
        {busy && <tr><td className="text-sm muted">Loading…</td></tr>}
        {dir?.entries.map((e) => <tr key={e.name}><td>{e.dir ? <button className="flex items-center gap-2 text-accent text-sm" onClick={() => load(join(e.name))}><Folder className="h-4 w-4" />{e.name}</button> : <span className="flex items-center gap-2 text-sm"><File className="h-4 w-4 muted" />{e.name}</span>}</td>
          <td className="text-xs text-end">{e.dir ? "" : e.size > 1048576 ? `${(e.size / 1048576).toFixed(1)} MB` : `${Math.ceil(e.size / 1024)} KB`}</td><td className="text-xs">{new Date(e.mtime).toLocaleString("en-GB")}</td>
          <td>{!e.dir && <a className="btn-ghost btn-sm !px-1.5" aria-label={`Download ${e.name}`} href={`/api/tech/connections/${c.id}/sftp?file=${encodeURIComponent(join(e.name))}`}><Download className="h-3.5 w-3.5" /></a>}</td></tr>)}
      </tbody></table></div>
      <p className="text-xs muted mt-2">Transfers up to 100 MB. Every download and upload is audited.</p>
    </Modal>
  );
}
