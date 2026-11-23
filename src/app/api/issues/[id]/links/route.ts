import { z } from "zod";
import { prisma } from "@/lib/db";
import { api, body } from "@/lib/api";
import { LINK_TYPES, linkIssues } from "@/lib/services/issues";
import { loadIssue, assertProjectContributor } from "@/lib/services/access";
import { requirePermission } from "@/lib/auth";
import { notFound } from "@/lib/errors";

export const POST = api(async (req, ctx, p) => {
  const b = await body(req, z.object({ targetKey: z.string().min(2), type: z.enum(LINK_TYPES), direction: z.enum(["outward", "inward"]).default("outward") }));
  const src = await loadIssue(ctx, p.id);
  return b.direction === "outward" ? linkIssues(ctx, src.key, b.targetKey, b.type) : linkIssues(ctx, b.targetKey, src.key, b.type);
});
export const DELETE = api(async (req, ctx, p) => {
  requirePermission(ctx, "issue:edit");
  const issue = await loadIssue(ctx, p.id); await assertProjectContributor(ctx, issue.projectId);
  const linkId = req.nextUrl.searchParams.get("linkId") ?? "";
  const l = await prisma.issueLink.findFirst({ where: { id: linkId, OR: [{ sourceId: issue.id }, { targetId: issue.id }] } });
  if (!l) throw notFound("Link");
  await prisma.issueLink.delete({ where: { id: l.id } });
  await prisma.issueHistory.create({ data: { issueId: issue.id, userId: ctx.user.id, field: "link", fromValue: l.type, toValue: "removed" } });
  return { ok: true };
});
