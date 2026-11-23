import { api } from "@/lib/api";
import { audit } from "@/lib/audit";
import { exportMspdi } from "@/lib/services/plan";
export const GET = api(async (_r, ctx, p) => {
  const { name, xml } = await exportMspdi(ctx, p.id);
  await audit({ workspaceId: ctx.workspaceId, userId: ctx.user.id, eventType: "plan.exported", entityType: "Project", entityId: p.id, ip: ctx.ip });
  return new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8", "content-disposition": `attachment; filename="${name}-schedule.xml"` } });
});
