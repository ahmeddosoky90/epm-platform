import { z } from "zod";
import { prisma } from "@/lib/db";
import { api, body } from "@/lib/api";
import { completeSprint, loadSprint, startSprint } from "@/lib/services/sprints";
import { requirePermission } from "@/lib/auth";
import { D } from "@/lib/calc/money";

const d = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).transform((v) => new Date(v));
export const PATCH = api(async (req, ctx, p) => {
  const b = await body(req, z.discriminatedUnion("action", [
    z.object({ action: z.literal("start"), startDate: d, endDate: d, goal: z.string().max(500).optional() }),
    z.object({ action: z.literal("complete"), moveTo: z.string().uuid().nullable() }),
    z.object({ action: z.literal("cancel"), moveTo: z.string().uuid().nullable() }),
    z.object({ action: z.literal("edit"), name: z.string().min(1).max(80).optional(), goal: z.string().max(500).optional(), capacityPoints: z.number().min(0).nullable().optional(), endDate: d.optional() }),
  ]));
  if (b.action === "start") return startSprint(ctx, p.id, b);
  if (b.action === "complete") return completeSprint(ctx, p.id, b.moveTo);
  if (b.action === "cancel") return completeSprint(ctx, p.id, b.moveTo, true);
  requirePermission(ctx, "agile:manage"); const s = await loadSprint(ctx, p.id);
  return prisma.sprint.update({ where: { id: s.id }, data: { name: b.name, goal: b.goal, endDate: b.endDate, capacityPoints: b.capacityPoints === undefined ? undefined : b.capacityPoints === null ? null : D(b.capacityPoints) } });
});
