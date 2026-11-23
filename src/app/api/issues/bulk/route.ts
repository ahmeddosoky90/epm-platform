import { z } from "zod";
import { api, body } from "@/lib/api";
import { updateIssue, transitionIssue } from "@/lib/services/issues";
import { AppError } from "@/lib/errors";

/** Bulk update: applies the same patch to each issue through the normal (authorised, audited) path. */
export const POST = api(async (req, ctx) => {
  const b = await body(req, z.object({
    keys: z.array(z.string()).min(1).max(200),
    patch: z.object({ assigneeId: z.string().uuid().nullable().optional(), priority: z.enum(["Blocker", "Critical", "High", "Medium", "Low"]).optional(), sprintId: z.string().uuid().nullable().optional(), labels: z.array(z.string()).optional() }).optional(),
    toStatusId: z.string().uuid().optional(),
  }));
  const results: { key: string; ok: boolean; error?: string }[] = [];
  for (const key of b.keys) {
    try {
      if (b.patch && Object.keys(b.patch).length) await updateIssue(ctx, key, b.patch);
      if (b.toStatusId) await transitionIssue(ctx, key, { toStatusId: b.toStatusId });
      results.push({ key, ok: true });
    } catch (e) { results.push({ key, ok: false, error: e instanceof AppError ? `${e.message}${(e.details as { reasons?: string[] })?.reasons ? ": " + (e.details as { reasons: string[] }).reasons.join("; ") : ""}` : "error" }); }
  }
  return { results, updated: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length };
});
