import { z } from "zod";
import { prisma } from "@/lib/db";
import { api, body } from "@/lib/api";

export const GET = api(async (req, ctx) => {
  const unread = req.nextUrl.searchParams.get("unread") === "1";
  const [items, count] = await Promise.all([
    prisma.notification.findMany({ where: { userId: ctx.user.id, ...(unread ? { readAt: null } : {}) }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.notification.count({ where: { userId: ctx.user.id, readAt: null } }),
  ]);
  return { items, unread: count };
});
/** PATCH { ids: [...] } or { all: true } marks read; { ids, unread: true } marks unread. */
export const PATCH = api(async (req, ctx) => {
  const b = await body(req, z.object({ ids: z.array(z.string().uuid()).max(500).optional(), all: z.boolean().optional(), unread: z.boolean().optional() }));
  const r = await prisma.notification.updateMany({ where: { userId: ctx.user.id, ...(b.all ? {} : { id: { in: b.ids ?? [] } }) }, data: { readAt: b.unread ? null : new Date() } });
  return { updated: r.count };
});
