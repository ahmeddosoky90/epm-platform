import nodemailer from "nodemailer";

/**
 * Outgoing email. Two real transports, nothing is faked:
 *   1. Brevo HTTPS API, when BREVO_API_KEY is set. For hosts that block SMTP ports (e.g. Render's free tier).
 *   2. SMTP (nodemailer), when SMTP_HOST is set. Office 365 (smtp.office365.com:587), Gmail (app password) or any relay.
 * The sender is MAIL_FROM, falling back to SMTP_FROM, then SMTP_USER. "Name <address>" or a bare address.
 * With neither transport configured, email is disabled and callers are told so.
 */
export const mailProvider = (): "brevo" | "smtp" | null =>
  process.env.BREVO_API_KEY ? "brevo" : process.env.SMTP_HOST ? "smtp" : null;
export const mailConfigured = () => mailProvider() !== null;

const fromHeader = () => process.env.MAIL_FROM || process.env.SMTP_FROM || process.env.SMTP_USER || "";

/** Splits `Name <a@b.c>` into its parts. */
export function parseAddress(v: string): { name?: string; email: string } {
  const m = v.match(/^\s*"?([^"<]*?)"?\s*<\s*([^>\s]+)\s*>\s*$/);
  if (m) return { name: m[1].trim() || undefined, email: m[2] };
  return { email: v.trim() };
}

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

async function sendViaBrevo(m: { to: string; subject: string; text: string; html?: string }) {
  const from = fromHeader();
  if (!from) throw new Error("MAIL_FROM is not set (use the sender address verified in Brevo)");
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": process.env.BREVO_API_KEY!, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ sender: parseAddress(from), to: [{ email: m.to }], subject: m.subject, textContent: m.text, ...(m.html ? { htmlContent: m.html } : {}) }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Brevo returned ${res.status}${body ? `: ${body.slice(0, 300)}` : ""}`);
  }
  return (await res.json().catch(() => ({}))) as { messageId?: string };
}

export async function sendMail(m: { to: string; subject: string; text: string; html?: string }) {
  const provider = mailProvider();
  if (!provider) throw new Error("Outgoing email is not configured");
  if (provider === "brevo") return sendViaBrevo(m);
  return getTransport().sendMail({ from: fromHeader(), ...m });
}
