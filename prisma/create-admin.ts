/**
 * Production bootstrap: creates the first workspace (if there is none) and the first administrator.
 * Safe to run again: an existing user with ADMIN_EMAIL gets platform-admin rights and the Head of PMO
 * role. No demo data is created or removed.
 *   ADMIN_EMAIL=… [ADMIN_PASSWORD=…] [ADMIN_NAME=…] [WORKSPACE_NAME=…] [ONLY_IF_NO_USERS=true] npx tsx prisma/create-admin.ts
 * Without ADMIN_PASSWORD the account gets an unusable random password and a 72-hour "set your password"
 * link is emailed (needs outgoing email). The link is never printed, so CI logs stay safe to share.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { bootstrapWorkspace } from "../src/lib/services/bootstrap";
import { randomToken, sha256 } from "../src/lib/crypto";
import { mailConfigured, sendMail } from "../src/lib/integrations/mail";

const prisma = new PrismaClient();

async function main() {
  if (process.env.ONLY_IF_NO_USERS === "true" && (await prisma.user.count()) > 0) {
    console.log("Users already exist; first-administrator setup skipped.");
    return;
  }

  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "";
  const minLen = Number(process.env.PASSWORD_MIN_LENGTH ?? 10);
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Set ADMIN_EMAIL to a valid email address.");
  if (password && password.length < minLen) throw new Error(`ADMIN_PASSWORD must be at least ${minLen} characters.`);
  if (!password && !mailConfigured()) throw new Error("Set ADMIN_PASSWORD, or configure outgoing email so a set-password link can be sent.");
  if (!password && !process.env.APP_URL) throw new Error("APP_URL must be set to build the set-password link.");

  let ws = await prisma.workspace.findFirst({ orderBy: { createdAt: "asc" } });
  if (!ws) {
    const name = process.env.WORKSPACE_NAME?.trim() || "Enterprise PMO";
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "workspace";
    ws = await prisma.$transaction(async (tx) => {
      const created = await tx.workspace.create({ data: { name, slug } });
      await bootstrapWorkspace(tx, created.id);
      return created;
    }, { timeout: 60_000 });
    console.log(`Created workspace "${ws.name}".`);
  }

  const role = await prisma.role.findFirst({ where: { workspaceId: ws.id, key: "HEAD_OF_PMO" } });
  if (!role) throw new Error(`Workspace "${ws.name}" has no HEAD_OF_PMO role.`);

  const passwordHash = await bcrypt.hash(password || randomToken(32), 12);
  const user = await prisma.user.upsert({
    where: { email },
    create: { email, name: process.env.ADMIN_NAME?.trim() || "Administrator", passwordHash, isPlatformAdmin: true, jobTitle: "Head of PMO" },
    update: { ...(password ? { passwordHash, passwordChangedAt: new Date() } : {}), isPlatformAdmin: true, isActive: true, failedLogins: 0, lockedUntil: null },
  });
  await prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: ws.id, userId: user.id } },
    create: { workspaceId: ws.id, userId: user.id, roleId: role.id },
    update: { roleId: role.id },
  });
  if (!password) {
    const token = randomToken();
    await prisma.passwordResetToken.create({ data: { id: sha256(token), userId: user.id, expiresAt: new Date(Date.now() + 72 * 3600_000) } });
    const link = `${process.env.APP_URL!.replace(/\/$/, "")}/reset?token=${token}`;
    await sendMail({ to: email, subject: "Set your Lumen PMO password", text: `Your Lumen PMO administrator account is ready. Set your password within 72 hours: ${link}` });
    console.log("Set-password link emailed to the ADMIN_EMAIL address.");
  }
  console.log(`Administrator ready in workspace "${ws.name}". Sign in with the ADMIN_EMAIL secret.`);
}

main()
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
