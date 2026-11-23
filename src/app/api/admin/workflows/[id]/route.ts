import { api, body } from "@/lib/api";
import { changeWorkflow, workflowDetail, workflowOpSchema } from "@/lib/services/admin";
export const GET = api(async (_r, ctx, p) => workflowDetail(ctx, p.id));
export const PATCH = api(async (req, ctx, p) => changeWorkflow(ctx, p.id, await body(req, workflowOpSchema)));
