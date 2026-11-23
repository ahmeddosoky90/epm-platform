import ExcelJS from "exceljs";
import { NextResponse } from "next/server";

export type Col = { header: string; key: string; width?: number; numFmt?: string };
const csvCell = (v: unknown) => {
  if (v === null || v === undefined) return "";
  let s = v instanceof Date ? v.toISOString() : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // CSV/formula injection guard
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function exportResponse(format: string, name: string, cols: Col[], rows: Record<string, unknown>[]) {
  const stamp = new Date().toISOString().slice(0, 10);
  if (format === "csv") {
    const csv = [cols.map((c) => csvCell(c.header)).join(","), ...rows.map((r) => cols.map((c) => csvCell(r[c.key])).join(","))].join("\r\n");
    return new NextResponse("﻿" + csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}-${stamp}.csv"` } });
  }
  const wb = new ExcelJS.Workbook(); wb.creator = "Lumen PMO"; wb.created = new Date();
  const ws = wb.addWorksheet(name.slice(0, 31));
  ws.columns = cols.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 16, style: c.numFmt ? { numFmt: c.numFmt } : {} }));
  ws.getRow(1).font = { bold: true }; ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
  rows.forEach((r) => ws.addRow(Object.fromEntries(cols.map((c) => [c.key, typeof r[c.key] === "string" && /^[=+\-@]/.test(r[c.key] as string) ? "'" + r[c.key] : r[c.key]]))));
  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(new Uint8Array(buf as ArrayBuffer), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${name}-${stamp}.xlsx"` } });
}
