import { api } from "@/lib/api";
import { softDeleteIssue } from "@/lib/services/issues";
export const POST = api(async (_r, ctx, p) => softDeleteIssue(ctx, p.id, true));
