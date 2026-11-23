/**
 * Authorization and workspace-isolation tests against the real database (seeded with `npm run db:seed`).
 * Services are called with a context built exactly as getCtx() builds it, so these exercise the same
 * backend checks the API routes use.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import type { Ctx } from "@/lib/auth";
import { createIssue, getIssueDetail, updateIssue } from "@/lib/services/issues";
import { loadProject } from "@/lib/services/access";
import { assertFinanceView, assertFinanceEdit } from "@/lib/services/finance";
import { createUser, updateUser, createRole } from "@/lib/services/admin";
import { listConnections, saveConnection } from "@/lib/services/tech";
import { createProject } from "@/lib/services/projects";
import { auditQuery } from "@/lib/services/admin";

async function ctxFor(email: string): Promise<Ctx> {
  const u = await prisma.user.findUniqueOrThrow({ where: { email } });
  const m = await prisma.workspaceMember.findFirstOrThrow({ where: { userId: u.id }, include: { role: true, workspace: true }, orderBy: { createdAt: "asc" } });
  return {
    user: { id: u.id, name: u.name, email: u.email, isPlatformAdmin: u.isPlatformAdmin, avatarUrl: u.avatarUrl, locale: u.locale }, sessionId: "test",
    workspaceId: m.workspaceId, workspace: { id: m.workspace.id, name: m.workspace.name, currency: m.workspace.currency, timezone: m.workspace.timezone, locale: m.workspace.locale },
    roleKey: m.role.key, roleName: m.role.name, permissions: u.isPlatformAdmin ? ["*"] : m.role.permissions, ip: "127.0.0.1", userAgent: "vitest",
  };
}
const code = async (p: Promise<unknown>) => { try { await p; return 200; } catch (e) { return (e as { status?: number }).status ?? 500; } };

let head: Ctx, pm: Ctx, otherPm: Ctx, member: Ctx, exec: Ctx, retail: Ctx, admin: Ctx;
let bugType: string; let retailProjectKey: string; const created: string[] = [];

beforeAll(async () => {
  [head, pm, otherPm, member, exec, retail, admin] = await Promise.all(["layla.hassan@epm.local", "sarah.ahmed@epm.local", "omar.khaled@epm.local", "ziad.fathy@epm.local", "tarek.samir@epm.local", "retail.pm@epm.local", "admin@epm.local"].map(ctxFor));
  bugType = (await prisma.issueType.findFirstOrThrow({ where: { workspaceId: head.workspaceId, name: "Bug" } })).id;
  const rp = await createProject(retail, { name: "Isolation Test Store", key: "ISOT", methodology: "HYBRID", priority: "Medium" });
  retailProjectKey = rp.key;
});
afterAll(async () => {
  await prisma.issue.deleteMany({ where: { id: { in: created } } });
  await prisma.project.deleteMany({ where: { key: "ISOT", workspaceId: retail.workspaceId } });
  await prisma.$disconnect();
});

describe("workspace isolation", () => {
  it("cannot see another workspace's project, even by id (404, not 403)", async () => {
    const p = await prisma.project.findFirstOrThrow({ where: { key: "MBM" } });
    expect(await code(loadProject(retail, p.id))).toBe(404);
    expect(await code(loadProject(retail, "MBM"))).toBe(404);
    expect(await code(loadProject(head, retailProjectKey))).toBe(404);
  });
  it("cannot read or edit issues across workspaces", async () => {
    const i = await prisma.issue.findFirstOrThrow({ where: { project: { key: "MBM" } } });
    expect(await code(getIssueDetail(retail, i.key))).toBe(404);
    expect(await code(updateIssue(retail, i.id, { summary: "hijack" }))).toBe(404);
  });
  it("cannot create issues in another workspace's project or with its issue types", async () => {
    expect(await code(createIssue(retail, "MBM", { summary: "x", typeId: bugType, priority: "Low", dueDate: null, startDate: null }))).toBe(404);
    expect(await code(createIssue(retail, retailProjectKey, { summary: "x", typeId: bugType, priority: "Low", dueDate: null, startDate: null }))).toBe(400);
  });
  it("audit log only returns the caller's workspace", async () => {
    const r = await auditQuery(retail, {});
    expect(r.items.length).toBeGreaterThan(0);
    const ws = await prisma.auditLog.findMany({ where: { id: { in: r.items.map((x: { id: string }) => x.id) } }, select: { workspaceId: true } });
    expect(ws.every((w) => w.workspaceId === retail.workspaceId)).toBe(true);
  });
});

describe("role-based access", () => {
  it("team members only see projects they belong to", async () => {
    const other = await prisma.project.findFirst({ where: { workspaceId: head.workspaceId, members: { none: { userId: member.user.id } }, managerId: { not: member.user.id } } });
    if (other) expect(await code(loadProject(member, other.key))).toBe(404);
    expect(await code(loadProject(member, "MBM"))).toBe(200);
  });
  it("a project manager cannot see or change a project they do not manage", async () => {
    expect(await code(loadProject(pm, "CCX"))).toBe(404);
    expect(await code(loadProject(pm, "CCX", { write: true }))).toBe(404);
    expect(await code(loadProject(pm, "MBM", { write: true }))).toBe(200);
    expect(await code(loadProject(otherPm, "CCX", { write: true }))).toBe(200);
  });
  it("finance edit needs finance:edit; executives can view but not edit", async () => {
    expect(await code(assertFinanceView(exec, "MBM"))).toBe(200);
    expect(await code(assertFinanceEdit(exec, "MBM"))).toBe(403);
    expect(await code(assertFinanceEdit(member, "MBM"))).toBe(403);
  });
  it("team members can create issues in their projects; executives cannot", async () => {
    const i = await createIssue(member, "MBM", { summary: "Auth test issue", typeId: bugType, priority: "Low", dueDate: null, startDate: null });
    created.push(i.id); expect(i.key).toMatch(/^MBM-\d+$/);
    expect(await code(createIssue(exec, "MBM", { summary: "x", typeId: bugType, priority: "Low", dueDate: null, startDate: null }))).toBe(403);
  });
  it("only administrators manage users and roles", async () => {
    const role = await prisma.role.findFirstOrThrow({ where: { workspaceId: head.workspaceId, key: "TEAM_MEMBER" } });
    expect(await code(createUser(pm, { email: "nobody@example.com", name: "No Body", roleId: role.id }))).toBe(403);
    expect(await code(createRole(member, { name: "Hack", permissions: ["*"] }))).toBe(403);
  });
  it("prevents privilege escalation and self role changes", async () => {
    const superRole = await prisma.role.findFirstOrThrow({ where: { workspaceId: head.workspaceId, key: "HEAD_OF_PMO" } });
    const pmoAdmin = await ctxFor("pmo.admin@epm.local");
    if (pmoAdmin.permissions.includes("admin:users")) expect(await code(updateUser(pmoAdmin, member.user.id, { roleId: superRole.id }))).toBe(403);
    expect(await code(updateUser(head, head.user.id, { roleId: superRole.id }))).toBe(400);
  });
  it("technical portal requires tech:access, and registering servers requires tech:manage", async () => {
    expect(await code(listConnections(pm))).toBe(403);
    expect(await code(listConnections(admin))).toBe(200);
    expect(await code(saveConnection(member, { name: "x", protocol: "SSH", host: "h", port: 22, username: "u", authType: "PASSWORD", ignoreCert: false, resetHostKey: false } as never))).toBe(403);
  });
  it("never returns stored credentials", async () => {
    const rows = await listConnections(admin);
    for (const r of rows) expect(r).not.toHaveProperty("secretEnc");
  });
});
