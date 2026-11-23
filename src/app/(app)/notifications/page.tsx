import { requireCtx } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/bits";
import { NotificationList } from "@/components/notifications/list";

export const metadata = { title: "Notifications" };
export default async function Notifications() {
  const ctx = await requireCtx();
  const items = await prisma.notification.findMany({ where: { userId: ctx.user.id }, orderBy: { createdAt: "desc" }, take: 200 });
  return (<><PageHeader title="Notifications" subtitle="Assignments, mentions, approvals, due dates and reminders. Email copies are sent when SMTP is configured." />
    <NotificationList items={JSON.parse(JSON.stringify(items))} /></>);
}
