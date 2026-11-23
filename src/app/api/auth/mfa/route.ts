import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { authenticator } from "otplib";
import { prisma } from "@/lib/db";
import { sha256, encryptSecret, decryptSecret } from "@/lib/crypto";
import { SESSION_COOKIE, requireCtx } from "@/lib/auth";
import { checkOrigin, errorResponse } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { audit } from "@/lib/audit";

/** POST {code}: complete MFA for a pending session. */
export async function POST(req: NextRequest) {
  try {
    checkOrigin(req);
    const { code } = z.object({ code: z.string().regex(/^\d{6}$/) }).parse(await req.json());
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    const s = token ? await prisma.session.findUnique({ where: { id: sha256(token) }, include: { user: true } }) : null;
    if (!s || !s.mfaPending || !s.user.mfaSecret) throw new AppError(400, "NO_MFA", "No pending MFA challenge");
    if (!authenticator.check(code, decryptSecret(s.user.mfaSecret))) throw new AppError(401, "BAD_CODE", "Invalid code");
    await prisma.session.update({ where: { id: s.id }, data: { mfaPending: false } });
    await audit({ workspaceId: s.workspaceId, userId: s.userId, eventType: "auth.login", entityType: "User", entityId: s.userId, after: { mfa: true } });
    return NextResponse.json({ data: { ok: true } });
  } catch (e) { return errorResponse(e); }
}

/** PUT: begin enrolment (returns otpauth URI). PATCH {code}: confirm & enable. DELETE: disable. */
export async function PUT() {
  try {
    const ctx = await requireCtx();
    const secret = authenticator.generateSecret();
    await prisma.user.update({ where: { id: ctx.user.id }, data: { mfaSecret: encryptSecret(secret), mfaEnabled: false } });
    return NextResponse.json({ data: { secret, uri: authenticator.keyuri(ctx.user.email, "Lumen PMO", secret) } });
  } catch (e) { return errorResponse(e); }
}
export async function PATCH(req: NextRequest) {
  try {
    checkOrigin(req);
    const ctx = await requireCtx();
    const { code } = z.object({ code: z.string().regex(/^\d{6}$/) }).parse(await req.json());
    const u = await prisma.user.findUniqueOrThrow({ where: { id: ctx.user.id } });
    if (!u.mfaSecret || !authenticator.check(code, decryptSecret(u.mfaSecret))) throw new AppError(401, "BAD_CODE", "Invalid code");
    await prisma.user.update({ where: { id: u.id }, data: { mfaEnabled: true } });
    await audit({ workspaceId: ctx.workspaceId, userId: u.id, eventType: "auth.mfa_enabled", entityType: "User", entityId: u.id });
    return NextResponse.json({ data: { ok: true } });
  } catch (e) { return errorResponse(e); }
}
export async function DELETE(req: NextRequest) {
  try {
    checkOrigin(req);
    const ctx = await requireCtx();
    await prisma.user.update({ where: { id: ctx.user.id }, data: { mfaEnabled: false, mfaSecret: null } });
    await audit({ workspaceId: ctx.workspaceId, userId: ctx.user.id, eventType: "auth.mfa_disabled", entityType: "User", entityId: ctx.user.id });
    return NextResponse.json({ data: { ok: true } });
  } catch (e) { return errorResponse(e); }
}
