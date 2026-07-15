import { addDays, addMonths, format, getDaysInMonth, startOfMonth } from 'date-fns';
import type { ISODate, Minor } from './types';
import { parseLocalDate } from './dates';

// Recurrence engine (§8.7), pure and unit-tested. The repo layer feeds it
// (lastPostedDate, today] windows; idempotency falls out of the exclusive
// lower bound — an already-posted date can never be produced again.

/** Structural subset of RecurringRule that the timing math needs. */
export interface RuleTiming {
  cadence: 'monthly' | 'weekly' | 'yearly';
  dayOfMonth?: number; // monthly/yearly; 29–31 clamp to month end (§17)
  month?: number; // yearly: 1–12
  weekday?: number; // weekly: 1 (Mon) – 7 (Sun)
}

function isoWeekday(d: Date): number {
  return ((d.getDay() + 6) % 7) + 1; // JS 0=Sun → ISO 1=Mon..7=Sun
}

function clampedDate(year: number, monthIndex0: number, day: number): Date {
  const dim = getDaysInMonth(new Date(year, monthIndex0, 1));
  return new Date(year, monthIndex0, Math.min(day, dim));
}

function toISO(d: Date): ISODate {
  return format(d, 'yyyy-MM-dd');
}

/** All due dates in the window (afterExclusive, toInclusive]. */
export function dueDates(
  timing: RuleTiming,
  afterExclusive: ISODate,
  toInclusive: ISODate,
): ISODate[] {
  const after = parseLocalDate(afterExclusive);
  const to = parseLocalDate(toInclusive);
  if (to <= after) return [];
  const result: ISODate[] = [];

  if (timing.cadence === 'monthly') {
    const day = timing.dayOfMonth ?? 1;
    for (let d = startOfMonth(after); d <= to; d = addMonths(d, 1)) {
      const candidate = clampedDate(d.getFullYear(), d.getMonth(), day);
      if (candidate > after && candidate <= to) result.push(toISO(candidate));
    }
  } else if (timing.cadence === 'weekly') {
    const weekday = timing.weekday ?? 1;
    const first = addDays(after, 1);
    let d = addDays(first, (weekday - isoWeekday(first) + 7) % 7);
    for (; d <= to; d = addDays(d, 7)) result.push(toISO(d));
  } else {
    const day = timing.dayOfMonth ?? 1;
    const monthIndex0 = (timing.month ?? 1) - 1;
    for (let y = after.getFullYear(); y <= to.getFullYear(); y++) {
      const candidate = clampedDate(y, monthIndex0, day);
      if (candidate > after && candidate <= to) result.push(toISO(candidate));
    }
  }
  return result;
}

/** First due date strictly after the given date, or null (horizon 2 years). */
export function nextDueDate(
  timing: RuleTiming,
  afterExclusive: ISODate,
): ISODate | null {
  const horizon = toISO(addDays(parseLocalDate(afterExclusive), 750));
  return dueDates(timing, afterExclusive, horizon)[0] ?? null;
}

/** Yearly cost of a rule — the "Yıllık Şok" number (§9.6). */
export function annualizedMinor(
  cadence: RuleTiming['cadence'],
  amountMinor: Minor,
): Minor {
  if (cadence === 'monthly') return amountMinor * 12;
  if (cadence === 'weekly') return amountMinor * 52;
  return amountMinor;
}

/** Normalized monthly cost for the subscriptions total (§9.6). */
export function monthlyizedMinor(
  cadence: RuleTiming['cadence'],
  amountMinor: Minor,
): Minor {
  if (cadence === 'monthly') return amountMinor;
  if (cadence === 'weekly') return Math.round((amountMinor * 52) / 12);
  return Math.round(amountMinor / 12);
}
