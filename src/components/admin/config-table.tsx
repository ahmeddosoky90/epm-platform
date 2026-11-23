"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Modal, Confirm } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/client";

export type Field = { key: string; label: string; type?: "text" | "number" | "date" | "checkbox" | "color" | "select" | "list" | "multiselect"; options?: { value: string; label: string }[]; required?: boolean; createOnly?: boolean; hint?: string };
type Row = Record<string, unknown> & { id: string };

const show = (f: Field, v: unknown) => {
  if (v == null || v === "") return "—";
  if (f.type === "checkbox") return v ? "Yes" : "No";
  if (f.type === "color") return <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full" style={{ background: String(v) }} />{String(v)}</span>;
  if (f.type === "date") return String(v).slice(0, 10);
  if (Array.isArray(v)) return v.map((x) => f.options?.find((o) => o.value === x)?.label ?? String(x)).join(", ") || "—";
  if (f.type === "select") return f.options?.find((o) => o.value === String(v))?.label ?? String(v);
  return String(v);
};

/** Generic editor for the small admin lists; all writes go through POST /api/admin/config. */
export function ConfigTable({ entity, title, rows, fields, canUpdate = true, lockedKey, note }: { entity: string; title: string; rows: Row[]; fields: Field[]; canUpdate?: boolean; lockedKey?: string; note?: string }) {
  const [edit, setEdit] = useState<Partial<Row> | null>(null); const [del, setDel] = useState<Row | null>(null);
  const toast = useToast(); const router = useRouter();
  const send = async (json: Record<string, unknown>, msg: string) => { try { await apiFetch("/api/admin/config", { method: "POST", json: { entity, ...json } }); toast.ok(msg); router.refresh(); return true; } catch (e) { toast.err(e); return false; } };
  return (
    <section className="card mb-4">
      <div className="flex items-center justify-between px-4 pt-4 pb-2"><div><h2 className="font-semibold text-sm">{title}</h2>{note && <p className="text-xs muted">{note}</p>}</div><button className="btn-secondary btn-sm" onClick={() => setEdit({})}><Plus className="h-3.5 w-3.5" />Add</button></div>
      {rows.length ? <table className="table"><thead><tr>{fields.map((f) => <th key={f.key}>{f.label}</th>)}<th /></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.id}>{fields.map((f) => <td key={f.key} className="text-sm">{show(f, r[f.key])}</td>)}
          <td className="text-end whitespace-nowrap">{canUpdate && <button className="btn-ghost btn-sm !px-1.5" aria-label="Edit" onClick={() => setEdit(r)}><Pencil className="h-3.5 w-3.5" /></button>}{!(lockedKey && r[lockedKey]) && <button className="btn-ghost btn-sm !px-1.5" aria-label="Delete" onClick={() => setDel(r)}><Trash2 className="h-3.5 w-3.5" /></button>}</td></tr>)}</tbody></table>
        : <p className="px-4 pb-4 text-sm muted">Nothing configured yet.</p>}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={`${edit?.id ? "Edit" : "Add"} ${title.toLowerCase().replace(/s$/, "")}`}>
        {edit && <form className="space-y-3" onSubmit={async (e) => {
          e.preventDefault();
          const data: Record<string, unknown> = {};
          for (const f of fields) { if (edit.id && f.createOnly) continue; const v = edit[f.key]; if (v === undefined) continue; data[f.key] = f.type === "number" ? (v === "" || v === null ? null : Number(v)) : v; }
          if (await send({ action: edit.id ? "update" : "create", id: edit.id, ...data }, "Saved")) setEdit(null);
        }}>
          {fields.map((f) => {
            const v = edit[f.key]; const set = (x: unknown) => setEdit({ ...edit, [f.key]: x }); const dis = !!edit.id && f.createOnly;
            return <div key={f.key}>
              {f.type === "checkbox" ? <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!v} onChange={(e) => set(e.target.checked)} disabled={dis} />{f.label}</label> : <>
                <label className="label">{f.label}{f.required && " *"}</label>
                {f.type === "select" ? <select className="input" required={f.required} disabled={dis} value={String(v ?? "")} onChange={(e) => set(e.target.value)}><option value="">—</option>{f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
                  : f.type === "multiselect" ? <div className="flex flex-wrap gap-2">{f.options?.map((o) => { const arr = (v as string[] | undefined) ?? []; return <label key={o.value} className="chip cursor-pointer"><input type="checkbox" className="me-1" checked={arr.includes(o.value)} onChange={(e) => set(e.target.checked ? [...arr, o.value] : arr.filter((x) => x !== o.value))} />{o.label}</label>; })}</div>
                  : f.type === "list" ? <textarea className="input" rows={3} value={((v as string[] | undefined) ?? []).join("\n")} onChange={(e) => set(e.target.value.split("\n").map((s) => s.trim()).filter(Boolean))} />
                  : <input className="input" type={f.type === "number" ? "number" : f.type === "date" ? "date" : f.type === "color" ? "color" : "text"} step="any" required={f.required} disabled={dis} value={f.type === "date" ? String(v ?? "").slice(0, 10) : String(v ?? "")} onChange={(e) => set(e.target.value)} />}
              </>}
              {f.hint && <p className="text-[11px] muted mt-0.5">{f.hint}</p>}
            </div>;
          })}
          <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setEdit(null)}>Cancel</button><button className="btn-primary">Save</button></div>
        </form>}
      </Modal>
      <Confirm open={!!del} title="Delete?" body="This change is recorded in the audit log. Items still in use cannot be deleted." danger onCancel={() => setDel(null)} onConfirm={async () => { const r = del!; setDel(null); await send({ action: "delete", id: r.id }, "Deleted"); }} />
    </section>
  );
}
