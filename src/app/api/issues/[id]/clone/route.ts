import { api } from "@/lib/api";
import { cloneIssue } from "@/lib/services/issues";
export const POST = api(async (_r, ctx, p) => cloneIssue(ctx, p.id));
