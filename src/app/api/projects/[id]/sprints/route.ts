import { z } from "zod";
import { prisma } from "@/lib/db";
import { api, body } from "@/lib/api";
import { loadProject } from "@/lib/services/access";
import { createSprint } from "@/lib/services/sprints";
const d = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().transform((v) => (v ? new Date(v) : undefined));
export const GET = api(async (_r, ctx, p) => prisma.sprint.findMany({ where: { projectId: (await loadProject(ctx, p.id)).id }, orderBy: { createdAt: "asc" } }));
export const POST = api(async (req, ctx, p) => createSprint(ctx, p.id, await body(req, z.object({ name: z.string().max(80).optional(), goal: z.string().max(500).optional(), startDate: d, endDate: d, capacityPoints: z.number().min(0).optional() }))));
