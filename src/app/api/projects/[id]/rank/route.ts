import { z } from "zod";
import { prisma } from "@/lib/db";
import { api, body } from "@/lib/api";
import { loadProject, assertProjectContributor } from "@/lib/services/access";
import { requirePermission } from "@/lib/auth";
import { badRequest } from "@/lib/errors";

/** Persist backlog order: client sends the ordered keys of a list; ranks are re-spaced. */
export const POST = api(async (req, ctx, p) => {
  requirePermission(ctx, "issue:edit");
  const project = await loadProject(ctx, p.id); await assertProjectContributor(ctx, project.id);
  const { keys } = await body(req, z.object({ keys: z.array(z.string()).min(1).max(1000) }));
  const issues = await prisma.issue.findMany({ where: { projectId: project.id, key: { in: keys } }, select: { id: true, key: true, rank: true } });
  if (issues.length !== keys.length) throw badRequest("Some issues are not in this project");
  const base = Math.min(...issues.map((i) => i.rank));
  await prisma.$transaction(keys.map((k, idx) => prisma.issue.update({ where: { key: k }, data: { rank: base + idx * 10 } })));
  return { ok: true };
});
