import { z } from "zod";
import { prisma } from "@/lib/db";
import { api, body } from "@/lib/api";
import { audit } from "@/lib/audit";
import { AppError } from "@/lib/errors";
import { hashPassword, validatePassword, verifyPassword } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

/** PUT {current, next}: change own password. Other sessions are signed out. */
export const PUT = api(async (req, ctx) => {
  if (!rateLimit(`pw:${ctx.user.id}`, 5, 15 * 60_000)) throw new AppError(429, "RATE_LIMITED", "Too many attempts, try again later");
  const b = await body(req, z.object({ current: z.string().max(200), next: z.string().max(200) }));
  const u = await prisma.user.findUniqueOrThrow({ where: { id: ctx.user.id } });
  if (!(await verifyPassword(b.current, u.passwordHash))) throw new AppError(400, "BAD_PASSWORD", "Current password is incorrect");
  const errs = validatePassword(b.next);
  if (errs.length) throw new AppError(422, "WEAK_PASSWORD", `Password needs: ${errs.join(", ")}`);
  if (await verifyPassword(b.next, u.passwordHash)) throw new AppError(422, "SAME_PASSWORD", "Choose a password you have not just used");
  await prisma.$transaction([
    prisma.user.update({ where: { id: u.id }, data: { passwordHash: await hashPassword(b.next), passwordChangedAt: new Date() } }),
    prisma.session.deleteMany({ where: { userId: u.id, id: { not: ctx.sessionId } } }),
  ]);
  await audit({ workspaceId: ctx.workspaceId, userId: u.id, eventType: "auth.password_changed", entityType: "User", entityId: u.id, ip: ctx.ip });
  return { ok: true };
});
