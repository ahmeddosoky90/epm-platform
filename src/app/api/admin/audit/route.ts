import { api } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { auditQuery } from "@/lib/services/admin";
import { exportResponse } from "@/lib/export";

export const GET = api(async (req, ctx) => {
  const sp = req.nextUrl.searchParams;
  const f = { q: sp.get("q") ?? undefined, eventType: sp.get("eventType") ?? undefined, userId: sp.get("userId") ?? undefined, entityType: sp.get("entityType") ?? undefined, from: sp.get("from") ?? undefined, to: sp.get("to") ?? undefined, page: Number(sp.get("page") ?? 1) };
  const format = sp.get("format");
  if (format === "csv" || format === "xlsx") {
    requirePermission(ctx, "report:export");
    const rows: Record<string, unknown>[] = []; let page = 1;
    for (;;) { const r = await auditQuery(ctx, { ...f, page }); rows.push(...r.items.map((i) => ({ time: i.createdAt.toISOString(), user: r.users[i.userId ?? ""] ?? i.userId ?? "system", event: i.eventType, entity: i.entityType, entityId: i.entityId, ip: i.ip, before: JSON.stringify(i.before ?? null), after: JSON.stringify(i.after ?? null) }))); if (page * 50 >= r.total || page >= 200) break; page++; }
    await audit({ workspaceId: ctx.workspaceId, userId: ctx.user.id, eventType: "audit.exported", entityType: "AuditLog", after: { ...f, rows: rows.length }, ip: ctx.ip });
    return exportResponse(format, "audit-log", [{ key: "time", header: "Time (UTC)" }, { key: "user", header: "User" }, { key: "event", header: "Event" }, { key: "entity", header: "Entity" }, { key: "entityId", header: "Entity ID" }, { key: "ip", header: "IP" }, { key: "before", header: "Before" }, { key: "after", header: "After" }], rows);
  }
  return auditQuery(ctx, f);
});
