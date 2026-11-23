import { z } from "zod";
import { api, body } from "@/lib/api";
import { moveCard } from "@/lib/services/boards";
export const POST = api(async (req, ctx, p) => {
  const b = await body(req, z.object({ issueKey: z.string(), columnId: z.string().uuid(), beforeKey: z.string().nullable().optional() }));
  return moveCard(ctx, p.id, b.issueKey, b.columnId, b.beforeKey);
});
