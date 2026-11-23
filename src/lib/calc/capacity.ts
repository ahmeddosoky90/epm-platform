/** Working-day calendar maths for resource capacity (BRD 12.3). */
export interface Calendar { workingDays: number[]; hoursPerDay: number; holidays: Date[] }
const dayKey = (d: Date) => d.toISOString().slice(0, 10);

export function workingDaysBetween(start: Date, end: Date, cal: Calendar, leaves: { start: Date; end: Date }[] = []): number {
  const hol = new Set(cal.holidays.map(dayKey));
  let n = 0;
  const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const e = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  while (d <= e) {
    const onLeave = leaves.some((l) => d >= l.start && d <= l.end);
    if (cal.workingDays.includes(d.getUTCDay()) && !hol.has(dayKey(d)) && !onLeave) n++;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return n;
}

export interface AllocationLike { percent: number; startDate: Date; endDate: Date; projectId?: string }

/** Capacity for a period: available hours, allocated hours, remaining %, overallocation flag. */
export function capacityForPeriod(
  periodStart: Date, periodEnd: Date, cal: Calendar, allocations: AllocationLike[], leaves: { start: Date; end: Date }[] = [],
) {
  const availDays = workingDaysBetween(periodStart, periodEnd, cal, leaves);
  const availableHours = availDays * cal.hoursPerDay;
  let allocatedHours = 0;
  for (const a of allocations) {
    const s = a.startDate > periodStart ? a.startDate : periodStart;
    const e = a.endDate < periodEnd ? a.endDate : periodEnd;
    if (s > e) continue;
    allocatedHours += workingDaysBetween(s, e, cal, leaves) * cal.hoursPerDay * (a.percent / 100);
  }
  const utilisation = availableHours === 0 ? 0 : (allocatedHours / availableHours) * 100;
  return {
    availableHours, allocatedHours: Math.round(allocatedHours * 100) / 100,
    utilisation: Math.round(utilisation * 10) / 10,
    remainingPercent: Math.round((100 - utilisation) * 10) / 10,
    overallocated: utilisation > 100.0001,
  };
}
