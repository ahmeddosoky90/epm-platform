import { XMLParser, XMLBuilder } from "fast-xml-parser";

/**
 * Microsoft Project XML (MSPDI) import/export.
 * MSPDI is the documented XML format that MS Project saves via File → Save As → XML.
 * Native .mpp is a proprietary binary (OLE compound) format; it is NOT parsed here — users
 * save as XML first. See docs/IMPLEMENTATION_PLAN.md "MS Project".
 */
export interface MspTask {
  uid: string; id: number; name: string; wbs: string | null; outlineLevel: number; start: Date; finish: Date;
  durationDays: number; percentComplete: number; isMilestone: boolean; isSummary: boolean; workHours: number;
  baselineStart: Date | null; baselineFinish: Date | null; resourceNames: string[]; notes: string | null;
}
export interface MspLink { predecessorUid: string; successorUid: string; type: "FF" | "FS" | "SF" | "SS"; lagDays: number }
export interface MspProject { name: string | null; startDate: Date | null; finishDate: Date | null; minutesPerDay: number; tasks: MspTask[]; links: MspLink[]; warnings: string[] }

export class MspdiError extends Error {}

const LINK_TYPES = ["FF", "FS", "SF", "SS"] as const; // MSPDI Type 0..3
const arr = <T,>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

/** ISO-8601 duration as used by MSPDI ("PT40H0M0S", "P2DT4H") → hours. */
export function durationHours(v: unknown): number {
  if (typeof v !== "string") return 0;
  const m = /^-?P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(v.trim());
  if (!m) return 0;
  return Number(m[1] ?? 0) * 24 + Number(m[2] ?? 0) + Number(m[3] ?? 0) / 60 + Number(m[4] ?? 0) / 3600;
}
const date = (v: unknown): Date | null => { if (typeof v !== "string" || !v) return null; const d = new Date(v.length === 19 ? v + "Z" : v); return isNaN(d.getTime()) ? null : d; };
const bool = (v: unknown) => v === 1 || v === "1" || v === true || v === "true";

export function parseMspdi(xml: string): MspProject {
  if (xml.length > 20 * 1024 * 1024) throw new MspdiError("File too large (max 20 MB)");
  if (/<!DOCTYPE|<!ENTITY/i.test(xml.slice(0, 4096))) throw new MspdiError("DTDs and entities are not allowed in project XML");
  const doc = new XMLParser({ ignoreAttributes: true, parseTagValue: false, trimValues: true, processEntities: false }).parse(xml);
  const p = doc?.Project;
  if (!p || !p.Tasks) throw new MspdiError("Not a Microsoft Project XML file: missing <Project><Tasks>. In MS Project use File → Save As → XML Format (*.xml).");
  const minutesPerDay = Number(p.MinutesPerDay ?? 480) || 480;
  const warnings: string[] = [];
  const resources = new Map(arr(p.Resources?.Resource).map((r: Record<string, unknown>) => [String(r.UID), String(r.Name ?? "")]));
  const assigned = new Map<string, string[]>();
  for (const a of arr(p.Assignments?.Assignment) as Record<string, unknown>[]) {
    const name = resources.get(String(a.ResourceUID)); if (!name) continue;
    assigned.set(String(a.TaskUID), [...(assigned.get(String(a.TaskUID)) ?? []), name]);
  }
  const tasks: MspTask[] = []; const links: MspLink[] = [];
  for (const t of arr(p.Tasks.Task) as Record<string, unknown>[]) {
    const uid = String(t.UID ?? "");
    if (uid === "0" || bool(t.IsNull)) continue; // UID 0 is the project summary task
    const start = date(t.Start), finish = date(t.Finish);
    if (!start || !finish) { warnings.push(`Task ${uid} "${t.Name ?? ""}" skipped: no start/finish`); continue; }
    const baseline = arr(t.Baseline as Record<string, unknown> | Record<string, unknown>[]).find((b) => String(b.Number ?? "0") === "0");
    tasks.push({
      uid, id: Number(t.ID ?? 0), name: String(t.Name ?? "(unnamed)").slice(0, 300), wbs: t.WBS ? String(t.WBS) : null, outlineLevel: Math.max(1, Number(t.OutlineLevel ?? 1)),
      start, finish: finish < start ? start : finish, durationDays: Math.round((durationHours(t.Duration) / (minutesPerDay / 60)) * 100) / 100,
      percentComplete: Math.min(100, Math.max(0, Number(t.PercentComplete ?? 0))), isMilestone: bool(t.Milestone), isSummary: bool(t.Summary),
      workHours: Math.round(durationHours(t.Work) * 100) / 100, baselineStart: date(baseline?.Start), baselineFinish: date(baseline?.Finish),
      resourceNames: assigned.get(uid) ?? [], notes: t.Notes ? String(t.Notes).slice(0, 4000) : null,
    });
    for (const l of arr(t.PredecessorLink) as Record<string, unknown>[]) {
      const type = LINK_TYPES[Number(l.Type ?? 1)] ?? "FS";
      // LinkLag is in tenths of a minute; LagFormat 7 = days etc. We convert to working days.
      const lagDays = Math.round(((Number(l.LinkLag ?? 0) / 10) / minutesPerDay) * 100) / 100;
      links.push({ predecessorUid: String(l.PredecessorUID), successorUid: uid, type, lagDays });
    }
  }
  if (!tasks.length) throw new MspdiError("The file contains no tasks");
  const uids = new Set(tasks.map((t) => t.uid));
  const valid = links.filter((l) => uids.has(l.predecessorUid) && uids.has(l.successorUid));
  if (valid.length < links.length) warnings.push(`${links.length - valid.length} dependency link(s) referenced missing tasks and were ignored`);
  return { name: p.Title ?? p.Name ?? null, startDate: date(p.StartDate), finishDate: date(p.FinishDate), minutesPerDay, tasks, links: valid, warnings };
}

/** Derive parent UIDs from outline levels (MSPDI order is outline order). */
export function parentsByOutline(tasks: { uid: string; outlineLevel: number }[]) {
  const stack: { uid: string; level: number }[] = []; const parent = new Map<string, string | null>();
  for (const t of tasks) {
    while (stack.length && stack[stack.length - 1].level >= t.outlineLevel) stack.pop();
    parent.set(t.uid, stack.length ? stack[stack.length - 1].uid : null);
    stack.push({ uid: t.uid, level: t.outlineLevel });
  }
  return parent;
}

const iso = (d: Date) => d.toISOString().slice(0, 19);
const hrs = (h: number) => `PT${Math.floor(h)}H${Math.round((h % 1) * 60)}M0S`;

export function buildMspdi(project: { name: string; start: Date | null; minutesPerDay?: number }, tasks: { uid: number; name: string; wbs: string | null; outlineLevel: number; start: Date; finish: Date; durationDays: number; percentComplete: number; isMilestone: boolean; isSummary: boolean; workHours: number; baselineStart: Date | null; baselineFinish: Date | null; preds: { uid: number; type: string; lagDays: number }[] }[]) {
  const mpd = project.minutesPerDay ?? 480;
  const body = {
    "?xml": { "@_version": "1.0", "@_encoding": "UTF-8", "@_standalone": "yes" },
    Project: {
      "@_xmlns": "http://schemas.microsoft.com/project",
      SaveVersion: 14, Name: project.name, Title: project.name, ScheduleFromStart: 1, StartDate: project.start ? iso(project.start) : undefined, MinutesPerDay: mpd, MinutesPerWeek: mpd * 5, DaysPerMonth: 20,
      Tasks: { Task: tasks.map((t, i) => ({
        UID: t.uid, ID: i + 1, Name: t.name, WBS: t.wbs ?? undefined, OutlineLevel: t.outlineLevel, Start: iso(t.start), Finish: iso(t.finish),
        Duration: hrs(t.durationDays * (mpd / 60)), DurationFormat: 7, Work: hrs(t.workHours), PercentComplete: t.percentComplete, Milestone: t.isMilestone ? 1 : 0, Summary: t.isSummary ? 1 : 0,
        PredecessorLink: t.preds.map((p) => ({ PredecessorUID: p.uid, Type: Math.max(0, LINK_TYPES.indexOf(p.type as never)), LinkLag: Math.round(p.lagDays * mpd * 10), LagFormat: 7 })),
        Baseline: t.baselineStart && t.baselineFinish ? { Number: 0, Start: iso(t.baselineStart), Finish: iso(t.baselineFinish) } : undefined,
      })) },
    },
  };
  return new XMLBuilder({ ignoreAttributes: false, format: true, suppressEmptyNode: true }).build(body) as string;
}
