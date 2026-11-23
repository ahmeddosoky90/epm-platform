import { z } from "zod";
import { prisma } from "@/lib/db";
import { api, body } from "@/lib/api";
import { parse } from "@/lib/jql";
import { badRequest, notFound } from "@/lib/errors";

export const GET = api(async (_r, ctx) => prisma.savedFilter.findMany({ where: { workspaceId: ctx.workspaceId, OR: [{ ownerId: ctx.user.id }, { shared: true }] }, orderBy: { name: "asc" } }));
export const POST = api(async (req, ctx) => {
  const b = await body(req, z.object({ name: z.string().trim().min(1).max(80), jql: z.string().max(2000), shared: z.boolean().default(false) }));
  try { parse(b.jql); } catch (e) { throw badRequest(`Query error: ${(e as Error).message}`); }
  return prisma.savedFilter.create({ data: { ...b, workspaceId: ctx.workspaceId, ownerId: ctx.user.id } });
});
export const DELETE = api(async (req, ctx) => {
  const f = await prisma.savedFilter.findFirst({ where: { id: req.nextUrl.searchParams.get("id") ?? "", workspaceId: ctx.workspaceId, ownerId: ctx.user.id } });
  if (!f) throw notFound("Filter (only the owner can delete)");
  await prisma.savedFilter.delete({ where: { id: f.id } }); return { ok: true };
});
