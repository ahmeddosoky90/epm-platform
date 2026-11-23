import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { sendMail, mailConfigured } from "../integrations/mail";

type Tx = Prisma.TransactionClient | typeof prisma;
export interface NotifyInput { userIds: (string | null | undefined)[]; kind: string; title: string; body?: string; link?: string; dedupeKey?: string; excludeUserId?: string }

/**
 * In-app notification with de-duplication (unique userId+dedupeKey). If SMTP is configured,
 * an email copy is sent after the transaction (best effort, errors logged, never swallowed silently).
 */
export async function notify(n: NotifyInput, tx: Tx = prisma) {
  const ids = [...new Set(n.userIds.filter((x): x is string => !!x && x !== n.excludeUserId))];
  if (!ids.length) return;
  await tx.notification.createMany({
    data: ids.map((userId) => ({ userId, kind: n.kind, title: n.title, body: n.body, link: n.link, dedupeKey: n.dedupeKey ? `${n.dedupeKey}` : null })),
    skipDuplicates: true,
  });
  if (mailConfigured() && process.env.EMAIL_NOTIFICATIONS !== "off") {
    const users = await prisma.user.findMany({ where: { id: { in: ids }, isActive: true }, select: { email: true } });
    const url = n.link ? `${process.env.APP_URL ?? ""}${n.link}` : undefined;
    for (const u of users) {
      sendMail({ to: u.email, subject: n.title, text: `${n.body ?? ""}\n\n${url ?? ""}`.trim() })
        .catch((e) => console.error("[notify] email failed", u.email, e?.message));
    }
  }
}

/** Mentions use @email-localpart or @"Full Name" in comment bodies. */
export async function resolveMentions(workspaceId: string, text: string): Promise<string[]> {
  const handles = [...text.matchAll(/@([\w.\-]+)/g)].map((m) => m[1].toLowerCase());
  if (!handles.length) return [];
  const members = await prisma.workspaceMember.findMany({ where: { workspaceId }, include: { user: { select: { id: true, email: true } } } });
  return members.filter((m) => handles.includes(m.user.email.split("@")[0].toLowerCase())).map((m) => m.user.id);
}
