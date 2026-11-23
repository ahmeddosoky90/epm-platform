import { z } from "zod";
import { prisma } from "@/lib/db";
import { api, body } from "@/lib/api";
import { audit } from "@/lib/audit";

export const PATCH = api(async (req, ctx) => {
  const b = await body(req, z.object({ name: z.string().trim().min(2).max(120).optional(), jobTitle: z.string().max(80).nullable().optional(), locale: z.enum(["en", "ar"]).optional() }));
  const u = await prisma.user.update({ where: { id: ctx.user.id }, data: b, select: { id: true, name: true, jobTitle: true, locale: true } });
  await audit({ workspaceId: ctx.workspaceId, userId: ctx.user.id, eventType: "user.profile_updated", entityType: "User", entityId: ctx.user.id, after: b, ip: ctx.ip });
  return u;
});
/** DELETE: sign out every other session. */
export const DELETE = api(async (_r, ctx) => {
  const r = await prisma.session.deleteMany({ where: { userId: ctx.user.id, id: { not: ctx.sessionId } } });
  await audit({ workspaceId: ctx.workspaceId, userId: ctx.user.id, eventType: "auth.sessions_revoked", entityType: "User", entityId: ctx.user.id, after: { count: r.count }, ip: ctx.ip });
  return { revoked: r.count };
});
