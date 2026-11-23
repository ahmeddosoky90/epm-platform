import { z } from "zod";
import { api, body } from "@/lib/api";
import { loadProject } from "@/lib/services/access";
import { projectUpdateSchema, setArchived, updateProject } from "@/lib/services/projects";

export const GET = api(async (_req, ctx, p) => loadProject(ctx, p.id));
export const PATCH = api(async (req, ctx, p) => {
  const raw = await req.json();
  if (raw && typeof raw === "object" && "archived" in raw) return setArchived(ctx, p.id, z.boolean().parse(raw.archived));
  return updateProject(ctx, p.id, projectUpdateSchema.parse(raw));
});
// DELETE archives (projects are never hard-deleted to preserve audit history)
export const DELETE = api(async (_req, ctx, p) => setArchived(ctx, p.id, true));
void body;
