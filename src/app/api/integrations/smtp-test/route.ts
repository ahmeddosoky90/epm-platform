import { api } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { mailConfigured, sendMail } from "@/lib/integrations/mail";
import { AppError, badRequest } from "@/lib/errors";

/** Sends a real test message to the signed-in administrator through the configured SMTP relay. */
export const POST = api(async (_r, ctx) => {
  requirePermission(ctx, "integration:manage");
  if (!mailConfigured()) throw badRequest("SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and SMTP_FROM on the server.");
  try { await sendMail({ to: ctx.user.email, subject: "Lumen PMO test message", text: "This is a test message from Lumen PMO. Outgoing mail is working." }); }
  catch (e) { throw new AppError(502, "SMTP_FAILED", `The SMTP server refused the message: ${(e as Error).message}`); }
  await audit({ workspaceId: ctx.workspaceId, userId: ctx.user.id, eventType: "integration.smtp_test", entityType: "Workspace", entityId: ctx.workspaceId, ip: ctx.ip });
  return { sent: true, to: ctx.user.email };
});
