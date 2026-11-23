import { describe, it, expect } from "vitest";
import { financialSummary, laborCost, toBase, plannedPercentAt } from "@/lib/calc/finance";
import { riskScore, riskBand } from "@/lib/calc/risk";
import { weightedScore, rankProjects } from "@/lib/calc/prioritization";
import { workingDaysBetween, capacityForPeriod } from "@/lib/calc/capacity";
import { evaluateTransition, wouldCreateCycle, suggestProjectKey, type TransitionRule } from "@/lib/calc/workflow";
import { burndown, velocity, flowTimes } from "@/lib/calc/agile";

const d = (s: string) => new Date(s + "T00:00:00Z");

describe("finance (BRD 11)", () => {
  it("computes variances, EAC, EV, CPI and SPI with decimals", () => {
    const s = financialSummary({ approvedBudget: "25000000", actual: "10000000", committed: "2000000", remainingForecast: "16000000", percentComplete: 40, plannedPercent: 50 });
    expect(s.budgetVariance.toString()).toBe("15000000");
    expect(s.eac.toString()).toBe("26000000");
    expect(s.forecastVariance.toString()).toBe("-1000000");
    expect(s.earnedValue.toString()).toBe("10000000");
    expect(s.plannedValue.toString()).toBe("12500000");
    expect(s.cpi?.toString()).toBe("1");
    expect(s.spi?.toString()).toBe("0.8");
    expect(s.burnPercent.toString()).toBe("40");
  });
  it("returns null indices instead of dividing by zero", () => {
    const s = financialSummary({ approvedBudget: 0, actual: 0, committed: 0, remainingForecast: 0, percentComplete: 0, plannedPercent: 0 });
    expect(s.cpi).toBeNull(); expect(s.spi).toBeNull(); expect(s.burnPercent.toString()).toBe("0");
  });
  it("labor cost matches the BRD example and avoids float error", () => {
    expect(laborCost(80, 500).toString()).toBe("40000");
    expect(toBase("0.1", "0.2").toString()).toBe("0.02");
  });
  it("planned percent is linear and clamped", () => {
    expect(plannedPercentAt(d("2027-01-01"), d("2027-01-11"), d("2027-01-06"))).toBe(50);
    expect(plannedPercentAt(d("2027-01-01"), d("2027-01-11"), d("2026-01-01"))).toBe(0);
    expect(plannedPercentAt(d("2027-01-01"), d("2027-01-11"), d("2028-01-01"))).toBe(100);
    expect(plannedPercentAt(null, null)).toBe(0);
  });
});

describe("risk matrix", () => {
  it("scores probability × impact and bands it", () => {
    expect(riskScore(5, 5)).toBe(25); expect(riskBand(25).label).toBe("Critical");
    expect(riskBand(riskScore(2, 4)).label).toBe("High");
    expect(riskBand(riskScore(2, 2)).label).toBe("Medium");
    expect(riskBand(1).label).toBe("Low");
  });
  it("rejects values outside 1..5", () => { expect(() => riskScore(0, 3)).toThrow(); expect(() => riskScore(3, 6)).toThrow(); expect(() => riskScore(2.5, 3)).toThrow(); });
});

describe("prioritisation", () => {
  it("weights scores to 0..100 and clamps inputs", () => {
    const c = [{ id: "a", weight: 60 }, { id: "b", weight: 40 }];
    expect(weightedScore(c, { a: 10, b: 5 })).toBe(80);
    expect(weightedScore(c, { a: 15, b: -3 })).toBe(60);
    expect(weightedScore([], {})).toBe(0);
  });
  it("puts overrides at their requested rank", () => {
    const r = rankProjects([{ id: "x", score: 90 }, { id: "y", score: 80 }, { id: "z", score: 10, override: 1 }]);
    expect(r.map((p) => p.id)).toEqual(["z", "x", "y"]); expect(r.map((p) => p.rank)).toEqual([1, 2, 3]);
  });
});

describe("capacity", () => {
  const cal = { workingDays: [0, 1, 2, 3, 4], hoursPerDay: 8, holidays: [d("2027-01-07")] }; // Sun–Thu week
  it("counts working days excluding weekends, holidays and leave", () => {
    // 2027-01-03 (Sun) .. 2027-01-09 (Sat): Sun–Thu = 5 days, minus holiday Thu 7th = 4
    expect(workingDaysBetween(d("2027-01-03"), d("2027-01-09"), cal)).toBe(4);
    expect(workingDaysBetween(d("2027-01-03"), d("2027-01-09"), cal, [{ start: d("2027-01-04"), end: d("2027-01-04") }])).toBe(3);
  });
  it("flags over-allocation above 100%", () => {
    const a = [{ percent: 60, startDate: d("2027-01-03"), endDate: d("2027-01-09") }, { percent: 50, startDate: d("2027-01-03"), endDate: d("2027-01-09") }];
    const c = capacityForPeriod(d("2027-01-03"), d("2027-01-09"), cal, a);
    expect(c.availableHours).toBe(32); expect(c.utilisation).toBe(110); expect(c.overallocated).toBe(true);
    expect(capacityForPeriod(d("2027-01-03"), d("2027-01-09"), cal, a.slice(0, 1)).overallocated).toBe(false);
  });
});

describe("workflow rules", () => {
  const t: TransitionRule = { id: "t", name: "Close", fromStatusId: "review", toStatusId: "done", allowedRoles: ["PROJECT_MANAGER"], requiredFields: ["resolution"], conditions: { noOpenBlockers: true, requireApproval: true } };
  const issue = { statusId: "review", assigneeId: "u1", resolution: null };
  it("reports every failed condition", () => {
    const e = evaluateTransition({ ...issue, statusId: "todo" }, t, { userId: "u2", roleKey: "TEAM_MEMBER", isSuper: false }, { openBlockers: 2 });
    expect(e).toHaveLength(5);
  });
  it("passes when conditions are met, using patched fields", () => {
    expect(evaluateTransition(issue, t, { userId: "u2", roleKey: "PROJECT_MANAGER", isSuper: false }, { openBlockers: 0, approved: true, patch: { resolution: "Fixed" } })).toEqual([]);
  });
  it("super users bypass role restrictions but not data rules", () => {
    const e = evaluateTransition(issue, t, { userId: "x", roleKey: "TEAM_MEMBER", isSuper: true }, { openBlockers: 0, approved: true });
    expect(e).toEqual(['Field "resolution" is required']);
  });
  it("detects cycles", () => {
    const edges = [{ from: "a", to: "b" }, { from: "b", to: "c" }];
    expect(wouldCreateCycle(edges, "c", "a")).toBe(true); expect(wouldCreateCycle(edges, "a", "c")).toBe(false); expect(wouldCreateCycle(edges, "a", "a")).toBe(true);
  });
  it("suggests project keys", () => {
    expect(suggestProjectKey("Mobile Banking Modernisation")).toBe("MBM");
    expect(suggestProjectKey("Payments")).toBe("PAYM");
    expect(suggestProjectKey("2027 core upgrade")).toBe("P2CU");
  });
});

describe("agile metrics", () => {
  it("builds a burndown with scope changes", () => {
    const ev = [{ kind: "ADDED" as const, points: 20, at: d("2027-01-01") }, { kind: "COMPLETED" as const, points: 5, at: new Date("2027-01-02T10:00:00Z") }, { kind: "ADDED" as const, points: 3, at: new Date("2027-01-03T10:00:00Z") }];
    const b = burndown(d("2027-01-01"), d("2027-01-05"), ev, d("2027-01-03"));
    expect(b).toHaveLength(5);
    expect(b[0]).toMatchObject({ remaining: 20, ideal: 20 }); expect(b[1].remaining).toBe(15); expect(b[2].remaining).toBe(18);
    expect(b[3].remaining).toBeNull(); expect(b[4].ideal).toBe(0);
  });
  it("averages velocity and measures flow", () => {
    expect(velocity([{ name: "S1", committed: 20, completed: 18 }, { name: "S2", committed: 20, completed: 21 }]).average).toBe(19.5);
    const f = flowTimes(d("2027-01-01"), [{ to: "In progress", category: "IN_PROGRESS", at: d("2027-01-03") }, { to: "Done", category: "DONE", at: d("2027-01-06") }]);
    expect(f).toMatchObject({ leadDays: 5, cycleDays: 3 });
    expect(flowTimes(d("2027-01-01"), [])).toBeNull();
  });
});
