import { api, body } from "@/lib/api";
import { getIssueDetail, issueUpdateSchema, softDeleteIssue, updateIssue } from "@/lib/services/issues";

export const GET = api(async (_r, ctx, p) => getIssueDetail(ctx, p.id));
export const PATCH = api(async (req, ctx, p) => updateIssue(ctx, p.id, await body(req, issueUpdateSchema)));
export const DELETE = api(async (_r, ctx, p) => softDeleteIssue(ctx, p.id));
