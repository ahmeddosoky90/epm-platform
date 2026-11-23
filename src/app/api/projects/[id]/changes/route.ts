import { z } from "zod";
import { prisma } from "@/lib/db";
import { api, body } from "@/lib/api";
import { loadProject } from "@/lib/services/access";
import { createChangeRequest } from "@/lib/services/governance";
export const GET = api(async (_r, ctx, p) => prisma.changeRequest.findMany({ where: { projectId: (await loadProject(ctx, p.id)).id }, include: { approvals: true }, orderBy: { number: "desc" } }));
export const POST = api(async (req, ctx, p) => createChangeRequest(ctx, p.id, await body(req, z.object({
  title: z.string().trim().min(3).max(200), description: z.string().max(10000).optional(), category: z.enum(["Scope", "Schedule", "Budget", "Resource", "Quality", "Other"]),
  justification: z.string().max(5000).optional(), scopeImpact: z.string().max(5000).optional(), scheduleImpactDays: z.number().int().min(-365).max(3650).default(0),
  financialImpact: z.string().regex(/^-?\d+(\.\d{1,2})?$/).default("0"), resourceImpact: z.string().max(2000).optional(), riskImpact: z.string().max(2000).optional(),
}))));
