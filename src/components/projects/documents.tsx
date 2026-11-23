"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, Download, Trash2, Plus, Pencil, History } from "lucide-react";
import { Modal, Confirm } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/client";

type Version = { id: string; version: number; fileName: string; sizeBytes: number; uploadedById: string; createdAt: string };
type Doc = { id: string; title: string; category: string; status: string; issueKey: string | null; gateStageId: string | null; versions: Version[] };
const STATUS: Record<string, string> = { DRAFT: "#8e8e93", IN_REVIEW: "#ff9f0a", APPROVED: "#34c759" };
const kb = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`);

export function DocumentLibrary({ projectKey, docs, gates, users, categories, canUpload, canApprove, canDelete, me }: { projectKey: string; docs: Doc[]; gates: { id: string; name: string }[]; users: Record<string, string>; categories: readonly string[]; canUpload: boolean; canApprove: boolean; canDelete: boolean; me: string }) {
  const [upload, setUpload] = useState<null | { documentId?: string; title?: string }>(null);
  const [hist, setHist] = useState<Doc | null>(null); const [del, setDel] = useState<Doc | null>(null);
  const [filter, setFilter] = useState("");
  const toast = useToast(); const router = useRouter();
  const act = async (fn: () => Promise<unknown>, msg: string) => { try { await fn(); toast.ok(msg); router.refresh(); } catch (e) { toast.err(e); } };
  const shown = docs.filter((d) => !filter || d.category === filter);
  const gate = (id: string | null) => gates.find((g) => g.id === id)?.name;
  return (<>
    <div className="flex items-center gap-2 mb-3">
      <select className="input !w-auto" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Category"><option value="">All categories</option>{categories.map((c) => <option key={c}>{c}</option>)}</select>
      <div className="flex-1" />
      {canUpload && <button className="btn-primary" onClick={() => setUpload({})}><Upload className="h-4 w-4" />Upload document</button>}
    </div>
    {!shown.length ? <div className="card p-10 text-center"><div className="font-medium">No documents yet</div><div className="text-sm muted mt-1">Upload the business case, charter, plans and other controlled documents. Each upload is versioned and every download is audited.</div></div> : (
      <div className="card overflow-hidden"><table className="table">
        <thead><tr><th>Document</th><th>Category</th><th>Status</th><th>Version</th><th>Evidence for gate</th><th>Updated</th><th /></tr></thead>
        <tbody>{shown.map((d) => { const v = d.versions[0]; return (
          <tr key={d.id}>
            <td><div className="font-medium">{d.title}</div><div className="text-[11px] muted">{v?.fileName} · {v ? kb(v.sizeBytes) : ""}{d.issueKey ? ` · ${d.issueKey}` : ""}</div></td>
            <td className="text-xs">{d.category}</td>
            <td><span className="chip" style={{ color: STATUS[d.status], background: STATUS[d.status] + "1f" }}>{d.status.replace("_", " ").toLowerCase()}</span></td>
            <td className="text-xs">v{v?.version ?? 0}</td>
            <td className="text-xs">{gate(d.gateStageId) ?? "—"}</td>
            <td className="text-xs">{v ? `${new Date(v.createdAt).toLocaleDateString("en-GB")} · ${users[v.uploadedById] ?? ""}` : ""}</td>
            <td><div className="flex gap-1 justify-end flex-wrap">
              <a className="btn-secondary btn-sm !px-2" href={`/api/documents/${d.id}`} aria-label={`Download ${d.title}`} title="Download latest"><Download className="h-3.5 w-3.5" /></a>
              <button className="btn-secondary btn-sm !px-2" onClick={() => setHist(d)} aria-label="Version history" title="Version history"><History className="h-3.5 w-3.5" /></button>
              {canUpload && <button className="btn-secondary btn-sm" onClick={() => setUpload({ documentId: d.id, title: d.title })}>New version</button>}
              {canUpload && d.status === "DRAFT" && <button className="btn-secondary btn-sm" onClick={() => act(() => apiFetch(`/api/documents/${d.id}`, { method: "PATCH", json: { status: "IN_REVIEW" } }), "Submitted for review")}>Submit</button>}
              {canApprove && d.status === "IN_REVIEW" && (v?.uploadedById === me ? <span className="text-[11px] muted self-center" title="Segregation of duties">another approver needed</span> : <button className="btn-primary btn-sm" onClick={() => act(() => apiFetch(`/api/documents/${d.id}`, { method: "PATCH", json: { status: "APPROVED" } }), "Document approved")}>Approve</button>)}
              {canApprove && d.status !== "DRAFT" && <button className="btn-ghost btn-sm" onClick={() => act(() => apiFetch(`/api/documents/${d.id}`, { method: "PATCH", json: { status: "DRAFT" } }), "Returned to draft")}>Return</button>}
              {canDelete && d.status !== "APPROVED" && <button className="btn-ghost btn-sm !px-2" onClick={() => setDel(d)} aria-label="Delete"><Trash2 className="h-3.5 w-3.5" /></button>}
            </div></td>
          </tr>); })}</tbody></table></div>)}

    <UploadModal open={!!upload} target={upload} onClose={() => setUpload(null)} projectKey={projectKey} gates={gates} categories={categories} onDone={() => { setUpload(null); router.refresh(); }} />
    <Modal open={!!hist} onClose={() => setHist(null)} title={`Versions · ${hist?.title ?? ""}`}>
      <ul className="divide-y divide-line text-sm">{hist?.versions.map((v) => <li key={v.id} className="flex items-center justify-between py-2"><span><b>v{v.version}</b> · {v.fileName} · {kb(v.sizeBytes)}<br /><span className="text-xs muted">{new Date(v.createdAt).toLocaleString("en-GB")} · {users[v.uploadedById]}</span></span><a className="btn-secondary btn-sm" href={`/api/documents/${hist.id}?version=${v.version}`}>Download</a></li>)}</ul>
    </Modal>
    <Confirm open={!!del} title="Delete document?" body={`“${del?.title}” and all ${del?.versions.length} version(s) will be removed. This is recorded in the audit log.`} danger onCancel={() => setDel(null)} onConfirm={() => { const d = del!; setDel(null); act(() => apiFetch(`/api/documents/${d.id}`, { method: "DELETE" }), "Document deleted"); }} />
  </>);
}

function UploadModal({ open, target, onClose, projectKey, gates, categories, onDone }: { open: boolean; target: { documentId?: string; title?: string } | null; onClose: () => void; projectKey: string; gates: { id: string; name: string }[]; categories: readonly string[]; onDone: () => void }) {
  const [f, setF] = useState<Record<string, string>>({ category: categories[0] }); const [file, setFile] = useState<File | null>(null); const [busy, setBusy] = useState(false);
  const toast = useToast();
  return (
    <Modal open={open} onClose={onClose} title={target?.documentId ? `New version · ${target.title}` : "Upload document"}>
      <form className="space-y-3" onSubmit={async (e) => {
        e.preventDefault(); if (!file) return; setBusy(true);
        const fd = new FormData(); fd.set("file", file);
        if (target?.documentId) fd.set("documentId", target.documentId); else for (const [k, v] of Object.entries(f)) if (v) fd.set(k, v);
        try { await apiFetch(`/api/projects/${projectKey}/documents`, { method: "POST", body: fd }); toast.ok("Uploaded"); setFile(null); setF({ category: categories[0] }); onDone(); } catch (x) { toast.err(x); } finally { setBusy(false); }
      }}>
        {!target?.documentId && <>
          <div><label className="label">Title *</label><input className="input" required minLength={2} value={f.title ?? ""} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Category *</label><select className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{categories.map((c) => <option key={c}>{c}</option>)}</select></div>
            <div><label className="label">Evidence for gate</label><select className="input" value={f.gateStageId ?? ""} onChange={(e) => setF({ ...f, gateStageId: e.target.value })}><option value="">—</option>{gates.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></div>
          </div>
          <div><label className="label">Related issue key</label><input className="input" placeholder={`${projectKey}-12`} value={f.issueKey ?? ""} onChange={(e) => setF({ ...f, issueKey: e.target.value.toUpperCase() })} /></div>
        </>}
        {target?.documentId && <p className="text-sm muted">An approved document returns to draft when a new version is uploaded, so it is reviewed again.</p>}
        <input type="file" className="input" required onChange={(e) => setFile(e.target.files?.[0] ?? null)} aria-label="File" />
        <p className="text-xs muted">Max 25 MB. Office, PDF, images, text, CSV, ZIP and MS Project files. Executables are rejected.</p>
        <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={!file || busy}>{busy ? "Uploading…" : "Upload"}</button></div>
      </form>
    </Modal>
  );
}

type Req = { id: string; code: string; title: string; description: string | null; objectiveCode: string | null; issueKeys: string[]; testRef: string | null; status: string; linked: { key: string; summary: string; status: { name: string; category: string }; type: { name: string } }[]; coverage: number; gaps: string[] };

export function Traceability({ projectKey, reqs, canEdit, objectives }: { projectKey: string; reqs: Req[]; canEdit: boolean; objectives: string[] }) {
  const [edit, setEdit] = useState<Partial<Req> | null>(null);
  const toast = useToast(); const router = useRouter();
  return (<>
    <div className="flex items-center justify-between mb-3"><h2 className="font-semibold">Requirements traceability</h2>{canEdit && <button className="btn-secondary btn-sm" onClick={() => setEdit({ status: "DRAFT", issueKeys: [] })}><Plus className="h-3.5 w-3.5" />Requirement</button>}</div>
    {!reqs.length ? <div className="card p-8 text-center text-sm muted">No requirements recorded. Link each requirement to an objective, delivery items and a test to see coverage gaps.</div> : (
      <div className="card overflow-x-auto"><table className="table">
        <thead><tr><th>Req</th><th>Objective</th><th>Delivery items</th><th>Test</th><th>Status</th><th>Done</th><th>Gaps</th><th /></tr></thead>
        <tbody>{reqs.map((r) => <tr key={r.id}>
          <td><b>{r.code}</b> <span className="text-sm">{r.title}</span></td>
          <td className="text-xs">{r.objectiveCode ?? "—"}</td>
          <td className="text-xs"><div className="flex flex-wrap gap-1">{r.linked.map((i) => <a key={i.key} href={`/issues/${i.key}`} className="chip !text-[10px]" title={`${i.type.name}: ${i.summary} · ${i.status.name}`} style={i.status.category === "DONE" ? { color: "#34c759" } : undefined}>{i.key}</a>)}</div></td>
          <td className="text-xs">{r.testRef ?? "—"}</td><td className="text-xs">{r.status}</td>
          <td className="text-xs">{r.coverage}%</td>
          <td className="text-xs" style={{ color: r.gaps.length ? "#ff9f0a" : "#34c759" }}>{r.gaps.join(", ") || "Covered"}</td>
          <td>{canEdit && <button className="btn-ghost btn-sm !px-1.5" aria-label={`Edit ${r.code}`} onClick={() => setEdit(r)}><Pencil className="h-3.5 w-3.5" /></button>}</td>
        </tr>)}</tbody></table></div>)}
    <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? `Edit ${edit.code}` : "New requirement"}>
      {edit && <form className="grid grid-cols-2 gap-3" onSubmit={async (e) => {
        e.preventDefault();
        const json = { code: edit.code, title: edit.title, description: edit.description ?? undefined, objectiveCode: edit.objectiveCode || null, issueKeys: edit.issueKeys ?? [], testRef: edit.testRef || null, status: edit.status };
        try { await apiFetch(`/api/projects/${projectKey}/requirements${edit.id ? `?id=${edit.id}` : ""}`, { method: edit.id ? "PATCH" : "POST", json }); toast.ok("Saved"); setEdit(null); router.refresh(); } catch (x) { toast.err(x); }
      }}>
        <div><label className="label">Code *</label><input className="input" required value={edit.code ?? ""} onChange={(e) => setEdit({ ...edit, code: e.target.value.toUpperCase() })} placeholder="REQ-01" /></div>
        <div><label className="label">Status</label><select className="input" value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}>{["DRAFT", "APPROVED", "IMPLEMENTED", "VERIFIED", "REJECTED"].map((s) => <option key={s}>{s}</option>)}</select></div>
        <div className="col-span-2"><label className="label">Title *</label><input className="input" required value={edit.title ?? ""} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></div>
        <div><label className="label">Objective</label><select className="input" value={edit.objectiveCode ?? ""} onChange={(e) => setEdit({ ...edit, objectiveCode: e.target.value })}><option value="">—</option>{objectives.map((o) => <option key={o}>{o}</option>)}</select></div>
        <div><label className="label">Test reference</label><input className="input" value={edit.testRef ?? ""} onChange={(e) => setEdit({ ...edit, testRef: e.target.value })} /></div>
        <div className="col-span-2"><label className="label">Linked issue keys (comma separated)</label><input className="input" value={(edit.issueKeys ?? []).join(", ")} onChange={(e) => setEdit({ ...edit, issueKeys: e.target.value.toUpperCase().split(",").map((s) => s.trim()).filter(Boolean) })} placeholder={`${projectKey}-1, ${projectKey}-2`} /></div>
        <div className="col-span-2 flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setEdit(null)}>Cancel</button><button className="btn-primary">Save</button></div>
      </form>}
    </Modal>
  </>);
}
