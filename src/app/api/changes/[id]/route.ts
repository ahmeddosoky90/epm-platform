import { z } from "zod";
import { prisma } from "@/lib/db";
import { api, body } from "@/lib/api";
import { implementChange } from "@/lib/services/governance";
import { projectScope, canManageProject } from "@/lib/services/access";
import { badRequest, forbidden, notFound } from "@/lib/errors";
import { audit } from "@/lib/audit";
export const POST = api(async (req, ctx, p) => {
  const { action } = await body(req, z.object({ action: z.enum(["implement", "close"]) }));
  if (action === "implement") return implementChange(ctx, p.id);
  const cr = await prisma.changeRequest.findFirst({ where: { id: p.id, project: projectScope(ctx) }, include: { project: true } });
  if (!cr) throw notFound("Change request"); if (!canManageProject(ctx, cr.project)) throw forbidden();
  if (!["IMPLEMENTED", "REJECTED"].includes(cr.status)) throw badRequest("Only implemented or rejected changes can be closed");
  await audit({ workspaceId: ctx.workspaceId, userId: ctx.user.id, eventType: "change.closed", entityType: "ChangeRequest", entityId: cr.id, ip: ctx.ip });
  return prisma.changeRequest.update({ where: { id: cr.id }, data: { status: "CLOSED" } });
});
