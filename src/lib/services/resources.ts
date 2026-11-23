import { z } from "zod";
import { prisma } from "../db";
import { requirePermission, type Ctx } from "../auth";
import { audit } from "../audit";
import { badRequest, notFound } from "../errors";
import { capacityForPeriod, type Calendar } from "../calc/capacity";
import { projectScope } from "./access";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).transform((v) => new Date(v + "T00:00:00Z"));
const dec = z.union([z.number(), z.string()]).transform((v) => String(v)).refine((v) => /^\d+(\.\d{1,2})?$/.test(v), "Must be a non-negative amount");

export const resourceSchema = z.object({
  name: z.string().trim().min(2).max(120), userId: z.string().uuid().nullable().optional(), departmentId: z.string().uuid().nullable().optional(),
  jobTitle: z.string().max(80).nullable().optional(), grade: z.string().max(20).nullable().optional(), skills: z.array(z.string().trim().min(1).max(40)).max(30).default([]),
  employmentType: z.enum(["Employee", "Contractor", "Vendor"]).default("Employee"), hourlyRate: dec.optional(), dailyRate: dec.optional(),
  hoursPerWeek: dec.optional(), managerName: z.string().max(120).nullable().optional(),
});
export const allocationSchema = z.object({ projectId: z.string().uuid(), percent: z.number().int().min(1).max(200), startDate: day, endDate: day, role: z.string().max(60).optional() })
  .refine((a) => a.endDate >= a.startDate, { message: "End date is before start date", path: ["endDate"] });
export const leaveSchema = z.object({ startDate: day, endDate: day, reason: z.string().max(200).optional() }).refine((a) => a.endDate >= a.startDate, { message: "End date is before start date", path: ["endDate"] });

export async function workspaceCalendar(workspaceId: string): Promise<Calendar> {
  const ws = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId }, include: { holidays: true } });
  return { workingDays: ws.workingDays, hoursPerDay: Number(ws.hoursPerDay), holidays: ws.holidays.map((h) => h.date) };
}

/** Month buckets starting at the current month; utilisation per resource per month. */
export async function capacityGrid(ctx: Ctx, months = 6, filter: { departmentId?: string; skill?: string; q?: string } = {}) {
  requirePermission(ctx, "resource:view");
  const cal = await workspaceCalendar(ctx.workspaceId);
  const resources = await prisma.resource.findMany({
    where: { workspaceId: ctx.workspaceId, ...(filter.departmentId ? { departmentId: filter.departmentId } : {}), ...(filter.skill ? { skills: { has: filter.skill } } : {}), ...(filter.q ? { name: { contains: filter.q, mode: "insensitive" as const } } : {}) },
    include: { department: true, leaves: true, allocations: { include: { project: { select: { id: true, key: true, name: true, status: true, archivedAt: true } } }, orderBy: { startDate: "asc" } } },
    orderBy: { name: "asc" },
  });
  const now = new Date();
  const buckets = Array.from({ length: months }, (_, i) => {
    const s = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1));
    const e = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i + 1, 0));
    return { label: s.toLocaleString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" }), start: s, end: e };
  });
  const rows = resources.map((r) => {
    const leaves = r.leaves.map((l) => ({ start: l.startDate, end: l.endDate }));
    const active = r.allocations.filter((a) => !a.project.archivedAt && a.project.status !== "CANCELLED");
    const cells = buckets.map((b) => capacityForPeriod(b.start, b.end, cal, active, leaves));
    return { ...r, cells, overallocated: cells.some((c) => c.overallocated), currentUtil: cells[0]?.utilisation ?? 0 };
  });
  return { buckets: buckets.map((b) => b.label), rows };
}

export async function createResource(ctx: Ctx, b: z.infer<typeof resourceSchema>) {
  requirePermission(ctx, "resource:manage");
  if (b.departmentId && !(await prisma.department.findFirst({ where: { id: b.departmentId, workspaceId: ctx.workspaceId } }))) throw badRequest("Unknown department");
  if (b.userId && !(await prisma.workspaceMember.findFirst({ where: { userId: b.userId, workspaceId: ctx.workspaceId } }))) throw badRequest("User is not a workspace member");
  const r = await prisma.resource.create({ data: { ...b, workspaceId: ctx.workspaceId } });
  await audit({ workspaceId: ctx.workspaceId, userId: ctx.user.id, eventType: "resource.created", entityType: "Resource", entityId: r.id, after: { name: b.name }, ip: ctx.ip });
  return r;
}

async function loadResource(ctx: Ctx, id: string) {
  const r = await prisma.resource.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!r) throw notFound("Resource not found");
  return r;
}

export async function updateResource(ctx: Ctx, id: string, b: Partial<z.infer<typeof resourceSchema>>) {
  requirePermission(ctx, "resource:manage");
  const before = await loadResource(ctx, id);
  if (b.departmentId && !(await prisma.department.findFirst({ where: { id: b.departmentId, workspaceId: ctx.workspaceId } }))) throw badRequest("Unknown department");
  const touchesRate = b.hourlyRate !== undefined || b.dailyRate !== undefined;
  if (touchesRate) requirePermission(ctx, "finance:edit");
  const r = await prisma.resource.update({ where: { id }, data: b });
  await audit({ workspaceId: ctx.workspaceId, userId: ctx.user.id, eventType: touchesRate ? "resource.rate_changed" : "resource.updated", entityType: "Resource", entityId: id, before: { hourlyRate: before.hourlyRate, dailyRate: before.dailyRate }, after: b, ip: ctx.ip });
  return r;
}

/** Adds an allocation. Over-allocation is allowed but reported so the caller can warn (BRD 12.3). */
export async function addAllocation(ctx: Ctx, resourceId: string, a: z.infer<typeof allocationSchema>) {
  requirePermission(ctx, "resource:manage");
  await loadResource(ctx, resourceId);
  const p = await prisma.project.findFirst({ where: { AND: [projectScope(ctx), { id: a.projectId, archivedAt: null }] } });
  if (!p) throw badRequest("Unknown project");
  const alloc = await prisma.resourceAllocation.create({ data: { ...a, resourceId } });
  const cal = await workspaceCalendar(ctx.workspaceId);
  const r = await prisma.resource.findUniqueOrThrow({ where: { id: resourceId }, include: { allocations: true, leaves: true } });
  const cap = capacityForPeriod(a.startDate, a.endDate, cal, r.allocations, r.leaves.map((l) => ({ start: l.startDate, end: l.endDate })));
  await prisma.resourceAllocation.update({ where: { id: alloc.id }, data: { plannedHours: capacityForPeriod(a.startDate, a.endDate, cal, [a]).allocatedHours } });
  await audit({ workspaceId: ctx.workspaceId, userId: ctx.user.id, eventType: "resource.allocated", entityType: "Resource", entityId: resourceId, after: { projectKey: p.key, percent: a.percent, start: a.startDate, end: a.endDate, overallocated: cap.overallocated }, ip: ctx.ip });
  return { allocation: alloc, utilisation: cap.utilisation, overallocated: cap.overallocated };
}

export async function removeAllocation(ctx: Ctx, resourceId: string, allocationId: string) {
  requirePermission(ctx, "resource:manage");
  await loadResource(ctx, resourceId);
  const a = await prisma.resourceAllocation.findFirst({ where: { id: allocationId, resourceId } });
  if (!a) throw notFound("Allocation not found");
  await prisma.resourceAllocation.delete({ where: { id: a.id } });
  await audit({ workspaceId: ctx.workspaceId, userId: ctx.user.id, eventType: "resource.deallocated", entityType: "Resource", entityId: resourceId, before: { projectId: a.projectId, percent: a.percent }, ip: ctx.ip });
}

export async function addLeave(ctx: Ctx, resourceId: string, l: z.infer<typeof leaveSchema>) {
  const r = await loadResource(ctx, resourceId);
  // People may record their own leave; managing others' needs resource:manage
  if (r.userId !== ctx.user.id) requirePermission(ctx, "resource:manage");
  const lv = await prisma.resourceLeave.create({ data: { ...l, resourceId } });
  await audit({ workspaceId: ctx.workspaceId, userId: ctx.user.id, eventType: "resource.leave_added", entityType: "Resource", entityId: resourceId, after: l, ip: ctx.ip });
  return lv;
}
