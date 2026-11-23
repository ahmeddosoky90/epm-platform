import { requireCtx, pagePermission } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ConfigTable } from "@/components/admin/config-table";
import { WorkspaceSettings } from "@/components/admin/workspace-settings";

export default async function WorkspaceAdmin() {
  const ctx = await requireCtx(); pagePermission(ctx, "admin:workspace");
  const [ws, holidays, rates, depts] = await Promise.all([
    prisma.workspace.findUniqueOrThrow({ where: { id: ctx.workspaceId } }),
    prisma.holiday.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { date: "asc" } }),
    prisma.exchangeRate.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: [{ currency: "asc" }, { effectiveDate: "desc" }] }),
    prisma.department.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { name: "asc" } }),
  ]);
  const J = <T,>(x: T) => JSON.parse(JSON.stringify(x));
  return (<>
    <WorkspaceSettings ws={J({ name: ws.name, description: ws.description, timezone: ws.timezone, currency: ws.currency, fiscalYearStartMonth: ws.fiscalYearStartMonth, workingDays: ws.workingDays, hoursPerDay: Number(ws.hoursPerDay) })} />
    <div className="grid lg:grid-cols-2 gap-4 mt-4">
      <ConfigTable entity="holiday" title="Holidays" note="Excluded from capacity and schedule calculations" rows={J(holidays)} canUpdate={false} fields={[{ key: "date", label: "Date", type: "date", required: true }, { key: "name", label: "Name", required: true }]} />
      <ConfigTable entity="exchangeRate" title="Exchange rates" note={`Units of ${ws.currency} per 1 unit of currency, effective from the date`} rows={J(rates.map((r) => ({ ...r, rateToBase: r.rateToBase.toString() })))} canUpdate={false} fields={[{ key: "currency", label: "Currency", required: true, hint: "ISO code, e.g. USD" }, { key: "rateToBase", label: "Rate", required: true }, { key: "effectiveDate", label: "Effective", type: "date", required: true }]} />
    </div>
    <ConfigTable entity="department" title="Departments" rows={J(depts)} fields={[{ key: "name", label: "Name", required: true }, { key: "costCenter", label: "Cost centre" }]} />
  </>);
}
