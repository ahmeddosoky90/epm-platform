"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/client";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
type WS = { name: string; description: string | null; timezone: string; currency: string; fiscalYearStartMonth: number; workingDays: number[]; hoursPerDay: number };
export function WorkspaceSettings({ ws }: { ws: WS }) {
  const [f, setF] = useState(ws); const toast = useToast(); const router = useRouter();
  return (
    <form className="card p-4 grid md:grid-cols-3 gap-3" onSubmit={async (e) => { e.preventDefault(); try { await apiFetch("/api/admin/settings", { method: "PATCH", json: { ...f, hoursPerDay: Number(f.hoursPerDay) } }); toast.ok("Settings saved"); router.refresh(); } catch (x) { toast.err(x); } }}>
      <div><label className="label">Workspace name</label><input className="input" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
      <div><label className="label">Time zone</label><input className="input" required value={f.timezone} onChange={(e) => setF({ ...f, timezone: e.target.value })} placeholder="Africa/Cairo" /></div>
      <div><label className="label">Base currency</label><input className="input" required maxLength={3} value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value.toUpperCase() })} /><p className="text-[11px] muted mt-0.5">Changing this does not convert existing amounts.</p></div>
      <div><label className="label">Fiscal year starts</label><select className="input" value={f.fiscalYearStartMonth} onChange={(e) => setF({ ...f, fiscalYearStartMonth: Number(e.target.value) })}>{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select></div>
      <div><label className="label">Hours per working day</label><input className="input" type="number" min={1} max={24} step={0.5} value={f.hoursPerDay} onChange={(e) => setF({ ...f, hoursPerDay: Number(e.target.value) })} /></div>
      <div><span className="label">Working days</span><div className="flex flex-wrap gap-1">{DAYS.map((d, i) => <label key={d} className={`chip cursor-pointer ${f.workingDays.includes(i) ? "!bg-accent !text-white" : ""}`}><input type="checkbox" className="sr-only" checked={f.workingDays.includes(i)} onChange={(e) => setF({ ...f, workingDays: e.target.checked ? [...f.workingDays, i].sort() : f.workingDays.filter((x) => x !== i) })} />{d}</label>)}</div></div>
      <div className="md:col-span-3"><label className="label">Description</label><input className="input" value={f.description ?? ""} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
      <div className="md:col-span-3 flex justify-end"><button className="btn-primary">Save settings</button></div>
    </form>
  );
}
