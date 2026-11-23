import { api } from "@/lib/api";
import { badRequest } from "@/lib/errors";
import { importMspdi } from "@/lib/services/plan";

/** multipart: file=<MS Project XML>, mode=replace|merge */
export const POST = api(async (req, ctx, p) => {
  const form = await req.formData(); const file = form.get("file");
  if (!(file instanceof File)) throw badRequest("Missing file");
  const name = file.name.toLowerCase();
  if (name.endsWith(".mpp") || name.endsWith(".mpt")) throw badRequest("Native .mpp files are a proprietary binary format. In MS Project choose File → Save As → “XML Format (*.xml)” and upload that file.");
  if (!name.endsWith(".xml")) throw badRequest("Upload a Microsoft Project XML (.xml) file");
  if (file.size > 20 * 1024 * 1024) throw badRequest("File too large (max 20 MB)");
  const mode = form.get("mode") === "merge" ? "merge" : "replace";
  return importMspdi(ctx, p.id, await file.text(), file.name, mode);
});
