import { api } from "@/lib/api";
import { badRequest } from "@/lib/errors";
import { sftpDownload, sftpList, sftpUpload } from "@/lib/services/tech";

/** GET ?path=dir lists; GET ?file=path downloads. POST multipart {dir, file} uploads. */
export const GET = api(async (req, ctx, p) => {
  const file = req.nextUrl.searchParams.get("file");
  if (file) { const f = await sftpDownload(ctx, p.id, file); return new Response(new Uint8Array(f.bytes), { headers: { "content-type": "application/octet-stream", "content-disposition": `attachment; filename="${f.name.replace(/"/g, "")}"`, "x-content-type-options": "nosniff" } }); }
  return sftpList(ctx, p.id, req.nextUrl.searchParams.get("path") ?? ".");
});
export const POST = api(async (req, ctx, p) => {
  const form = await req.formData(); const file = form.get("file");
  if (!(file instanceof File)) throw badRequest("Missing file");
  if (file.size > 100 * 1024 * 1024) throw badRequest("Max 100 MB");
  return sftpUpload(ctx, p.id, String(form.get("dir") ?? "."), file.name, Buffer.from(await file.arrayBuffer()));
});
