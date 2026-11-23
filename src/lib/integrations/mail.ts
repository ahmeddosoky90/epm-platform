import nodemailer from "nodemailer";

/**
 * Real SMTP transport (nodemailer). Configure SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS/SMTP_FROM.
 * Works with Office 365 (smtp.office365.com:587), Gmail (app password), or any relay.
 * If not configured, email sending is disabled and callers are told so — nothing is faked.
 */
export const mailConfigured = () => !!process.env.SMTP_HOST;

let transport: ReturnType<typeof nodemailer.createTransport> | null = null;
function getTransport() {
  if (!transport) {
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
  }
  return transport;
}

export async function sendMail(m: { to: string; subject: string; text: string; html?: string }) {
  if (!mailConfigured()) throw new Error("SMTP is not configured");
  return getTransport().sendMail({ from: process.env.SMTP_FROM ?? process.env.SMTP_USER, ...m });
}
