import { z } from "zod";
import { api, body } from "@/lib/api";
import { getObject } from "@/lib/storage";
import { deleteDocument, getDocumentVersion, setDocumentStatus } from "@/lib/services/documents";

/** GET ?version=N downloads that version (latest by default). */
export const GET = api(async (req, ctx, p) => {
  const v = await getDocumentVersion(ctx, p.id, Number(req.nextUrl.searchParams.get("version")) || undefined);
  const bytes = await getObject(v.storageKey);
  const inline = req.nextUrl.searchParams.get("inline") === "1" && /^(application\/pdf|image\/(png|jpeg))$/.test(v.mimeType);
  return new Response(new Uint8Array(bytes), { headers: { "Content-Type": inline ? v.mimeType : "application/octet-stream", "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${v.fileName}"`, "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox" } });
});
export const PATCH = api(async (req, ctx, p) => {
  const b = await body(req, z.object({ status: z.enum(["DRAFT", "IN_REVIEW", "APPROVED"]), comment: z.string().max(1000).optional() }));
  return setDocumentStatus(ctx, p.id, b.status, b.comment);
});
export const DELETE = api(async (_r, ctx, p) => { await deleteDocument(ctx, p.id); return { ok: true }; });
