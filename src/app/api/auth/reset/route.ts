import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { randomToken, sha256 } from "@/lib/crypto";
import { checkOrigin, errorResponse } from "@/lib/api";
import { hashPassword, validatePassword } from "@/lib/auth";
import { mailConfigured, sendMail } from "@/lib/integrations/mail";
import { rateLimit } from "@/lib/rate-limit";
import { AppError } from "@/lib/errors";
import { audit } from "@/lib/audit";

/** POST {email}: request reset (always 200 to avoid account enumeration). Email is sent if SMTP configured. */
export async function POST(req: NextRequest) {
  try {
    checkOrigin(req);
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    if (!rateLimit(`reset:${ip}`, 5, 15 * 60_000)) throw new AppError(429, "RATE_LIMITED", "Too many requests");
    const { email } = z.object({ email: z.string().email() }).parse(await req.json());
    const u = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (u && u.isActive) {
      const token = randomToken();
      await prisma.passwordResetToken.create({ data: { id: sha256(token), userId: u.id, expiresAt: new Date(Date.now() + 30 * 60_000) } });
      const link = `${process.env.APP_URL ?? ""}/reset?token=${token}`;
      if (mailConfigured()) await sendMail({ to: u.email, subject: "Reset your Lumen PMO password", text: `Use this link within 30 minutes: ${link}` });
      else console.warn(`[reset] SMTP not configured; an administrator can issue a reset link from Administration → Users.`);
    }
    return NextResponse.json({ data: { ok: true, emailEnabled: mailConfigured() } });
  } catch (e) { return errorResponse(e); }
}

/** PATCH {token, password}: complete reset. */
export async function PATCH(req: NextRequest) {
  try {
    checkOrigin(req);
    const { token, password } = z.object({ token: z.string().min(20), password: z.string().max(200) }).parse(await req.json());
    const rec = await prisma.passwordResetToken.findUnique({ where: { id: sha256(token) } });
    if (!rec || rec.usedAt || rec.expiresAt < new Date()) throw new AppError(400, "BAD_TOKEN", "This reset link is invalid or has expired");
    const errs = validatePassword(password);
    if (errs.length) throw new AppError(422, "WEAK_PASSWORD", `Password needs: ${errs.join(", ")}`);
    await prisma.$transaction([
      prisma.user.update({ where: { id: rec.userId }, data: { passwordHash: await hashPassword(password), passwordChangedAt: new Date(), failedLogins: 0, lockedUntil: null } }),
      prisma.passwordResetToken.update({ where: { id: rec.id }, data: { usedAt: new Date() } }),
      prisma.session.deleteMany({ where: { userId: rec.userId } }),
    ]);
    await audit({ userId: rec.userId, eventType: "auth.password_reset", entityType: "User", entityId: rec.userId });
    return NextResponse.json({ data: { ok: true } });
  } catch (e) { return errorResponse(e); }
}
