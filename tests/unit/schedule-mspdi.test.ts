import { describe, it, expect } from "vitest";
import { criticalPath, linkCreatesCycle, rollUp } from "@/lib/calc/schedule";
import { parseMspdi, buildMspdi, parentsByOutline, durationHours, MspdiError } from "@/lib/msproject/mspdi";

const d = (s: string) => new Date(s + "T00:00:00Z");

describe("critical path", () => {
  // A(0-5) → B(5-8) → D(8-10);  A → C(5-6) → D.  C has 2 days float.
  const tasks = [
    { id: "A", start: d("2027-01-01"), finish: d("2027-01-06") }, { id: "B", start: d("2027-01-06"), finish: d("2027-01-09") },
    { id: "C", start: d("2027-01-06"), finish: d("2027-01-07") }, { id: "D", start: d("2027-01-09"), finish: d("2027-01-11") },
    { id: "S", start: d("2027-01-01"), finish: d("2027-01-11"), isSummary: true },
  ];
  const links = [["A", "B"], ["B", "D"], ["A", "C"], ["C", "D"]].map(([p, s]) => ({ predecessorId: p, successorId: s, type: "FS", lagDays: 0 }));
  it("marks the zero-float chain as critical", () => {
    const r = criticalPath(tasks, links);
    expect(["A", "B", "D"].every((id) => r.get(id)!.critical)).toBe(true);
    expect(r.get("C")!.critical).toBe(false); expect(r.get("C")!.totalFloat).toBe(2);
    expect(r.has("S")).toBe(false);
  });
  it("applies lag and SS links", () => {
    const r = criticalPath(tasks.slice(0, 2), [{ predecessorId: "A", successorId: "B", type: "SS", lagDays: 7 }]);
    expect(r.get("B")!.es).toBe(7);
  });
  it("detects dependency cycles", () => { expect(linkCreatesCycle(links, "D", "A")).toBe(true); expect(linkCreatesCycle(links, "A", "D")).toBe(false); });
  it("rolls summary dates and duration-weighted progress up", () => {
    const r = rollUp([
      { id: "P", parentId: null, start: d("2027-02-01"), finish: d("2027-02-02"), percentComplete: 0, isSummary: true },
      { id: "c1", parentId: "P", start: d("2027-01-01"), finish: d("2027-01-04"), percentComplete: 100, isSummary: false },
      { id: "c2", parentId: "P", start: d("2027-01-04"), finish: d("2027-01-05"), percentComplete: 0, isSummary: false },
    ]);
    expect(r[0].start.toISOString().slice(0, 10)).toBe("2027-01-01"); expect(r[0].finish.toISOString().slice(0, 10)).toBe("2027-01-05"); expect(r[0].percentComplete).toBe(75);
  });
});

const XML = `<?xml version="1.0"?><Project xmlns="http://schemas.microsoft.com/project"><Title>MBM</Title><MinutesPerDay>480</MinutesPerDay>
<Resources><Resource><UID>1</UID><Name>Sarah Ahmed</Name></Resource></Resources>
<Tasks>
<Task><UID>0</UID><ID>0</ID><Name>MBM</Name><Start>2027-01-03T08:00:00</Start><Finish>2027-01-20T17:00:00</Finish></Task>
<Task><UID>1</UID><ID>1</ID><Name>Design</Name><OutlineLevel>1</OutlineLevel><Summary>1</Summary><Start>2027-01-03T08:00:00</Start><Finish>2027-01-10T17:00:00</Finish><Duration>PT48H0M0S</Duration></Task>
<Task><UID>2</UID><ID>2</ID><Name>Wireframes</Name><OutlineLevel>2</OutlineLevel><Start>2027-01-03T08:00:00</Start><Finish>2027-01-05T17:00:00</Finish><Duration>PT24H0M0S</Duration><PercentComplete>50</PercentComplete><Work>PT24H0M0S</Work></Task>
<Task><UID>3</UID><ID>3</ID><Name>Sign-off</Name><OutlineLevel>2</OutlineLevel><Milestone>1</Milestone><Start>2027-01-10T17:00:00</Start><Finish>2027-01-10T17:00:00</Finish><Duration>PT0H0M0S</Duration>
  <PredecessorLink><PredecessorUID>2</PredecessorUID><Type>1</Type><LinkLag>9600</LinkLag></PredecessorLink><PredecessorLink><PredecessorUID>99</PredecessorUID><Type>1</Type></PredecessorLink></Task>
</Tasks><Assignments><Assignment><TaskUID>2</TaskUID><ResourceUID>1</ResourceUID></Assignment></Assignments></Project>`;

describe("MS Project XML", () => {
  it("parses tasks, outline, links, lag and resources", () => {
    const p = parseMspdi(XML);
    expect(p.name).toBe("MBM"); expect(p.tasks.map((t) => t.uid)).toEqual(["1", "2", "3"]);
    const w = p.tasks[1]; expect(w.durationDays).toBe(3); expect(w.percentComplete).toBe(50); expect(w.resourceNames).toEqual(["Sarah Ahmed"]);
    expect(p.tasks[2].isMilestone).toBe(true);
    expect(p.links).toEqual([{ predecessorUid: "2", successorUid: "3", type: "FS", lagDays: 2 }]);
    expect(p.warnings.join()).toMatch(/missing tasks/);
    expect([...parentsByOutline(p.tasks).entries()]).toEqual([["1", null], ["2", "1"], ["3", "1"]]);
  });
  it("round-trips through export", () => {
    const p = parseMspdi(XML);
    const xml = buildMspdi({ name: "MBM", start: p.startDate }, p.tasks.map((t) => ({ ...t, uid: Number(t.uid), preds: p.links.filter((l) => l.successorUid === t.uid).map((l) => ({ uid: Number(l.predecessorUid), type: l.type, lagDays: l.lagDays })) })));
    const q = parseMspdi(xml);
    expect(q.tasks.map((t) => [t.name, t.outlineLevel, t.durationDays])).toEqual(p.tasks.map((t) => [t.name, t.outlineLevel, t.durationDays]));
    expect(q.links).toEqual(p.links);
  });
  it("rejects DTDs, non-project XML and empty plans", () => {
    expect(() => parseMspdi(`<?xml version="1.0"?><!DOCTYPE x [<!ENTITY a "b">]><Project><Tasks/></Project>`)).toThrow(MspdiError);
    expect(() => parseMspdi("<root/>")).toThrow(/Save As/);
    expect(() => parseMspdi("<Project><Tasks><Task><UID>0</UID></Task></Tasks></Project>")).toThrow(/no tasks/);
  });
  it("parses ISO durations", () => { expect(durationHours("PT40H0M0S")).toBe(40); expect(durationHours("P1DT2H30M0S")).toBe(26.5); expect(durationHours("bad")).toBe(0); });
});
