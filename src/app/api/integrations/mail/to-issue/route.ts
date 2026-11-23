import { api, body } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { emailToIssue, emailToIssueSchema } from "@/lib/services/mail";

export const POST = api(async (req, ctx) => { requirePermission(ctx, "issue:create"); return emailToIssue(ctx, await body(req, emailToIssueSchema)); });
