import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { api } from "@/lib/api";
import { loadIssue, assertProjectContributor } from "@/lib/services/access";
import { requirePermission } from "@/lib/auth";
import { putObject, getObject, validateUpload, safeName } from "@/lib/storage";
import { badRequest, notFound } from "@/lib/errors";
import { audit } from "@/lib/audit";

export const POST = api(async (req, ctx, p) => {
  requirePermission(ctx, "issue:comment");
  const issue = await loadIssue(ctx, p.id); await assertProjectContributor(ctx, issue.projectId);
  const form = await req.formData(); const file = form.get("file");
  if (!(file instanceof File)) throw badRequest("Missing file");
  const bytes = Buffer.from(await file.arrayBuffer());
  validateUpload(file.name, bytes);
  const obj = await putObject(`issues/${issue.id}`, file.name, bytes, file.type || "application/octet-stream");
  const a = await prisma.attachment.create({ data: { issueId: issue.id, fileName: safeName(file.name), mimeType: file.type || "application/octet-stream", sizeBytes: obj.size, storageKey: obj.key, uploadedById: ctx.user.id } });
  await prisma.issueHistory.create({ data: { issueId: issue.id, userId: ctx.user.id, field: "attachment", toValue: a.fileName } });
  await audit({ workspaceId: ctx.workspaceId, userId: ctx.user.id, eventType: "document.uploaded", entityType: "Attachment", entityId: a.id, after: { issue: issue.key, file: a.fileName, size: a.sizeBytes }, ip: ctx.ip });
  return a;
});

export const GET = api(async (req, ctx, p) => {
  const issue = await loadIssue(ctx, p.id);
  const a = await prisma.attachment.findFirst({ where: { id: req.nextUrl.searchParams.get("attachmentId") ?? "", issueId: issue.id } });
  if (!a) throw notFound("Attachment");
  const bytes = await getObject(a.storageKey);
  return new NextResponse(new Uint8Array(bytes), { headers: { "Content-Type": "application/octet-stream", "Content-Disposition": `attachment; filename="${a.fileName}"`, "X-Content-Type-Options": "nosniff" } });
});
