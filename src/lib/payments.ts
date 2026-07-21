import type { ISODate, Minor } from './types';
import { dueDates } from './recurrence';

// Ödemeler / obligations math (v1.3), pure and unit-tested. Credit cards and
// installment debts recur monthly on a day; one-off planned payments have a
// single date. The forecast merges these with recurring rules at the repo
// layer; the pure pieces (occurrence dates, payoff math) live here.

export type ObligationKind = 'kart' | 'borc' | 'planli';

/** Structural subset an obligation needs for scheduling. */
export interface ObligationTiming {
  kind: ObligationKind;
  dayOfMonth?: number; // kart / recurring borc (clamped to month end, §17)
  dueDate?: ISODate; // planli one-off
  lastPostedDate?: ISODate; // advances as monthly occurrences are confirmed
  isActive: boolean;
}

/**
 * Occurrence dates of one obligation within (afterExclusive?, toInclusive].
 * Monthly kinds reuse the recurrence engine so day 29–31 clamps identically;
 * planli returns its single date when it falls in the window.
 */
export function obligationDueDates(
  ob: ObligationTiming,
  windowStart: ISODate,
  windowEnd: ISODate,
): ISODate[] {
  if (!ob.isActive) return [];
  if (ob.kind === 'planli') {
    return ob.dueDate && ob.dueDate >= windowStart && ob.dueDate <= windowEnd
      ? [ob.dueDate]
      : [];
  }
  if (ob.dayOfMonth === undefined) return []; // open-balance debt: no schedule
  // Exclude anything already posted; the day before windowStart is the lower
  // bound so an occurrence exactly on windowStart is still included.
  const after =
    ob.lastPostedDate && ob.lastPostedDate > isoBefore(windowStart)
      ? ob.lastPostedDate
      : isoBefore(windowStart);
  return dueDates({ cadence: 'monthly', dayOfMonth: ob.dayOfMonth }, after, windowEnd);
}

/** One day before an ISO date, purely lexical-safe via Date. */
function isoBefore(date: ISODate): ISODate {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y!, m! - 1, d! - 1);
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${dt.getFullYear()}-${mm}-${dd}`;
}

/** A payment never drives a debt below zero (§17-style guard). */
export function applyPayment(remainingMinor: Minor, amountMinor: Minor): Minor {
  return Math.max(0, remainingMinor - amountMinor);
}

/** Whole installments left at the current payment size (0 if paid off). */
export function installmentsLeft(
  remainingMinor: Minor,
  amountMinor: Minor,
): number {
  if (remainingMinor <= 0 || amountMinor <= 0) return 0;
  return Math.ceil(remainingMinor / amountMinor);
}

export interface ForecastEntry {
  date: ISODate;
  title: string;
  amountMinor: Minor;
  kind: 'abonelik' | 'sabit' | ObligationKind;
  sourceId: string;
}

/** Sorts merged forecast entries by date then title (stable, display-ready). */
export function sortForecast(entries: ForecastEntry[]): ForecastEntry[] {
  return [...entries].sort(
    (a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, 'tr'),
  );
}

/** Total of a forecast slice. */
export function forecastTotal(entries: ForecastEntry[]): Minor {
  return entries.reduce((sum, e) => sum + e.amountMinor, 0);
}
