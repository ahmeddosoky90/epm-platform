import { z } from "zod";
import { prisma } from "@/lib/db";
import { api, body } from "@/lib/api";
import { forbidden } from "@/lib/errors";

export const POST = api(async (req, ctx) => {
  const { workspaceId } = await body(req, z.object({ workspaceId: z.string().uuid() }));
  const m = await prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId: ctx.user.id } } });
  if (!m) throw forbidden("You are not a member of that workspace");
  await prisma.session.update({ where: { id: ctx.sessionId }, data: { workspaceId } });
  return { ok: true };
});
