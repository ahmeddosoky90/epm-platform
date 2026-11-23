import { z } from "zod";
import { prisma } from "../db";
import { can, requirePermission, type Ctx } from "../auth";
import { audit } from "../audit";
import { badRequest, forbidden, notFound } from "../errors";
import { putObject, validateUpload, safeName } from "../storage";
import { loadProject, assertProjectContributor, canManageProject } from "./access";

export const DOC_CATEGORIES = ["Business Case", "Project Charter", "Project Plan", "Requirements", "Architecture Documents", "Test Plans", "Status Reports", "Risk Register", "Change Requests", "Meeting Minutes", "Closure Report", "Lessons Learned", "Other"] as const;

export async function listDocuments(ctx: Ctx, projectKey: string) {
  const p = await loadProject(ctx, projectKey, { allowArchived: true });
  const [docs, gates] = await Promise.all([
    prisma.document.findMany({ where: { projectId: p.id }, include: { versions: { orderBy: { version: "desc" } } }, orderBy: [{ category: "asc" }, { title: "asc" }] }),
    prisma.governanceStageDef.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
  ]);
  const users = await prisma.user.findMany({ where: { id: { in: [...new Set(docs.flatMap((d) => [d.createdById, ...d.versions.map((v) => v.uploadedById)]))] } }, select: { id: true, name: true } });
  return { project: p, docs, gates, users: Object.fromEntries(users.map((u) => [u.id, u.name])) };
}

/** Upload a new document, or a new version of an existing one (documentId given). */
export async function uploadDocument(ctx: Ctx, projectKey: string, form: FormData) {
  const p = await loadProject(ctx, projectKey);
  await assertProjectContributor(ctx, p.id);
  const file = form.get("file");
  if (!(file instanceof File)) throw badRequest("Missing file");
  const bytes = Buffer.from(await file.arrayBuffer());
  validateUpload(file.name, bytes);
  const documentId = form.get("documentId")?.toString();
  const meta = z.object({ title: z.string().trim().min(2).max(200), category: z.enum(DOC_CATEGORIES), issueKey: z.string().max(30).optional(), gateStageId: z.string().uuid().optional() });
  const obj = await putObject(`projects/${p.id}/docs`, file.name, bytes, file.type || "application/octet-stream");
  return prisma.$transaction(async (tx) => {
    let doc;
    if (documentId) {
      doc = await tx.document.findFirst({ where: { id: documentId, projectId: p.id } });
      if (!doc) throw notFound("Document");
      if (doc.status === "APPROVED") await tx.document.update({ where: { id: doc.id }, data: { status: "DRAFT" } }); // a new version needs re-approval
    } else {
      const m = meta.parse({ title: form.get("title"), category: form.get("category"), issueKey: form.get("issueKey") || undefined, gateStageId: form.get("gateStageId") || undefined });
      if (m.gateStageId && !(await tx.governanceStageDef.findFirst({ where: { id: m.gateStageId, workspaceId: ctx.workspaceId } }))) throw badRequest("Unknown gate");
      doc = await tx.document.create({ data: { ...m, projectId: p.id, createdById: ctx.user.id } });
    }
    const last = await tx.documentVersion.aggregate({ where: { documentId: doc.id }, _max: { version: true } });
    const v = await tx.documentVersion.create({ data: { documentId: doc.id, version: (last._max.version ?? 0) + 1, fileName: safeName(file.name), mimeType: file.type || "application/octet-stream", sizeBytes: obj.size, storageKey: obj.key, uploadedById: ctx.user.id } });
    await audit({ workspaceId: ctx.workspaceId, userId: ctx.user.id, eventType: "document.uploaded", entityType: "Document", entityId: doc.id, after: { project: p.key, title: doc.title, version: v.version, file: v.fileName, size: v.sizeBytes }, ip: ctx.ip }, tx);
    return { document: doc, version: v };
  });
}

async function loadDoc(ctx: Ctx, id: string) {
  const d = await prisma.document.findUnique({ where: { id }, include: { versions: { orderBy: { version: "desc" } } } });
  if (!d) throw notFound("Document");
  const p = await loadProject(ctx, d.projectId, { allowArchived: true }); // scope check (404 if not visible)
  return { d, p };
}

export async function getDocumentVersion(ctx: Ctx, id: string, version?: number) {
  const { d } = await loadDoc(ctx, id);
  const v = version ? d.versions.find((x) => x.version === version) : d.versions[0];
  if (!v) throw notFound("Version");
  await audit({ workspaceId: ctx.workspaceId, userId: ctx.user.id, eventType: "document.downloaded", entityType: "Document", entityId: d.id, after: { version: v.version }, ip: ctx.ip });
  return v;
}

/** DRAFT → IN_REVIEW (contributors) → APPROVED / back to DRAFT (document:manage, not the last uploader). */
export async function setDocumentStatus(ctx: Ctx, id: string, status: "DRAFT" | "IN_REVIEW" | "APPROVED", comment?: string) {
  const { d, p } = await loadDoc(ctx, id);
  if (p.archivedAt) throw forbidden("Project is archived");
  if (status === "IN_REVIEW") await assertProjectContributor(ctx, p.id);
  else {
    requirePermission(ctx, "document:manage");
    if (status === "APPROVED") {
      if (d.status !== "IN_REVIEW") throw badRequest("Submit the document for review before approving it");
      if (d.versions[0]?.uploadedById === ctx.user.id) throw forbidden("You cannot approve a version you uploaded");
    }
  }
  if (!d.versions.length) throw badRequest("Upload a file first");
  const u = await prisma.document.update({ where: { id }, data: { status } });
  await audit({ workspaceId: ctx.workspaceId, userId: ctx.user.id, eventType: `document.${status.toLowerCase()}`, entityType: "Document", entityId: id, before: { status: d.status }, after: { status, version: d.versions[0].version, comment }, ip: ctx.ip });
  return u;
}

export async function deleteDocument(ctx: Ctx, id: string) {
  const { d, p } = await loadDoc(ctx, id);
  if (!canManageProject(ctx, p) && !can(ctx, "document:manage")) throw forbidden("Only the project manager or document managers can delete documents");
  if (d.status === "APPROVED") throw badRequest("Approved documents are records and cannot be deleted");
  await prisma.document.delete({ where: { id } });
  await audit({ workspaceId: ctx.workspaceId, userId: ctx.user.id, eventType: "document.deleted", entityType: "Document", entityId: id, before: { title: d.title, versions: d.versions.length }, ip: ctx.ip });
}

// ── Requirements traceability ──
export const requirementSchema = z.object({
  code: z.string().trim().regex(/^[A-Z0-9][A-Z0-9-]{0,19}$/i, "Use letters, digits and dashes").transform((v) => v.toUpperCase()), title: z.string().trim().min(2).max(200),
  description: z.string().max(5000).optional(), objectiveCode: z.string().max(20).nullable().optional(), issueKeys: z.array(z.string().regex(/^[A-Z][A-Z0-9]+-\d+$/)).max(50).default([]),
  testRef: z.string().max(200).nullable().optional(), status: z.enum(["DRAFT", "APPROVED", "IMPLEMENTED", "VERIFIED", "REJECTED"]).default("DRAFT"),
});

export async function traceability(ctx: Ctx, projectKey: string) {
  const p = await loadProject(ctx, projectKey, { allowArchived: true });
  const reqs = await prisma.requirement.findMany({ where: { projectId: p.id }, orderBy: { code: "asc" } });
  const keys = [...new Set(reqs.flatMap((r) => r.issueKeys))];
  const issues = await prisma.issue.findMany({ where: { key: { in: keys }, project: { workspaceId: ctx.workspaceId }, deletedAt: null }, select: { key: true, summary: true, status: { select: { name: true, category: true } }, type: { select: { name: true } } } });
  const byKey = new Map(issues.map((i) => [i.key, i]));
  return reqs.map((r) => {
    const linked = r.issueKeys.map((k) => byKey.get(k)).filter(Boolean) as typeof issues;
    const done = linked.filter((i) => i.status.category === "DONE").length;
    return { ...r, linked, coverage: linked.length ? Math.round((done / linked.length) * 100) : 0, gaps: [!linked.length && "No delivery items", !r.testRef && "No test reference", r.issueKeys.length > linked.length && "Unknown issue keys"].filter(Boolean) as string[] };
  });
}

export async function upsertRequirement(ctx: Ctx, projectKey: string, b: z.infer<typeof requirementSchema>, id?: string) {
  const p = await loadProject(ctx, projectKey);
  await assertProjectContributor(ctx, p.id);
  const r = id
    ? await prisma.requirement.update({ where: { id: (await prisma.requirement.findFirstOrThrow({ where: { id, projectId: p.id } })).id }, data: b })
    : await prisma.requirement.create({ data: { ...b, projectId: p.id } });
  await audit({ workspaceId: ctx.workspaceId, userId: ctx.user.id, eventType: id ? "requirement.updated" : "requirement.created", entityType: "Requirement", entityId: r.id, after: b, ip: ctx.ip });
  return r;
}

// ── Team ──
export async function setMember(ctx: Ctx, projectKey: string, userId: string, projectRole: "Manager" | "Member" | "Viewer" | null) {
  const p = await loadProject(ctx, projectKey, { write: true });
  if (!(await prisma.workspaceMember.findFirst({ where: { workspaceId: ctx.workspaceId, userId } }))) throw badRequest("User is not a member of this workspace");
  if (projectRole === null) {
    if (userId === p.managerId) throw badRequest("Assign a different project manager before removing this person");
    await prisma.projectMember.deleteMany({ where: { projectId: p.id, userId } });
  } else {
    await prisma.projectMember.upsert({ where: { projectId_userId: { projectId: p.id, userId } }, create: { projectId: p.id, userId, projectRole }, update: { projectRole } });
  }
  await audit({ workspaceId: ctx.workspaceId, userId: ctx.user.id, eventType: projectRole ? "project.member_set" : "project.member_removed", entityType: "Project", entityId: p.id, after: { userId, projectRole }, ip: ctx.ip });
}
