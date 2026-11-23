import { redirect } from "next/navigation";
import "server-only";
import bcrypt from "bcryptjs";
import { cookies, headers } from "next/headers";
import { prisma } from "./db";
import { randomToken, sha256 } from "./crypto";
import { AppError, forbidden, unauthorized } from "./errors";
import { hasPermission, type Permission } from "./rbac/permissions";
import { audit } from "./audit";

export const SESSION_COOKIE = "epm_session";
const TTL_HOURS = Number(process.env.SESSION_TTL_HOURS ?? 12);
const IDLE_MINUTES = Number(process.env.SESSION_IDLE_MINUTES ?? 60);
export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_MINUTES = 15;

export interface PasswordPolicy { minLength: number; requireUpper: boolean; requireLower: boolean; requireDigit: boolean; requireSymbol: boolean }
export const PASSWORD_POLICY: PasswordPolicy = {
  minLength: Number(process.env.PASSWORD_MIN_LENGTH ?? 10),
  requireUpper: true, requireLower: true, requireDigit: true, requireSymbol: true,
};

export function validatePassword(pw: string, policy = PASSWORD_POLICY): string[] {
  const errs: string[] = [];
  if (pw.length < policy.minLength) errs.push(`At least ${policy.minLength} characters`);
  if (policy.requireUpper && !/[A-Z]/.test(pw)) errs.push("An uppercase letter");
  if (policy.requireLower && !/[a-z]/.test(pw)) errs.push("A lowercase letter");
  if (policy.requireDigit && !/\d/.test(pw)) errs.push("A digit");
  if (policy.requireSymbol && !/[^A-Za-z0-9]/.test(pw)) errs.push("A symbol");
  return errs;
}

export const hashPassword = (pw: string) => bcrypt.hash(pw, 12);
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);

export async function createSession(userId: string, workspaceId: string | null, mfaPending: boolean) {
  const token = randomToken();
  const h = await headers();
  await prisma.session.create({
    data: {
      id: sha256(token), userId, workspaceId, mfaPending,
      ip: h.get("x-forwarded-for")?.split(",")[0] ?? null,
      userAgent: h.get("user-agent")?.slice(0, 300) ?? null,
      expiresAt: new Date(Date.now() + TTL_HOURS * 3600_000),
    },
  });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true, sameSite: "lax", path: "/",
    secure: process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "false",
    maxAge: TTL_HOURS * 3600,
  });
  return token;
}

export async function destroySession() {
  const c = await cookies();
  const token = c.get(SESSION_COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { id: sha256(token) } });
  c.delete(SESSION_COOKIE);
}

export interface Ctx {
  user: { id: string; name: string; email: string; isPlatformAdmin: boolean; avatarUrl: string | null; locale: string };
  sessionId: string;
  workspaceId: string;
  workspace: { id: string; name: string; currency: string; timezone: string; locale: string };
  roleKey: string;
  roleName: string;
  permissions: string[];
  ip: string | null;
  userAgent: string | null;
}

/** Resolve session from cookie; returns null if not signed in (or session expired/idle). */
export async function getCtx(): Promise<Ctx | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const s = await prisma.session.findUnique({ where: { id: sha256(token) }, include: { user: true } });
  if (!s || s.mfaPending || !s.user.isActive) return null;
  const now = Date.now();
  if (s.expiresAt.getTime() < now || now - s.lastSeenAt.getTime() > IDLE_MINUTES * 60_000) {
    await prisma.session.delete({ where: { id: s.id } }).catch(() => {});
    return null;
  }
  // Resolve workspace: the session's selection, else the user's first membership.
  let member = s.workspaceId
    ? await prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId: s.workspaceId, userId: s.userId } }, include: { role: true, workspace: true } })
    : null;
  if (!member) member = await prisma.workspaceMember.findFirst({ where: { userId: s.userId }, include: { role: true, workspace: true }, orderBy: { createdAt: "asc" } });
  if (!member) return null;
  if (now - s.lastSeenAt.getTime() > 60_000 || s.workspaceId !== member.workspaceId) {
    await prisma.session.update({ where: { id: s.id }, data: { lastSeenAt: new Date(), workspaceId: member.workspaceId } });
  }
  const h = await headers();
  const perms = s.user.isPlatformAdmin ? ["*"] : member.role.permissions;
  return {
    user: { id: s.user.id, name: s.user.name, email: s.user.email, isPlatformAdmin: s.user.isPlatformAdmin, avatarUrl: s.user.avatarUrl, locale: s.user.locale },
    sessionId: s.id,
    workspaceId: member.workspaceId,
    workspace: { id: member.workspace.id, name: member.workspace.name, currency: member.workspace.currency, timezone: member.workspace.timezone, locale: member.workspace.locale },
    roleKey: member.role.key,
    roleName: member.role.name,
    permissions: perms,
    ip: h.get("x-forwarded-for")?.split(",")[0] ?? null,
    userAgent: h.get("user-agent")?.slice(0, 300) ?? null,
  };
}

export async function requireCtx(): Promise<Ctx> {
  const ctx = await getCtx();
  if (!ctx) throw unauthorized();
  return ctx;
}

export const can = (ctx: Ctx, p: Permission) => hasPermission(ctx.permissions, p);
export function requirePermission(ctx: Ctx, p: Permission) {
  if (!can(ctx, p)) throw forbidden(`Missing permission: ${p}`);
}

/** Login with lockout after repeated failures. Returns whether MFA is still needed. */
export async function login(email: string, password: string): Promise<{ mfaRequired: boolean }> {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  const generic = new AppError(401, "INVALID_CREDENTIALS", "Email or password is incorrect");
  if (!user) { await bcrypt.compare(password, "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva"); throw generic; }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new AppError(423, "LOCKED", `Account locked after repeated failed attempts. Try again after ${user.lockedUntil.toISOString()}`);
  }
  if (!user.isActive) throw new AppError(403, "INACTIVE", "This account has been deactivated");
  const ok = await verifyPassword(password, user.passwordHash);
  const member = await prisma.workspaceMember.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "asc" } });
  if (!ok) {
    const failed = user.failedLogins + 1;
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLogins: failed, lockedUntil: failed >= MAX_FAILED_LOGINS ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000) : null },
    });
    await audit({ workspaceId: member?.workspaceId, userId: user.id, eventType: failed >= MAX_FAILED_LOGINS ? "auth.locked" : "auth.login_failed", entityType: "User", entityId: user.id });
    throw generic;
  }
  await prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() } });
  await createSession(user.id, member?.workspaceId ?? null, user.mfaEnabled);
  await audit({ workspaceId: member?.workspaceId, userId: user.id, eventType: user.mfaEnabled ? "auth.password_ok_mfa_pending" : "auth.login", entityType: "User", entityId: user.id });
  return { mfaRequired: user.mfaEnabled };
}

/** For server-rendered pages: send the user to a friendly "no access" page (error messages are hidden in production). */
export function pagePermission(ctx: Ctx, p: Permission) {
  if (!can(ctx, p)) redirect(`/denied?need=${encodeURIComponent(p)}`);
}
