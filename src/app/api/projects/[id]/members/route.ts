import { z } from "zod";
import { api, body } from "@/lib/api";
import { setMember } from "@/lib/services/documents";
export const PUT = api(async (req, ctx, p) => {
  const b = await body(req, z.object({ userId: z.string().uuid(), projectRole: z.enum(["Manager", "Member", "Viewer"]).nullable() }));
  await setMember(ctx, p.id, b.userId, b.projectRole); return { ok: true };
});
