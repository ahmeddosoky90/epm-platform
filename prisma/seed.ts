/**
 * Development / demonstration seed (BRD §16). Creates "Enterprise Banking Group" data through the
 * database only — no dashboard reads hard-coded values. Run: npm run db:seed
 * Re-running wipes and recreates demo data. All demo users share DEMO_PASSWORD (see README).
 */
import { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { bootstrapWorkspace, createDefaultWorkflow } from "../src/lib/services/bootstrap";
import { createDefaultBoards } from "../src/lib/services/bootstrap";
import { riskScore } from "../src/lib/calc/risk";

const prisma = new PrismaClient();
// No default password is committed: set DEMO_PASSWORD, or a random one is generated and printed once.
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || `Demo-${randomBytes(9).toString("base64url")}`;
const D = (v: number | string) => new Prisma.Decimal(v);
let seed = 42;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
const day = (s: string) => new Date(`${s}T00:00:00Z`);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);
const TODAY = new Date();

async function wipe() {
  // Audit log is append-only via trigger; disable it only for the dev wipe.
  await prisma.$executeRawUnsafe(`ALTER TABLE "AuditLog" DISABLE TRIGGER audit_log_no_update`);
  const tables = await prisma.$queryRawUnsafe<{ tablename: string }[]>(`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations'`);
  await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "AuditLog" ENABLE TRIGGER audit_log_no_update`);
}

async function main() {
  await wipe();
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const ws = await prisma.workspace.create({ data: { name: "Enterprise PMO", slug: "enterprise-pmo", description: "Enterprise Banking Group — Enterprise PMO workspace", currency: "EGP", timezone: "Africa/Cairo" } });
  const ws2 = await prisma.workspace.create({ data: { name: "Retail Operations", slug: "retail-ops", description: "Separate business unit workspace (demonstrates isolation)", currency: "EGP" } });
  const { types } = await bootstrapWorkspace(prisma, ws.id);
  await bootstrapWorkspace(prisma, ws2.id);
  void createDefaultWorkflow;
  const roles = Object.fromEntries((await prisma.role.findMany({ where: { workspaceId: ws.id } })).map((r) => [r.key, r.id]));

  const deptNames = [["Digital Banking", "CC-1100"], ["Retail Banking", "CC-1200"], ["Corporate Banking", "CC-1300"], ["Information Technology", "CC-2100"], ["Risk & Compliance", "CC-3100"], ["Finance", "CC-4100"], ["Enterprise PMO", "CC-5100"], ["Operations", "CC-6100"]];
  const depts: Record<string, string> = {};
  for (const [name, cc] of deptNames) depts[name] = (await prisma.department.create({ data: { workspaceId: ws.id, name, costCenter: cc } })).id;

  const people: [string, string, string, string, string][] = [
    ["admin@epm.local", "Platform Admin", "Platform Administrator", "PLATFORM_ADMIN", "Information Technology"],
    ["layla.hassan@epm.local", "Layla Hassan", "Head of Enterprise PMO", "HEAD_OF_PMO", "Enterprise PMO"],
    ["sarah.ahmed@epm.local", "Sarah Ahmed", "Senior Project Manager", "PROJECT_MANAGER", "Enterprise PMO"],
    ["omar.khaled@epm.local", "Omar Khaled", "Project Manager", "PROJECT_MANAGER", "Enterprise PMO"],
    ["mona.farouk@epm.local", "Mona Farouk", "Project Manager", "PROJECT_MANAGER", "Information Technology"],
    ["youssef.adel@epm.local", "Youssef Adel", "Portfolio Manager", "PORTFOLIO_MANAGER", "Enterprise PMO"],
    ["karim.nabil@epm.local", "Karim Nabil", "Head of Strategy", "STRATEGY", "Enterprise PMO"],
    ["nour.salah@epm.local", "Nour Salah", "Data Analyst", "DATA_ANALYST", "Enterprise PMO"],
    ["hana.mostafa@epm.local", "Hana Mostafa", "Finance Business Partner", "FINANCE", "Finance"],
    ["tarek.samir@epm.local", "Tarek Samir", "Chief Digital Officer", "EXECUTIVE", "Digital Banking"],
    ["dina.ali@epm.local", "Dina Ali", "Product Owner", "PRODUCT_OWNER", "Digital Banking"],
    ["mahmoud.ezz@epm.local", "Mahmoud Ezz", "Scrum Master", "SCRUM_MASTER", "Information Technology"],
    ["rana.adel@epm.local", "Rana Adel", "Business Analyst", "BUSINESS_ANALYST", "Digital Banking"],
    ["ali.hassan@epm.local", "Ali Hassan", "Senior Developer", "TEAM_MEMBER", "Information Technology"],
    ["salma.reda@epm.local", "Salma Reda", "Mobile Developer", "TEAM_MEMBER", "Information Technology"],
    ["ziad.fathy@epm.local", "Ziad Fathy", "QA Engineer", "TEAM_MEMBER", "Information Technology"],
    ["farida.maher@epm.local", "Farida Maher", "Backend Developer", "TEAM_MEMBER", "Information Technology"],
    ["hossam.gamal@epm.local", "Hossam Gamal", "Internal Auditor", "AUDITOR", "Risk & Compliance"],
    ["pmo.admin@epm.local", "Amira Said", "PMO Administrator", "PMO_ADMIN", "Enterprise PMO"],
  ];
  const U: Record<string, string> = {};
  for (const [email, name, title, role, dept] of people) {
    const u = await prisma.user.create({ data: { email, name, jobTitle: title, passwordHash: hash, departmentId: depts[dept], isPlatformAdmin: false } });
    U[email.split("@")[0]] = u.id;
    await prisma.workspaceMember.create({ data: { workspaceId: ws.id, userId: u.id, roleId: roles[role] } });
  }
  // A user only in the second workspace, for isolation tests/demos
  const ws2roles = Object.fromEntries((await prisma.role.findMany({ where: { workspaceId: ws2.id } })).map((r) => [r.key, r.id]));
  const outsider = await prisma.user.create({ data: { email: "retail.pm@epm.local", name: "Retail PM", passwordHash: hash, jobTitle: "Project Manager" } });
  await prisma.workspaceMember.create({ data: { workspaceId: ws2.id, userId: outsider.id, roleId: ws2roles.HEAD_OF_PMO } });
  for (const k of ["sarah.ahmed", "omar.khaled", "mona.farouk"]) await prisma.user.update({ where: { id: U[k] }, data: { managerId: U["layla.hassan"] } });

  const teamA = await prisma.team.create({ data: { workspaceId: ws.id, name: "Mobile Squad" } });
  const teamB = await prisma.team.create({ data: { workspaceId: ws.id, name: "Platform Squad" } });
  for (const k of ["dina.ali", "mahmoud.ezz", "salma.reda", "ali.hassan", "ziad.fathy"]) await prisma.teamMember.create({ data: { teamId: teamA.id, userId: U[k] } });
  for (const k of ["farida.maher", "ali.hassan", "rana.adel"]) await prisma.teamMember.create({ data: { teamId: teamB.id, userId: U[k] } });
  for (const [d, n] of [["2026-01-07", "Coptic Christmas"], ["2026-04-25", "Sinai Liberation Day"], ["2026-07-23", "Revolution Day"], ["2026-10-06", "Armed Forces Day"], ["2027-01-07", "Coptic Christmas"], ["2027-01-25", "Revolution Day (Jan 25)"]] as const)
    await prisma.holiday.create({ data: { workspaceId: ws.id, date: day(d), name: n } });
  await prisma.exchangeRate.createMany({ data: [
    { workspaceId: ws.id, currency: "EGP", rateToBase: D(1), effectiveDate: day("2026-01-01") },
    { workspaceId: ws.id, currency: "USD", rateToBase: D("48.50"), effectiveDate: day("2026-01-01") },
    { workspaceId: ws.id, currency: "EUR", rateToBase: D("52.80"), effectiveDate: day("2026-01-01") },
  ] });

  // Strategy
  const objectives = [
    ["SO-1", "Grow digital customer base to 5M"], ["SO-2", "Reduce cost-to-income ratio by 5pp"], ["SO-3", "Achieve full CBE regulatory compliance"], ["SO-4", "Modernise core technology platforms"],
  ];
  const O: Record<string, string> = {};
  for (const [code, title] of objectives) O[code] = (await prisma.strategicObjective.create({ data: { workspaceId: ws.id, code, title, ownerId: U["karim.nabil"], targetDate: day("2027-12-31") } })).id;

  const pf: Record<string, string> = {};
  for (const [n, d] of [["Digital Transformation Portfolio", "Customer-facing digital channels and journeys"], ["Regulatory & Risk Portfolio", "Mandatory compliance and risk programmes"], ["Technology Modernisation Portfolio", "Core platform and infrastructure renewal"]])
    pf[n] = (await prisma.portfolio.create({ data: { workspaceId: ws.id, name: n, description: d, ownerId: U["youssef.adel"] } })).id;
  const pg: Record<string, string> = {};
  for (const [n, p] of [["Digital Banking Transformation", "Digital Transformation Portfolio"], ["Customer Experience", "Digital Transformation Portfolio"], ["Regulatory Compliance 2027", "Regulatory & Risk Portfolio"], ["Core Banking Renewal", "Technology Modernisation Portfolio"], ["Cloud & Infrastructure", "Technology Modernisation Portfolio"]])
    pg[n] = (await prisma.program.create({ data: { workspaceId: ws.id, name: n, portfolioId: pf[p], managerId: U["youssef.adel"] } })).id;

  const stages = Object.fromEntries((await prisma.lifecycleStage.findMany({ where: { workspaceId: ws.id } })).map((s) => [s.name, s.id]));
  const wf = await prisma.workflow.findFirstOrThrow({ where: { workspaceId: ws.id, isDefault: true }, include: { statuses: true } });
  const S = Object.fromEntries(wf.statuses.map((s) => [s.name, s]));

  type P = { key: string; name: string; pm: string; prog: string; port: string; bu: string; meth: string; status: string; health: string; stage: string; start: string; end: string; budget: number; capex: number; opex: number; progress: number; sponsor: string; owner: string; obj: string[]; priority: string };
  const projects: P[] = [
    { key: "MBM", name: "Mobile Banking Modernization", pm: "sarah.ahmed", prog: "Digital Banking Transformation", port: "Digital Transformation Portfolio", bu: "Digital Banking", meth: "HYBRID", status: "ACTIVE", health: "GREEN", stage: "Planning", start: "2027-01-01", end: "2027-12-31", budget: 25_000_000, capex: 17_500_000, opex: 7_500_000, progress: 8, sponsor: "Chief Digital Officer", owner: "Head of Digital Banking", obj: ["SO-1", "SO-4"], priority: "Critical" },
    { key: "DOB", name: "Digital Customer Onboarding", pm: "sarah.ahmed", prog: "Digital Banking Transformation", port: "Digital Transformation Portfolio", bu: "Digital Banking", meth: "AGILE", status: "ACTIVE", health: "AMBER", stage: "Execution", start: "2026-06-01", end: "2027-03-31", budget: 9_800_000, capex: 6_000_000, opex: 3_800_000, progress: 46, sponsor: "Chief Digital Officer", owner: "Head of Retail Products", obj: ["SO-1"], priority: "High" },
    { key: "WCP", name: "Wealth Customer Portal", pm: "omar.khaled", prog: "Customer Experience", port: "Digital Transformation Portfolio", bu: "Retail Banking", meth: "AGILE", status: "ACTIVE", health: "GREEN", stage: "Execution", start: "2026-04-01", end: "2027-02-28", budget: 6_200_000, capex: 4_100_000, opex: 2_100_000, progress: 61, sponsor: "Head of Retail", owner: "Head of Wealth", obj: ["SO-1", "SO-2"], priority: "Medium" },
    { key: "CCX", name: "Contact Centre Experience Upgrade", pm: "omar.khaled", prog: "Customer Experience", port: "Digital Transformation Portfolio", bu: "Operations", meth: "WATERFALL", status: "ON_HOLD", health: "AMBER", stage: "Planning", start: "2026-09-01", end: "2027-06-30", budget: 4_500_000, capex: 2_000_000, opex: 2_500_000, progress: 12, sponsor: "COO", owner: "Head of Contact Centre", obj: ["SO-2"], priority: "Low" },
    { key: "AML", name: "AML Transaction Monitoring Upgrade", pm: "mona.farouk", prog: "Regulatory Compliance 2027", port: "Regulatory & Risk Portfolio", bu: "Risk & Compliance", meth: "WATERFALL", status: "ACTIVE", health: "RED", stage: "Execution", start: "2026-02-01", end: "2026-12-31", budget: 12_000_000, capex: 9_000_000, opex: 3_000_000, progress: 68, sponsor: "Chief Risk Officer", owner: "Head of Compliance", obj: ["SO-3"], priority: "Critical" },
    { key: "IFR", name: "IFRS 9 Provisioning Engine", pm: "mona.farouk", prog: "Regulatory Compliance 2027", port: "Regulatory & Risk Portfolio", bu: "Finance", meth: "HYBRID", status: "ACTIVE", health: "GREEN", stage: "Monitoring and Control", start: "2026-01-15", end: "2026-12-15", budget: 7_400_000, capex: 5_200_000, opex: 2_200_000, progress: 84, sponsor: "CFO", owner: "Head of Financial Reporting", obj: ["SO-3"], priority: "High" },
    { key: "CBR", name: "Core Banking API Layer", pm: "omar.khaled", prog: "Core Banking Renewal", port: "Technology Modernisation Portfolio", bu: "Information Technology", meth: "AGILE", status: "ACTIVE", health: "AMBER", stage: "Execution", start: "2026-03-01", end: "2027-05-31", budget: 18_000_000, capex: 14_000_000, opex: 4_000_000, progress: 39, sponsor: "CIO", owner: "Head of Architecture", obj: ["SO-4", "SO-2"], priority: "Critical" },
    { key: "CBM", name: "Core Banking Data Migration", pm: "mona.farouk", prog: "Core Banking Renewal", port: "Technology Modernisation Portfolio", bu: "Information Technology", meth: "WATERFALL", status: "PROPOSED", health: "GREEN", stage: "Business Case Approval", start: "2027-03-01", end: "2028-02-28", budget: 0, capex: 0, opex: 0, progress: 0, sponsor: "CIO", owner: "Head of Data", obj: ["SO-4"], priority: "High" },
    { key: "HCM", name: "Hybrid Cloud Migration", pm: "sarah.ahmed", prog: "Cloud & Infrastructure", port: "Technology Modernisation Portfolio", bu: "Information Technology", meth: "HYBRID", status: "ACTIVE", health: "GREEN", stage: "Execution", start: "2026-05-01", end: "2027-04-30", budget: 15_500_000, capex: 11_000_000, opex: 4_500_000, progress: 52, sponsor: "CIO", owner: "Head of Infrastructure", obj: ["SO-4", "SO-2"], priority: "High" },
    { key: "DCR", name: "Data Centre Refresh 2025", pm: "mona.farouk", prog: "Cloud & Infrastructure", port: "Technology Modernisation Portfolio", bu: "Information Technology", meth: "WATERFALL", status: "COMPLETED", health: "GREEN", stage: "Closed", start: "2025-03-01", end: "2026-02-28", budget: 8_000_000, capex: 7_600_000, opex: 400_000, progress: 100, sponsor: "CIO", owner: "Head of Infrastructure", obj: ["SO-4"], priority: "Medium" },
  ];

  const criteria = await prisma.priorityCriterion.findMany({ where: { workspaceId: ws.id } });
  const gateDefs = await prisma.governanceStageDef.findMany({ where: { workspaceId: ws.id }, orderBy: { sortOrder: "asc" } });
  const P: Record<string, string> = {};
  for (const p of projects) {
    const proj = await prisma.project.create({ data: {
      workspaceId: ws.id, key: p.key, name: p.name, description: `${p.name} — part of the ${p.prog} programme.`, type: "Business", category: p.bu,
      methodology: p.meth, priority: p.priority, status: p.status, health: p.health, businessUnit: p.bu, sponsor: p.sponsor, businessOwner: p.owner,
      managerId: U[p.pm], ownerId: U["layla.hassan"], portfolioId: pf[p.port], programId: pg[p.prog], lifecycleStageId: stages[p.stage], workflowId: wf.id,
      startDate: day(p.start), plannedEndDate: day(p.end), actualStartDate: day(p.start) < TODAY ? day(p.start) : null,
      actualEndDate: p.status === "COMPLETED" ? day(p.end) : null, currency: "EGP",
      approvedBudget: D(p.budget), capexBudget: D(p.capex), opexBudget: D(p.opex), progress: p.progress, classification: "Internal", complexity: p.budget > 10_000_000 ? "High" : "Medium",
      tags: [p.bu.split(" ")[0].toLowerCase()],
      objectives: { create: p.obj.map((o) => ({ objectiveId: O[o] })) },
      scores: { create: criteria.map((c) => ({ criterionId: c.id, score: Math.floor(4 + rnd() * 7) })) },
      archivedAt: p.status === "COMPLETED" ? day("2026-04-01") : null,
    } });
    P[p.key] = proj.id;
    await createDefaultBoards(prisma, proj.id, wf.id, p.meth);
    const team = p.key === "MBM" || p.key === "DOB" ? ["dina.ali", "mahmoud.ezz", "salma.reda", "ali.hassan", "ziad.fathy", "rana.adel"] : ["ali.hassan", "farida.maher", "ziad.fathy", "rana.adel"];
    for (const m of new Set([p.pm, ...team])) await prisma.projectMember.create({ data: { projectId: proj.id, userId: U[m], projectRole: m === p.pm ? "Manager" : "Member" } });

    // Governance gates: approved up to the current lifecycle position
    const stageOrder = ["Idea", "Initial Assessment", "Business Case Development", "Business Case Approval", "Initiation", "Planning", "Execution", "Monitoring and Control", "Closure", "Closed"];
    const pos = stageOrder.indexOf(p.stage);
    const gatesPassed = pos >= 9 ? 7 : pos >= 7 ? 5 : pos >= 6 ? 4 : pos >= 5 ? 3 : pos >= 4 ? 2 : pos >= 3 ? 1 : 0;
    for (const [gi, g] of gateDefs.entries()) {
      const approved = gi < gatesPassed;
      const inReview = gi === gatesPassed && p.status !== "COMPLETED" && (p.key === "CBM" || p.key === "MBM" || p.key === "IFR");
      const decided = approved ? addDays(day(p.start), -60 + gi * 30) : null;
      const gate = await prisma.projectGate.create({ data: {
        projectId: proj.id, stageId: g.id, status: approved ? "APPROVED" : inReview ? "IN_REVIEW" : "NOT_STARTED",
        checklistState: Object.fromEntries(g.checklist.map((c) => [c, approved || (inReview && rnd() > 0.4)])),
        submittedAt: approved || inReview ? addDays(decided ?? TODAY, -7) : null, decidedAt: decided,
        expiresAt: approved && g.validityDays && decided ? addDays(decided, g.validityDays) : null,
      } });
      if (approved || inReview) {
        for (const [si, role] of g.approverRoles.entries()) {
          const approver = Object.entries(Object.fromEntries(people.map((x) => [x[0].split("@")[0], x[3]]))).find(([, r]) => r === role)?.[0];
          const done = approved || (inReview && si === 0 && p.key !== "CBM");
          await prisma.approval.create({ data: { gateId: gate.id, step: si + 1, approverRole: role, approverId: done ? U[approver ?? "layla.hassan"] : null, decision: done ? "APPROVED" : "PENDING", comment: done ? "Reviewed and approved." : null, decidedAt: done ? decided ?? addDays(TODAY, -3) : null } });
        }
      }
    }

    // Milestones
    const s0 = day(p.start), e0 = day(p.end), span = (e0.getTime() - s0.getTime()) / 86400000;
    for (const [i, name] of ["Charter approved", "Design complete", "Build complete", "UAT sign-off", "Go-live"].entries()) {
      const base = addDays(s0, Math.round(span * (0.1 + i * 0.22)));
      const slip = p.health === "RED" && i >= 2 ? 21 : p.health === "AMBER" && i >= 3 ? 10 : 0;
      const due = addDays(base, slip);
      const done = due < TODAY && (p.health !== "RED" || i < 2);
      await prisma.milestone.create({ data: { projectId: proj.id, name, baselineDate: base, dueDate: due, completedAt: done ? due : null, status: done ? "DONE" : "PLANNED" } });
    }

    // Budget sheet lines per category
    if (p.budget > 0) {
      const fy = Number(p.start.slice(0, 4));
      const cats: [string, string, number][] = [["Labor", "OPEX", 0.32], ["Software", "CAPEX", 0.28], ["Hardware", "CAPEX", 0.2], ["Services", "CAPEX", 0.12], ["Training", "OPEX", 0.04], ["Contingency", "OPEX", 0.04]];
      for (const [cat, et, share] of cats) {
        const approved = Math.round(p.budget * share);
        const overrun = p.health === "RED" ? 1.14 : p.health === "AMBER" ? 1.05 : 0.98;
        await prisma.budgetLine.create({ data: { projectId: proj.id, category: cat, expenseType: et, fiscalYear: fy, costCenter: deptNames.find((d) => d[0] === p.bu)?.[1] ?? "CC-5100", proposed: D(Math.round(approved * 1.08)), approved: D(approved), forecast: D(Math.round(approved * overrun)), vendor: cat === "Software" ? pick(["Temenos", "Microsoft", "Oracle", "Backbase"]) : cat === "Hardware" ? pick(["Dell", "HPE", "Cisco"]) : null } });
      }
      // Actual + committed transactions spread over elapsed months
      const elapsed = Math.max(0, Math.min(1, (TODAY.getTime() - s0.getTime()) / (e0.getTime() - s0.getTime())));
      const spendTarget = p.budget * elapsed * (p.health === "RED" ? 1.2 : p.health === "AMBER" ? 1.06 : 0.92);
      const months = Math.max(1, Math.round(span * elapsed / 30));
      for (let m = 0; m < months; m++) {
        for (const [cat, et, share] of cats.slice(0, 4)) {
          const amt = Math.round((spendTarget * share) / months * (0.8 + rnd() * 0.4));
          if (amt <= 0) continue;
          await prisma.financialTransaction.create({ data: { projectId: proj.id, kind: "ACTUAL", expenseType: et, category: cat, amount: D(amt), currency: "EGP", amountBase: D(amt), txDate: addDays(s0, m * 30 + 12), vendor: cat === "Labor" ? null : pick(["Temenos", "Microsoft", "Dell", "Accenture", "IBM"]), costCenter: "CC-5100", reference: `INV-${p.key}-${m + 1}${cat[0]}`, description: `${cat} — month ${m + 1}`, createdById: U["hana.mostafa"] } });
        }
      }
      if (p.status === "ACTIVE") await prisma.financialTransaction.create({ data: { projectId: proj.id, kind: "COMMITTED", expenseType: "CAPEX", category: "Software", amount: D(Math.round(p.budget * 0.08)), currency: "USD", amountBase: D(Math.round(p.budget * 0.08)), txDate: addDays(TODAY, -10), vendor: "Microsoft", reference: `PO-${p.key}-001`, description: "Licence purchase order (USD)", createdById: U["hana.mostafa"] } });
    }

    // Risks + RAID
    const riskTitles = ["Vendor delivery delay", "Key resource attrition", "Regulatory requirement change", "Integration complexity with core banking", "Data quality issues in legacy systems", "Security vulnerability in third-party SDK", "Budget overrun on licences"];
    const nRisks = 2 + Math.floor(rnd() * 4);
    for (let i = 0; i < nRisks; i++) {
      const prob = 1 + Math.floor(rnd() * 5), imp = (p.health === "RED" ? 3 : 1) + Math.floor(rnd() * (p.health === "RED" ? 3 : 5));
      await prisma.risk.create({ data: { projectId: proj.id, number: i + 1, title: riskTitles[(i + p.key.charCodeAt(0)) % riskTitles.length], category: pick(["Delivery", "Technical", "Regulatory", "Financial", "Resource"]), ownerId: U[p.pm], probability: prob, impact: imp, score: riskScore(prob, imp), response: pick(["MITIGATE", "MITIGATE", "TRANSFER", "ACCEPT"]), mitigation: "Weekly vendor checkpoint and contingency plan.", targetDate: addDays(TODAY, Math.floor(rnd() * 60) - 20), status: p.status === "COMPLETED" ? "CLOSED" : pick(["OPEN", "OPEN", "MITIGATING"]) } });
    }
    await prisma.raidItem.createMany({ data: [
      { projectId: proj.id, kind: "ASSUMPTION", title: "Core banking sandbox available to delivery teams", ownerId: U[p.pm], status: "OPEN", dueDate: addDays(TODAY, 20), impact: "Integration testing blocked" },
      { projectId: proj.id, kind: "ISSUE", title: p.health === "RED" ? "Vendor missed sprint deliverables two cycles in a row" : "Environment provisioning slower than planned", severity: p.health === "RED" ? "Critical" : "Medium", ownerId: U[p.pm], status: "OPEN", dueDate: addDays(TODAY, -5), escalated: p.health === "RED" },
      { projectId: proj.id, kind: "DEPENDENCY", title: "Identity platform upgrade (external vendor)", external: true, ownerId: U[p.pm], status: p.health === "GREEN" ? "ON_TRACK" : "AT_RISK", dueDate: addDays(TODAY, 30) },
      { projectId: proj.id, kind: "ACTION", title: "Confirm UAT participants with business", ownerId: U["rana.adel"], status: "OPEN", dueDate: addDays(TODAY, -2) },
    ] });
    await prisma.statusReport.create({ data: { projectId: proj.id, authorId: U[p.pm], health: p.health, summary: p.health === "RED" ? "Critical path slipped 3 weeks; recovery plan under review." : "On track against baseline.", achievements: "Completed sprint goals; vendor onboarding finished.", nextSteps: "Prepare for next stage gate.", createdAt: p.key === "CCX" ? addDays(TODAY, -40) : addDays(TODAY, -Math.floor(rnd() * 10)) } });
    if (p.status === "ACTIVE") await prisma.version.create({ data: { projectId: proj.id, name: "R1.0", releaseDate: addDays(TODAY, 45) } });
  }

  await prisma.projectDependency.createMany({ data: [
    { fromId: P["MBM"], toId: P["CBR"], description: "Mobile app consumes Core Banking APIs", status: "OPEN", dueDate: day("2027-02-15") },
    { fromId: P["DOB"], toId: P["AML"], description: "Onboarding uses AML screening service", status: "AT_RISK", dueDate: addDays(TODAY, 25) },
    { fromId: P["CBM"], toId: P["HCM"], description: "Migration target environment on hybrid cloud", status: "OPEN", dueDate: day("2027-03-01") },
  ] });

  // ── Delivery issues for agile projects ──
  const statusPath = ["Open", "To Do", "In Progress", "In Review", "Testing", "Done"];
  async function makeIssue(projectKey: string, n: number, o: { summary: string; type: string; status: string; assignee?: string; parent?: string; sprintId?: string; points?: number; priority?: string; createdAt: Date; labels?: string[]; showStopper?: boolean; severity?: string; due?: Date }) {
    const st = S[o.status];
    const created = o.createdAt;
    const issue = await prisma.issue.create({ data: {
      projectId: P[projectKey], number: n, key: `${projectKey}-${n}`, summary: o.summary, typeId: types[o.type], statusId: st.id,
      priority: o.priority ?? "Medium", assigneeId: o.assignee ? U[o.assignee] : null, reporterId: U["dina.ali"], parentId: o.parent ?? null,
      sprintId: o.sprintId ?? null, storyPoints: o.points != null ? D(o.points) : null, labels: o.labels ?? [], isShowStopper: !!o.showStopper, severity: o.severity ?? null,
      originalEstimateMin: o.points ? o.points * 240 : null, remainingEstimateMin: st.category === "DONE" ? 0 : o.points ? o.points * 120 : null,
      dueDate: o.due ?? null, createdAt: created, rank: n * 1000, resolvedAt: st.category === "DONE" ? addDays(created, 6) : null, resolution: st.category === "DONE" ? "Done" : null,
    } });
    await prisma.issueHistory.create({ data: { issueId: issue.id, userId: U["dina.ali"], field: "created", toValue: issue.key, createdAt: created } });
    const idx = statusPath.indexOf(o.status);
    let t = created;
    for (let i = 1; i <= (idx < 0 ? 2 : idx); i++) {
      t = addDays(t, 1 + Math.floor(rnd() * 2));
      await prisma.issueHistory.create({ data: { issueId: issue.id, userId: o.assignee ? U[o.assignee] : U["dina.ali"], field: "status", fromValue: statusPath[i - 1], toValue: idx < 0 && i === 2 ? o.status : statusPath[i], createdAt: t } });
    }
    await prisma.issueWatcher.create({ data: { issueId: issue.id, userId: U["dina.ali"] } });
    return issue;
  }

  for (const pk of ["DOB", "MBM", "CBR", "WCP"]) {
    const proj = projects.find((x) => x.key === pk)!;
    let n = 0;
    const devs = ["salma.reda", "ali.hassan", "farida.maher", "ziad.fathy"];
    const sprints: { id: string; state: string; start: Date; end: Date }[] = [];
    const nClosed = pk === "MBM" ? 0 : 3;
    const sprintLen = 14;
    const activeStart = addDays(TODAY, -8);
    for (let i = 0; i < nClosed + 2; i++) {
      const start = addDays(activeStart, (i - nClosed) * sprintLen);
      const state = i < nClosed ? "CLOSED" : i === nClosed ? "ACTIVE" : "FUTURE";
      const name = pk === "MBM" && i === 0 ? "MBM Sprint 0 – Discovery" : `${pk} Sprint ${i + 1}`;
      const sp = await prisma.sprint.create({ data: { projectId: P[pk], name, goal: i === nClosed ? "Complete core journey and stabilise test environment" : `Increment ${i + 1}`, state, startDate: state === "FUTURE" ? null : start, endDate: state === "FUTURE" ? null : addDays(start, sprintLen), completedAt: state === "CLOSED" ? addDays(start, sprintLen) : null, capacityPoints: D(34) } });
      sprints.push({ id: sp.id, state, start, end: addDays(start, sprintLen) });
    }
    const epicNames = pk === "MBM" ? ["Biometric login", "Payments & transfers", "Card management", "Accessibility & Arabic RTL"] : pk === "DOB" ? ["eKYC & ID verification", "Account opening journey", "AML screening integration"] : pk === "CBR" ? ["Accounts API", "Payments API", "API security gateway"] : ["Portfolio overview", "Advisor chat"];
    const epics: string[] = [];
    for (const e of epicNames) epics.push((await makeIssue(pk, ++n, { summary: e, type: "Epic", status: "In Progress", assignee: "dina.ali", createdAt: addDays(activeStart, -nClosed * sprintLen - 10), priority: "High" })).id);

    const storyTpl = ["As a customer I can %s", "API endpoint for %s", "UI for %s", "Validation rules for %s", "Analytics events for %s", "Error handling in %s"];
    const subjects = ["login with face ID", "OTP fallback", "transfer between own accounts", "beneficiary management", "card freeze", "statement download", "ID document capture", "liveness check", "address verification", "consent capture", "push notifications", "limits configuration"];
    for (const [si, sp] of sprints.entries()) {
      const count = sp.state === "FUTURE" ? 5 : 8;
      for (let k = 0; k < count; k++) {
        const pts = pick([1, 2, 3, 5, 5, 8]);
        let status = "To Do";
        if (sp.state === "CLOSED") status = rnd() > 0.12 ? "Done" : "In Progress";
        if (sp.state === "ACTIVE") status = pick(["Done", "Done", "In Progress", "In Review", "Testing", "To Do", "Blocked"]);
        const created = addDays(sp.start, -3);
        const iss = await makeIssue(pk, ++n, { summary: pick(storyTpl).replace("%s", pick(subjects)), type: pick(["Story", "Story", "Task"]), status, assignee: status === "To Do" && rnd() > 0.5 ? undefined : pick(devs), parent: pick(epics), sprintId: sp.state === "CLOSED" && status !== "Done" ? sprints[si + 1].id : sp.id, points: pts, createdAt: created, priority: pick(["High", "Medium", "Medium", "Low"]), due: addDays(sp.end, 0) });
        if (sp.state !== "FUTURE") {
          await prisma.sprintIssueEvent.create({ data: { sprintId: sp.id, issueId: iss.id, kind: "ADDED", points: D(pts), createdAt: sp.start } });
          if (status === "Done") await prisma.sprintIssueEvent.create({ data: { sprintId: sp.id, issueId: iss.id, kind: "COMPLETED", points: D(pts), createdAt: addDays(sp.start, Math.min(13, 2 + Math.floor(rnd() * (sp.state === "ACTIVE" ? 7 : 12)))) } });
          if (sp.state === "CLOSED" && status !== "Done") {
            await prisma.sprintIssueEvent.create({ data: { sprintId: sp.id, issueId: iss.id, kind: "REMOVED", points: D(pts), createdAt: sp.end } });
            await prisma.sprintIssueEvent.create({ data: { sprintId: sprints[si + 1].id, issueId: iss.id, kind: "ADDED", points: D(pts), createdAt: sprints[si + 1].start } });
          }
        }
        if (sp.state === "ACTIVE" && k === 7) { // mid-sprint scope change
          await prisma.sprintIssueEvent.create({ data: { sprintId: sp.id, issueId: iss.id, kind: "ADDED", points: D(2), createdAt: addDays(sp.start, 4) } });
        }
      }
      if (sp.state === "CLOSED") {
        const ev = await prisma.sprintIssueEvent.findMany({ where: { sprintId: sp.id } });
        const committed = ev.filter((e) => e.kind === "ADDED").reduce((a, e) => a + Number(e.points), 0);
        const completed = ev.filter((e) => e.kind === "COMPLETED").reduce((a, e) => a + Number(e.points), 0);
        await prisma.sprint.update({ where: { id: sp.id }, data: { committedPoints: D(committed), completedPoints: D(completed) } });
      }
      if (sp.state === "ACTIVE") {
        const ev = await prisma.sprintIssueEvent.findMany({ where: { sprintId: sp.id, kind: "ADDED" } });
        await prisma.sprint.update({ where: { id: sp.id }, data: { committedPoints: D(ev.reduce((a, e) => a + Number(e.points), 0)) } });
      }
    }
    // Backlog (no sprint)
    for (let k = 0; k < 6; k++) await makeIssue(pk, ++n, { summary: pick(storyTpl).replace("%s", pick(subjects)), type: "Story", status: "Open", parent: pick(epics), points: pick([3, 5, 8, 13]), createdAt: addDays(TODAY, -20 + k) });
    // Bugs, including show-stoppers
    const active = sprints.find((s) => s.state === "ACTIVE")!;
    const bugTitles = ["Crash on Android 14 when rotating during OTP", "Transfer limit not enforced for joint accounts", "Arabic text truncated on summary screen", "Session not invalidated on logout", "Statement PDF shows wrong currency", "Timeout calling customer profile API", "Duplicate push notifications"];
    for (let k = 0; k < (pk === "MBM" ? 3 : 6); k++) {
      const sev = pick(["S1", "S2", "S2", "S3", "S3", "S4"]);
      const stopper = sev === "S1" || (k === 0 && pk !== "WCP");
      const status = pick(["Open", "In Progress", "In Progress", "Testing", "Done", "To Do"]);
      const b = await makeIssue(pk, ++n, { summary: bugTitles[(k + pk.length) % bugTitles.length], type: "Bug", status, assignee: pick(devs), sprintId: rnd() > 0.4 ? active.id : undefined, priority: stopper ? "Blocker" : sev === "S2" ? "Critical" : "Medium", createdAt: addDays(TODAY, -Math.floor(rnd() * 25)), severity: sev, showStopper: stopper, labels: ["defect"] });
      if (b.sprintId) await prisma.sprintIssueEvent.create({ data: { sprintId: active.id, issueId: b.id, kind: "ADDED", points: D(0), createdAt: b.createdAt } });
    }
    await prisma.project.update({ where: { id: P[pk] }, data: { issueCounter: n } });
    // Blocking link: first bug blocks the epic's first story in active sprint
    const firstBug = await prisma.issue.findFirst({ where: { projectId: P[pk], type: { name: "Bug" }, isShowStopper: true } });
    const story = await prisma.issue.findFirst({ where: { projectId: P[pk], sprintId: active.id, type: { name: "Story" }, status: { category: { not: "DONE" } } } });
    if (firstBug && story) await prisma.issueLink.create({ data: { sourceId: firstBug.id, targetId: story.id, type: "BLOCKS" } });
    // Some comments + work logs
    const someIssues = await prisma.issue.findMany({ where: { projectId: P[pk], assigneeId: { not: null } }, take: 10 });
    for (const is of someIssues) {
      await prisma.issueComment.create({ data: { issueId: is.id, authorId: is.assigneeId!, body: "Picked this up — will update after stand-up." } });
      await prisma.workLog.create({ data: { issueId: is.id, userId: is.assigneeId!, minutes: 60 * (1 + Math.floor(rnd() * 6)), workDate: addDays(TODAY, -Math.floor(rnd() * 10)), note: "Implementation" } });
    }
    void proj;
  }
  // Non-agile projects: a few tasks so dashboards have content
  for (const pk of ["AML", "IFR", "HCM", "CCX"]) {
    for (let k = 1; k <= 8; k++) {
      await makeIssue(pk, k, { summary: `${pick(["Configure", "Test", "Document", "Deploy", "Review"])} ${pick(["rules engine", "data feeds", "reports", "interfaces", "environments", "controls"])}`, type: k === 8 ? "Bug" : "Task", status: pick(["To Do", "In Progress", "Done", "Done", "Testing", "Blocked"]), assignee: pick(["ali.hassan", "farida.maher", "ziad.fathy"]), createdAt: addDays(TODAY, -40 + k * 3), priority: k === 8 ? "Blocker" : "Medium", showStopper: k === 8 && pk === "AML", severity: k === 8 ? "S1" : undefined, due: addDays(TODAY, -10 + k * 4) });
    }
    await prisma.project.update({ where: { id: P[pk] }, data: { issueCounter: 8 } });
  }

  // ── Schedules (WBS + dependencies) for waterfall/hybrid projects ──
  for (const pk of ["AML", "HCM", "MBM"]) {
    const proj = projects.find((x) => x.key === pk)!;
    const start = day(proj.start);
    const phases = ["Initiation", "Design", "Build", "Test", "Deploy"];
    let cursor = start, order = 0, prevLast: string | null = null;
    for (const [pi, ph] of phases.entries()) {
      const summary = await prisma.planTask.create({ data: { projectId: P[pk], name: ph, wbs: `${pi + 1}`, outlineLevel: 1, isSummary: true, start: cursor, finish: cursor, sortOrder: order++ } });
      let last: string | null = prevLast; let phaseEnd = cursor;
      for (let t = 1; t <= 3; t++) {
        const dur = 10 + Math.floor(rnd() * 25);
        const s = cursor, f = addDays(s, dur);
        const pct = f < TODAY ? 100 : s < TODAY ? Math.round(((TODAY.getTime() - s.getTime()) / (f.getTime() - s.getTime())) * 100 * (proj.health === "RED" ? 0.6 : 0.95)) : 0;
        const task = await prisma.planTask.create({ data: { projectId: P[pk], parentId: summary.id, name: `${ph} activity ${t}`, wbs: `${pi + 1}.${t}`, outlineLevel: 2, start: s, finish: f, durationDays: D(dur), percentComplete: Math.max(0, Math.min(100, pct)), workHours: D(dur * 8), resourceNames: [pick(["Ali Hassan", "Farida Maher", "Ziad Fathy", "Vendor team"])], sortOrder: order++, baselineStart: s, baselineFinish: addDays(f, proj.health === "RED" ? -14 : 0) } });
        if (last) await prisma.taskDependency.create({ data: { predecessorId: last, successorId: task.id, type: "FS", lagDays: D(0) } });
        last = task.id; cursor = f; phaseEnd = f;
      }
      await prisma.planTask.update({ where: { id: summary.id }, data: { finish: phaseEnd, durationDays: D(Math.round((phaseEnd.getTime() - summary.start.getTime()) / 86400000)) } });
      prevLast = last;
      if (pi === phases.length - 1) await prisma.planTask.create({ data: { projectId: P[pk], name: "Go-live", wbs: "6", isMilestone: true, start: phaseEnd, finish: phaseEnd, sortOrder: order++ } });
    }
  }

  // ── Resources & allocations ──
  const rates: Record<string, number> = { "Senior Developer": 650, "Mobile Developer": 550, "QA Engineer": 420, "Backend Developer": 550, "Business Analyst": 480, "Scrum Master": 520, "Product Owner": 600, "Project Manager": 700, "Senior Project Manager": 850 };
  const R: Record<string, string> = {};
  for (const [email, name, title, , dept] of people) {
    if (!rates[title]) continue;
    const k = email.split("@")[0];
    R[k] = (await prisma.resource.create({ data: { workspaceId: ws.id, userId: U[k], name, departmentId: depts[dept], jobTitle: title, grade: title.startsWith("Senior") ? "G7" : "G5", skills: title.includes("Developer") ? ["TypeScript", "Kotlin", "Swift", "Java"].slice(0, 2 + Math.floor(rnd() * 2)) : ["Agile", "Stakeholder management"], hourlyRate: D(rates[title]), dailyRate: D(rates[title] * 8), managerName: "Layla Hassan" } })).id;
  }
  for (const [n, title, rate] of [["Vendor Architect (Accenture)", "Solution Architect", 1400], ["Vendor Developer (IBM)", "Backend Developer", 900]] as const)
    R[n] = (await prisma.resource.create({ data: { workspaceId: ws.id, name: n, jobTitle: title, employmentType: "Contractor", hourlyRate: D(rate), dailyRate: D(rate * 8), skills: ["Java", "Integration"], departmentId: depts["Information Technology"] } })).id;
  const alloc = async (r: string, pk: string, pct: number, role: string) => {
    const proj = projects.find((x) => x.key === pk)!;
    const s = day(proj.start) > addDays(TODAY, -90) ? day(proj.start) : addDays(TODAY, -90);
    await prisma.resourceAllocation.create({ data: { resourceId: R[r], projectId: P[pk], percent: pct, startDate: s, endDate: day(proj.end), role, plannedHours: D(Math.round(((day(proj.end).getTime() - s.getTime()) / 86400000) * (5 / 7) * 8 * pct / 100)), actualHours: D(Math.round(((TODAY.getTime() - s.getTime()) / 86400000) * (5 / 7) * 8 * pct / 100 * 0.9)) } });
  };
  await alloc("sarah.ahmed", "MBM", 50, "Project Manager"); await alloc("sarah.ahmed", "DOB", 30, "Project Manager"); await alloc("sarah.ahmed", "HCM", 30, "Project Manager");
  await alloc("omar.khaled", "WCP", 50, "Project Manager"); await alloc("omar.khaled", "CBR", 50, "Project Manager");
  await alloc("mona.farouk", "AML", 60, "Project Manager"); await alloc("mona.farouk", "IFR", 30, "Project Manager");
  await alloc("ali.hassan", "DOB", 50, "Developer"); await alloc("ali.hassan", "CBR", 40, "Developer"); await alloc("ali.hassan", "MBM", 30, "Developer");
  await alloc("salma.reda", "DOB", 60, "Mobile Developer"); await alloc("salma.reda", "MBM", 40, "Mobile Developer");
  await alloc("farida.maher", "CBR", 80, "Backend Developer");
  await alloc("ziad.fathy", "DOB", 40, "QA"); await alloc("ziad.fathy", "AML", 30, "QA");
  await alloc("rana.adel", "MBM", 50, "BA"); await alloc("dina.ali", "DOB", 60, "PO"); await alloc("mahmoud.ezz", "DOB", 50, "SM");
  await alloc("Vendor Architect (Accenture)", "CBR", 100, "Architect"); await alloc("Vendor Developer (IBM)", "AML", 100, "Developer");
  await prisma.resourceLeave.create({ data: { resourceId: R["salma.reda"], startDate: addDays(TODAY, 5), endDate: addDays(TODAY, 12), reason: "Annual leave" } });

  // Change requests
  await prisma.changeRequest.create({ data: { projectId: P["DOB"], number: 1, title: "Add NFC passport chip reading", description: "Regulator recommends chip verification for eKYC.", category: "Scope", justification: "Reduces fraud; regulatory recommendation", scopeImpact: "New epic, ~40 points", scheduleImpactDays: 21, financialImpact: D(850000), resourceImpact: "+1 mobile developer for 6 weeks", riskImpact: "Device compatibility", status: "SUBMITTED", requesterId: U["dina.ali"], approvals: { create: [{ step: 1, approverRole: "PROJECT_MANAGER", approverId: U["sarah.ahmed"], decision: "APPROVED", decidedAt: addDays(TODAY, -2), comment: "Supported" }, { step: 2, approverRole: "FINANCE", decision: "PENDING" }, { step: 3, approverRole: "HEAD_OF_PMO", decision: "PENDING" }] } } });
  await prisma.changeRequest.create({ data: { projectId: P["AML"], number: 1, title: "Extend UAT by 3 weeks", category: "Schedule", justification: "Vendor delays", scheduleImpactDays: 21, financialImpact: D(400000), status: "APPROVED", requesterId: U["mona.farouk"], decidedAt: addDays(TODAY, -15), approvals: { create: [{ step: 1, approverRole: "HEAD_OF_PMO", approverId: U["layla.hassan"], decision: "APPROVED", decidedAt: addDays(TODAY, -15) }] } } });

  // Requirements traceability
  const mbmEpics = await prisma.issue.findMany({ where: { projectId: P["MBM"], type: { name: "Epic" } }, orderBy: { number: "asc" } });
  for (const [i, e] of mbmEpics.entries()) {
    const stories = await prisma.issue.findMany({ where: { parentId: e.id }, take: 3, select: { key: true } });
    await prisma.requirement.create({ data: { projectId: P["MBM"], code: `BR-${String(i + 1).padStart(3, "0")}`, title: `Business requirement: ${e.summary}`, objectiveCode: "SO-1", issueKeys: [e.key, ...stories.map((s) => s.key)], testRef: i < 2 ? `TC-${100 + i}` : null, status: i < 2 ? "APPROVED" : "DRAFT" } });
  }

  // Notifications
  for (const k of ["sarah.ahmed", "layla.hassan", "salma.reda"]) {
    await prisma.notification.create({ data: { userId: U[k], kind: "approval", title: "Approval needed: DOB-CR-1 Add NFC passport chip reading", link: "/governance", dedupeKey: "seed:1" } });
  }
  await prisma.savedFilter.create({ data: { workspaceId: ws.id, ownerId: U["sarah.ahmed"], name: "Open show-stoppers", jql: "showStopper = true AND statusCategory != Done ORDER BY priority", shared: true } });
  await prisma.savedFilter.create({ data: { workspaceId: ws.id, ownerId: U["sarah.ahmed"], name: "My open work", jql: "assignee = currentUser() AND statusCategory != Done ORDER BY dueDate", shared: true } });

  await prisma.auditLog.create({ data: { workspaceId: ws.id, eventType: "system.seeded", entityType: "Workspace", entityId: ws.id, after: { projects: projects.length } } });
  console.log(`Seeded. Sign in with any demo user, e.g. layla.hassan@epm.local / ${DEMO_PASSWORD}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
