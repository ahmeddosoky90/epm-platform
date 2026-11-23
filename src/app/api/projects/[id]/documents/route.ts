import { api } from "@/lib/api";
import { listDocuments, uploadDocument } from "@/lib/services/documents";
export const GET = api(async (_r, ctx, p) => listDocuments(ctx, p.id));
/** multipart: file, and either documentId (new version) or title+category[+issueKey, gateStageId] */
export const POST = api(async (req, ctx, p) => uploadDocument(ctx, p.id, await req.formData()));
