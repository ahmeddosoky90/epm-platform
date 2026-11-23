"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Download } from "lucide-react";
import { apiFetch } from "@/lib/client";
import { useToast } from "@/components/ui/toast";
import { Modal } from "@/components/ui/modal";
import { Card, Chip } from "@/components/ui/bits";
import { money } from "@/lib/format";

/* eslint-disable @typescript-eslint/no-explicit-any */
const CATS = ["Labor", "Software", "Hardware", "Services", "Training", "Travel", "Facilities", "Contingency", "Other"];

/** Spreadsheet-style budget sheet: inline-editable cells, saved per row, totals computed client-side for display only (server is authoritative). */
export function BudgetSheet({ projectId, currency, canEdit, lines, transactions }: { projectId: string; currency: string; canEdit: boolean; lines: any[]; transactions: any[] }) {
  const [rows, setRows] = useState<any[]>(lines.map((l) => ({ ...l, _dirty: false })));
  const [txOpen, setTxOpen] = useState(false); const [tx, setTx] = useState<Record<string, string>>({ kind: "ACTUAL", expenseType: "CAPEX", category: "Software", currency, txDate: new Date().toISOString().slice(0, 10) });
  const toast = useToast(); const router = useRouter();
  const actualByLine = useMemo(() => { const m: Record<string, number> = {}; for (const t of transactions) if (t.kind === "ACTUAL") { const k = `${t.category}|${t.expenseType}`; m[k] = (m[k] ?? 0) + Number(t.amountBase); } return m; }, [transactions]);
  const set = (i: number, k: string, v: string) => setRows(rows.map((r, j) => j === i ? { ...r, [k]: v, _dirty: true } : r));
  const saveRow = async (i: number) => { const r = rows[i]; try { const saved = await apiFetch<any>(`/api/projects/${projectId}/budget`, { method: "POST", json: { id: r.id, category: r.category, expenseType: r.expenseType, costCenter: r.costCenter || null, vendor: r.vendor || null, fiscalYear: Number(r.fiscalYear), proposed: String(r.proposed || 0), approved: String(r.approved || 0), forecast: String(r.forecast || 0), notes: r.notes || null } });
    setRows(rows.map((x, j) => j === i ? { ...saved, _dirty: false } : x)); toast.ok("Saved"); router.refresh(); } catch (e) { toast.err(e); } };
  const del = async (i: number) => { const r = rows[i]; if (!r.id) return setRows(rows.filter((_, j) => j !== i)); try { await apiFetch(`/api/projects/${projectId}/budget?lineId=${r.id}`, { method: "DELETE" }); setRows(rows.filter((_, j) => j !== i)); toast.ok("Line deleted"); router.refresh(); } catch (e) { toast.err(e); } };
  const tot = (k: string) => rows.reduce((a, r) => a + Number(r[k] || 0), 0);
  const totActual = rows.reduce((a, r) => a + (actualByLine[`${r.category}|${r.expenseType}`] ?? 0), 0);
  const M = (v: number) => money(v, currency);
  const cell = "input !h-8 !rounded-md !px-2 text-end tabular-nums";
  return (<>
    <Card title="Budget sheet" action={<div className="flex gap-2"><a className="btn-secondary btn-sm" href={`/api/export/budget?projectId=${projectId}&format=xlsx`}><Download className="h-3.5 w-3.5" />Excel</a>{canEdit && <button className="btn-secondary btn-sm" onClick={() => setRows([...rows, { category: "Other", expenseType: "OPEX", fiscalYear: new Date().getFullYear(), proposed: "0", approved: "0", forecast: "0", _dirty: true }])}><Plus className="h-3.5 w-3.5" />Add line</button>}</div>} pad={false}>
      <div className="overflow-x-auto"><table className="table">
        <thead><tr><th>FY</th><th>Category</th><th>Type</th><th>Cost centre</th><th>Vendor</th><th className="text-end">Proposed</th><th className="text-end">Approved</th><th className="text-end">Forecast (EAC)</th><th className="text-end">Actual</th><th className="text-end">Variance</th><th /></tr></thead>
        <tbody>{rows.map((r, i) => { const actual = actualByLine[`${r.category}|${r.expenseType}`] ?? 0; const variance = Number(r.approved || 0) - Number(r.forecast || 0);
          return <tr key={r.id ?? `n${i}`} className={r._dirty ? "bg-accent/5" : ""}>
            <td><input disabled={!canEdit} className={`${cell} !w-20`} type="number" value={r.fiscalYear} onChange={(e) => set(i, "fiscalYear", e.target.value)} aria-label="Fiscal year" /></td>
            <td><select disabled={!canEdit} className="input !h-8 !w-32" value={r.category} onChange={(e) => set(i, "category", e.target.value)} aria-label="Category">{[...new Set([...CATS, r.category])].map((c) => <option key={c}>{c}</option>)}</select></td>
            <td><select disabled={!canEdit} className="input !h-8 !w-24" value={r.expenseType} onChange={(e) => set(i, "expenseType", e.target.value)} aria-label="Expense type"><option>CAPEX</option><option>OPEX</option></select></td>
            <td><input disabled={!canEdit} className="input !h-8 !w-24" value={r.costCenter ?? ""} onChange={(e) => set(i, "costCenter", e.target.value)} aria-label="Cost centre" /></td>
            <td><input disabled={!canEdit} className="input !h-8 !w-28" value={r.vendor ?? ""} onChange={(e) => set(i, "vendor", e.target.value)} aria-label="Vendor" /></td>
            {(["proposed", "approved", "forecast"] as const).map((k) => <td key={k}><input disabled={!canEdit} className={`${cell} !w-32`} inputMode="decimal" value={r[k]} onChange={(e) => set(i, k, e.target.value)} aria-label={k} /></td>)}
            <td className="text-end tabular-nums text-xs">{M(actual)}</td>
            <td className={`text-end tabular-nums text-xs ${variance < 0 ? "text-[#ff3b30]" : "text-[#34c759]"}`}>{M(variance)}</td>
            <td className="whitespace-nowrap">{canEdit && r._dirty && <button className="btn-primary btn-sm me-1" onClick={() => saveRow(i)}>Save</button>}{canEdit && <button aria-label="Delete line" className="btn-ghost btn-sm !px-2 text-[#ff3b30]" onClick={() => del(i)}><Trash2 className="h-3.5 w-3.5" /></button>}</td>
          </tr>; })}
          <tr className="font-semibold"><td colSpan={5}>Total</td><td className="text-end tabular-nums text-xs">{M(tot("proposed"))}</td><td className="text-end tabular-nums text-xs">{M(tot("approved"))}</td><td className="text-end tabular-nums text-xs">{M(tot("forecast"))}</td><td className="text-end tabular-nums text-xs">{M(totActual)}</td><td className={`text-end tabular-nums text-xs ${tot("approved") - tot("forecast") < 0 ? "text-[#ff3b30]" : ""}`}>{M(tot("approved") - tot("forecast"))}</td><td /></tr>
        </tbody></table></div>
      {rows.some((r) => r._dirty) && <p className="text-xs text-[#ff9f0a] px-4 py-2">Unsaved rows are highlighted. Save each row to persist it.</p>}
    </Card>
    <Card title={`Transactions (${transactions.length})`} action={canEdit && <button className="btn-secondary btn-sm" onClick={() => setTxOpen(true)}><Plus className="h-3.5 w-3.5" />Record transaction</button>} pad={false}>
      <div className="overflow-x-auto max-h-[420px]"><table className="table"><thead className="sticky top-0 bg-surface"><tr><th>Date</th><th>Kind</th><th>Type</th><th>Category</th><th>Vendor</th><th>Reference</th><th className="text-end">Amount</th><th className="text-end">In {currency}</th></tr></thead>
        <tbody>{transactions.map((t) => <tr key={t.id}><td className="text-xs">{t.txDate.slice(0, 10)}</td><td><Chip color={t.kind === "ACTUAL" ? "#0a84ff" : "#ff9f0a"}>{t.kind}</Chip></td><td className="text-xs">{t.expenseType}</td><td className="text-xs">{t.category}</td><td className="text-xs">{t.vendor}</td><td className="text-xs muted">{t.reference}</td><td className="text-end text-xs tabular-nums">{money(t.amount, t.currency)}</td><td className="text-end text-xs tabular-nums">{M(Number(t.amountBase))}</td></tr>)}</tbody></table></div>
    </Card>
    <Modal open={txOpen} onClose={() => setTxOpen(false)} title="Record transaction">
      <form className="grid grid-cols-2 gap-3" onSubmit={async (e) => { e.preventDefault(); try { await apiFetch(`/api/projects/${projectId}/transactions`, { method: "POST", json: tx }); toast.ok("Transaction recorded"); setTxOpen(false); router.refresh(); } catch (x) { toast.err(x); } }}>
        <div><label className="label">Kind</label><select className="input" value={tx.kind} onChange={(e) => setTx({ ...tx, kind: e.target.value })}><option value="ACTUAL">Actual (invoice / payment)</option><option value="COMMITTED">Committed (PO)</option></select></div>
        <div><label className="label">Expense type</label><select className="input" value={tx.expenseType} onChange={(e) => setTx({ ...tx, expenseType: e.target.value })}><option>CAPEX</option><option>OPEX</option></select></div>
        <div><label className="label">Category</label><select className="input" value={tx.category} onChange={(e) => setTx({ ...tx, category: e.target.value })}>{CATS.map((c) => <option key={c}>{c}</option>)}</select></div>
        <div><label className="label">Date</label><input type="date" className="input" value={tx.txDate} onChange={(e) => setTx({ ...tx, txDate: e.target.value })} /></div>
        <div><label className="label">Amount *</label><input required className="input" inputMode="decimal" pattern="\d+(\.\d{1,2})?" value={tx.amount ?? ""} onChange={(e) => setTx({ ...tx, amount: e.target.value })} /></div>
        <div><label className="label">Currency</label><input className="input uppercase" maxLength={3} value={tx.currency} onChange={(e) => setTx({ ...tx, currency: e.target.value.toUpperCase() })} /></div>
        <div><label className="label">Vendor</label><input className="input" value={tx.vendor ?? ""} onChange={(e) => setTx({ ...tx, vendor: e.target.value })} /></div>
        <div><label className="label">Reference (invoice/PO)</label><input className="input" value={tx.reference ?? ""} onChange={(e) => setTx({ ...tx, reference: e.target.value })} /></div>
        <div className="col-span-2"><label className="label">Description</label><input className="input" value={tx.description ?? ""} onChange={(e) => setTx({ ...tx, description: e.target.value })} /></div>
        <p className="col-span-2 text-xs muted">Foreign-currency amounts are converted with the latest exchange rate on or before the transaction date.</p>
        <div className="col-span-2 flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setTxOpen(false)}>Cancel</button><button className="btn-primary">Record</button></div>
      </form>
    </Modal>
  </>);
}
