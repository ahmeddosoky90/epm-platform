import { D, sum, type Dec } from "./money";
import type { Prisma } from "@prisma/client";

type V = Prisma.Decimal.Value;

export interface FinancialSummaryInput {
  approvedBudget: V;
  actual: V;           // sum of ACTUAL transactions
  committed: V;        // sum of COMMITTED transactions not yet actualised
  remainingForecast: V; // forecast of cost still to be incurred
  percentComplete: number; // 0..100 (earned value basis)
  plannedPercent: number;  // 0..100 planned completion at status date
}

export interface FinancialSummary {
  approved: Dec; actual: Dec; committed: Dec; forecastTotal: Dec;
  budgetVariance: Dec; forecastVariance: Dec; eac: Dec;
  earnedValue: Dec; plannedValue: Dec; cpi: Dec | null; spi: Dec | null;
  burnPercent: Dec;
}

/**
 * BRD 11.4:
 *  Budget Variance   = Approved - Actual
 *  Forecast Variance = Approved - Forecast expenditure (EAC)
 *  EAC               = Actual + Remaining forecast
 *  CPI = EV / AC, SPI = EV / PV, EV = Approved × %complete, PV = Approved × planned %
 */
export function financialSummary(i: FinancialSummaryInput): FinancialSummary {
  const approved = D(i.approvedBudget), actual = D(i.actual), committed = D(i.committed);
  const eac = actual.plus(D(i.remainingForecast));
  const ev = approved.times(i.percentComplete).dividedBy(100);
  const pv = approved.times(i.plannedPercent).dividedBy(100);
  return {
    approved, actual, committed, forecastTotal: eac,
    budgetVariance: approved.minus(actual),
    forecastVariance: approved.minus(eac),
    eac,
    earnedValue: ev.toDecimalPlaces(2),
    plannedValue: pv.toDecimalPlaces(2),
    cpi: actual.isZero() ? null : ev.dividedBy(actual).toDecimalPlaces(3),
    spi: pv.isZero() ? null : ev.dividedBy(pv).toDecimalPlaces(3),
    burnPercent: approved.isZero() ? D(0) : actual.dividedBy(approved).times(100).toDecimalPlaces(1),
  };
}

/** Labor cost = hours × hourly rate (BRD 11.3: 80h × 500 = 40,000). */
export const laborCost = (hours: V, hourlyRate: V) => D(hours).times(D(hourlyRate)).toDecimalPlaces(2);

/** Convert an amount to workspace base currency. rateToBase = units of base per 1 unit of currency. */
export const toBase = (amount: V, rateToBase: V) => D(amount).times(D(rateToBase)).toDecimalPlaces(2);

/** Planned % at a date assuming linear plan between start and end. */
export function plannedPercentAt(start: Date | null, end: Date | null, at = new Date()): number {
  if (!start || !end) return 0;
  const total = end.getTime() - start.getTime();
  if (total <= 0) return at >= end ? 100 : 0;
  return Math.max(0, Math.min(100, ((at.getTime() - start.getTime()) / total) * 100));
}

export { sum };
