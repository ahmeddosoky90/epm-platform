"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, RefreshCw, Paperclip, Search, Unplug, TicketPlus, Send } from "lucide-react";
import { Modal, Confirm } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/client";

type Status = { connected: boolean; host?: string; port?: number; secure?: boolean; user?: string; allowSelfSigned?: boolean };
type Msg = { uid: number; subject: string; from: string; date: string | null; seen: boolean; hasAttachments: boolean };
type Full = { uid: number; subject: string; from: string; to: string; date: string | null; text: string; attachments: { filename: string; size: number; contentType: string }[] };
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const when = (d: string | null) => { if (!d) return ""; const x = new Date(d); return `${x.getDate()} ${MON[x.getMonth()]} ${String(x.getHours()).padStart(2, "0")}:${String(x.getMinutes()).padStart(2, "0")}`; };
const kb = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export function Mailbox({ status, projects, types, canCreate }: { status: Status; projects: { key: string; name: string }[]; types: { id: string; name: string }[]; canCreate: boolean }) {
  const [form, setForm] = useState<(Status & { password?: string }) | null>(null);
  const [list, setList] = useState<{ total: number; messages: Msg[] } | null>(null); const [busy, setBusy] = useState(false); const [q, setQ] = useState("");
  const [open, setOpen] = useState<Full | null>(null); const [toIssue, setToIssue] = useState<Full | null>(null); const [disc, setDisc] = useState(false);
  const toast = useToast(); const router = useRouter();
  const load = async (query = q) => { setBusy(true); try { setList(await apiFetch(`/api/integrations/mail/messages${query ? `?q=${encodeURIComponent(query)}` : ""}`)); } catch (e) { toast.err(e); } finally { setBusy(false); } };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (status.connected) void load(""); }, [status.connected]);

  const settingsForm = form && (
    <Modal open onClose={() => setForm(null)} title={status.connected ? "Mailbox settings" : "Connect your mailbox"}>
      <form className="grid grid-cols-2 gap-3" onSubmit={async (e) => {
        e.preventDefault(); setBusy(true);
        try { await apiFetch("/api/integrations/mail", { method: "PUT", json: { host: form.host, port: Number(form.port), secure: !!form.secure, user: form.user, password: form.password || undefined, allowSelfSigned: !!form.allowSelfSigned } }); toast.ok("Mailbox connected"); setForm(null); router.refresh(); }
        catch (x) { toast.err(x); } finally { setBusy(false); }
      }}>
        <p className="col-span-2 text-sm muted">Uses IMAP. Exchange/Outlook needs IMAP enabled for your mailbox; Gmail needs an app password. Your password is encrypted on the server and never shown again.</p>
        <div className="col-span-2"><label className="label">IMAP server *</label><input className="input font-mono" required placeholder="outlook.office365.com" value={form.host ?? ""} onChange={(e) => setForm({ ...form, host: e.target.value })} /></div>
        <div><label className="label">Port</label><input className="input" type="number" min={1} max={65535} required value={form.port ?? 993} onChange={(e) => setForm({ ...form, port: Number(e.target.value) })} /></div>
        <div><label className="label">Security</label><select className="input" value={form.secure ? "tls" : "plain"} onChange={(e) => setForm({ ...form, secure: e.target.value === "tls", port: e.target.value === "tls" ? 993 : 143 })}><option value="tls">TLS (993)</option><option value="plain">STARTTLS / plain (143)</option></select></div>
        <div className="col-span-2"><label className="label">Username *</label><input className="input" required autoComplete="off" placeholder="name@company.com" value={form.user ?? ""} onChange={(e) => setForm({ ...form, user: e.target.value })} /></div>
        <div className="col-span-2"><label className="label">Password{status.connected ? " (leave empty to keep the stored one)" : " *"}</label><input className="input" type="password" required={!status.connected} autoComplete="new-password" value={form.password ?? ""} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
        <label className="col-span-2 text-sm flex items-center gap-2"><input type="checkbox" checked={!!form.allowSelfSigned} onChange={(e) => setForm({ ...form, allowSelfSigned: e.target.checked })} />Accept a self-signed certificate (internal servers only)</label>
        <div className="col-span-2 flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setForm(null)}>Cancel</button><button className="btn-primary" disabled={busy}>{busy ? "Checking sign-in…" : "Save and test"}</button></div>
      </form>
    </Modal>);

  if (!status.connected) return (<>
    <div className="card p-10 text-center"><Mail className="h-8 w-8 mx-auto muted" /><div className="font-medium mt-2">Your mailbox is not connected</div>
      <div className="text-sm muted mt-1">Connect it to read mail here and turn any email into an issue, with its attachments.</div>
      <button className="btn-primary mt-4" onClick={() => setForm({ connected: false, port: 993, secure: true })}>Connect mailbox</button></div>
    {settingsForm}
  </>);

  return (<>
    <div className="card">
      <div className="flex flex-wrap items-center gap-2 p-3 border-b border-black/5 dark:border-white/10">
        <Mail className="h-4 w-4" /><span className="font-medium text-sm">{status.user}</span><span className="text-xs muted">{status.host}</span>
        <form className="ms-auto flex gap-2" onSubmit={(e) => { e.preventDefault(); void load(); }}>
          <div className="relative"><Search className="h-3.5 w-3.5 absolute start-2 top-1/2 -translate-y-1/2 muted" /><input className="input !w-56 !ps-7" placeholder="Search subject, sender, body" aria-label="Search mail" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <button className="btn-secondary btn-sm" type="button" onClick={() => void load()} aria-label="Refresh"><RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} /></button>
        </form>
        <button className="btn-ghost btn-sm" onClick={() => setForm({ ...status, password: "" })}>Settings</button>
        <button className="btn-ghost btn-sm" onClick={() => setDisc(true)}><Unplug className="h-3.5 w-3.5" />Disconnect</button>
      </div>
      {!list ? <p className="p-6 text-sm muted">{busy ? "Loading inbox…" : "Inbox not loaded."}</p> : !list.messages.length ? <p className="p-6 text-sm muted">{q ? "No messages match." : "The inbox is empty."}</p> : (
        <ul className="divide-y divide-black/5 dark:divide-white/10">{list.messages.map((m) => (
          <li key={m.uid}><button className="w-full text-start px-4 py-2.5 hover:bg-black/[.03] dark:hover:bg-white/[.04] flex items-center gap-3" onClick={async () => { try { setOpen(await apiFetch(`/api/integrations/mail/messages?uid=${m.uid}`)); } catch (e) { toast.err(e); } }}>
            <span className={`h-2 w-2 rounded-full shrink-0 ${m.seen ? "" : "bg-accent"}`} />
            <span className={`w-48 truncate text-sm ${m.seen ? "" : "font-semibold"}`}>{m.from}</span>
            <span className={`flex-1 truncate text-sm ${m.seen ? "muted" : "font-medium"}`}>{m.subject}</span>
            {m.hasAttachments && <Paperclip className="h-3.5 w-3.5 muted" />}
            <span className="text-xs muted w-24 text-end">{when(m.date)}</span>
          </button></li>))}</ul>)}
      {list && <div className="px-4 py-2 text-[11px] muted border-t border-black/5 dark:border-white/10">Showing {list.messages.length} of {list.total} in Inbox</div>}
    </div>
    <Modal open={!!open} onClose={() => setOpen(null)} title={open?.subject ?? ""} wide>
      {open && <div>
        <div className="text-xs muted space-y-0.5"><div>From: {open.from}</div><div>To: {open.to}</div><div>{when(open.date)}</div></div>
        <pre className="mt-3 whitespace-pre-wrap text-sm font-sans max-h-[50vh] overflow-auto">{open.text || "(no text content)"}</pre>
        {!!open.attachments.length && <div className="mt-3 flex flex-wrap gap-2">{open.attachments.map((a, i) => <span key={i} className="chip"><Paperclip className="h-3 w-3" />{a.filename} · {kb(a.size)}</span>)}</div>}
        <div className="flex justify-end mt-4">{canCreate && <button className="btn-primary" onClick={() => { setToIssue(open); setOpen(null); }}><TicketPlus className="h-4 w-4" />Create issue</button>}</div>
      </div>}
    </Modal>
    {toIssue && <ToIssue m={toIssue} projects={projects} types={types} onClose={() => setToIssue(null)} />}
    {settingsForm}
    <Confirm open={disc} title="Disconnect mailbox?" body="The stored mailbox password will be deleted. Issues already created from email are kept." onCancel={() => setDisc(false)} onConfirm={async () => { setDisc(false); try { await apiFetch("/api/integrations/mail", { method: "DELETE" }); toast.ok("Disconnected"); setList(null); router.refresh(); } catch (e) { toast.err(e); } }} />
  </>);
}

function ToIssue({ m, projects, types, onClose }: { m: Full; projects: { key: string; name: string }[]; types: { id: string; name: string }[]; onClose: () => void }) {
  const [f, setF] = useState({ projectKey: projects[0]?.key ?? "", typeId: types.find((t) => t.name === "Bug")?.id ?? types[0]?.id ?? "", priority: "Medium", includeAttachments: true });
  const [busy, setBusy] = useState(false); const toast = useToast(); const router = useRouter();
  return (
    <Modal open onClose={onClose} title="Create issue from email">
      <form className="grid grid-cols-2 gap-3" onSubmit={async (e) => {
        e.preventDefault(); setBusy(true);
        try { const r = await apiFetch<{ key: string; skipped: string[] }>("/api/integrations/mail/to-issue", { method: "POST", json: { uid: m.uid, ...f } }); toast.ok(r.skipped.length ? `${r.key} created; skipped ${r.skipped.join("; ")}` : `${r.key} created`); onClose(); router.push(`/issues/${r.key}`); }
        catch (x) { toast.err(x); } finally { setBusy(false); }
      }}>
        <div className="col-span-2 text-sm"><span className="muted">Summary:</span> {m.subject}</div>
        <div><label className="label">Project</label><select className="input" required value={f.projectKey} onChange={(e) => setF({ ...f, projectKey: e.target.value })}>{projects.map((p) => <option key={p.key} value={p.key}>{p.key} · {p.name}</option>)}</select></div>
        <div><label className="label">Type</label><select className="input" required value={f.typeId} onChange={(e) => setF({ ...f, typeId: e.target.value })}>{types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
        <div><label className="label">Priority</label><select className="input" value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}>{["Blocker", "Critical", "High", "Medium", "Low"].map((p) => <option key={p}>{p}</option>)}</select></div>
        <label className="text-sm flex items-center gap-2 self-end pb-2"><input type="checkbox" checked={f.includeAttachments} disabled={!m.attachments.length} onChange={(e) => setF({ ...f, includeAttachments: e.target.checked })} />Copy {m.attachments.length} attachment{m.attachments.length === 1 ? "" : "s"}</label>
        <div className="col-span-2 flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy || !f.projectKey}>Create issue</button></div>
      </form>
    </Modal>);
}

export function SmtpTest({ email }: { email: string }) {
  const [busy, setBusy] = useState(false); const toast = useToast();
  return <button className="btn-secondary btn-sm mt-3" disabled={busy} onClick={async () => { setBusy(true); try { await apiFetch("/api/integrations/smtp-test", { method: "POST" }); toast.ok(`Test message sent to ${email}`); } catch (e) { toast.err(e); } finally { setBusy(false); } }}><Send className="h-3.5 w-3.5" />Send test email</button>;
}
