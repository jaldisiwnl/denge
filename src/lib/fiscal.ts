import { addDays, addMonths, differenceInCalendarDays, format, getDaysInMonth } from 'date-fns';
import type { ISODate, MonthKey } from './types';

// Fiscal month math (spec §8.1). monthStartDay = d means fiscal month
// "2026-07" spans Jul d → Aug (d−1). The MonthKey names the calendar month
// the fiscal month STARTS in. Settings cap d at 28, but every function still
// clamps d to the month's length defensively.

/** Parses "YYYY-MM-DD" as a local Date (never UTC — dates are local, §6). */
function parseLocal(date: ISODate): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y!, m! - 1, d!);
}

function toISO(date: Date): ISODate {
  return format(date, 'yyyy-MM-dd');
}

/** First day of the fiscal month starting in (year, monthIndex0). */
function clampedStart(year: number, monthIndex0: number, startDay: number): Date {
  const firstOfMonth = new Date(year, monthIndex0, 1);
  return new Date(year, monthIndex0, Math.min(startDay, getDaysInMonth(firstOfMonth)));
}

/** Which fiscal month does this date belong to? */
export function getMonthKey(date: ISODate, startDay: number): MonthKey {
  const d = parseLocal(date);
  const startThisMonth = clampedStart(d.getFullYear(), d.getMonth(), startDay);
  // Before this calendar month's start day → still in the fiscal month
  // that began in the previous calendar month.
  const anchor = d < startThisMonth ? addMonths(startThisMonth, -1) : d;
  return format(anchor, 'yyyy-MM');
}

/** Inclusive [start, end] date range of a fiscal month. */
export function getMonthRange(
  monthKey: MonthKey,
  startDay: number,
): { start: ISODate; end: ISODate } {
  const [y, m] = monthKey.split('-').map(Number);
  const start = clampedStart(y!, m! - 1, startDay);
  // Next fiscal start is clamped independently (e.g. day 31 → Feb 28),
  // so the range never skips or double-counts a day.
  const nextFirst = addMonths(new Date(y!, m! - 1, 1), 1);
  const nextStart = clampedStart(nextFirst.getFullYear(), nextFirst.getMonth(), startDay);
  return { start: toISO(start), end: toISO(addDays(nextStart, -1)) };
}

/** "2026-01" + (−1) → "2025-12". For the month navigator in lists/insights. */
export function shiftMonthKey(monthKey: MonthKey, delta: number): MonthKey {
  const [y, m] = monthKey.split('-').map(Number);
  return format(addMonths(new Date(y!, m! - 1, 1), delta), 'yyyy-MM');
}

/**
 * Days left in the fiscal month, counting today itself (drives "Güne düşen",
 * §8.3). 0 when the month is already over; full length when it hasn't begun.
 */
export function getDaysRemaining(
  today: ISODate,
  monthKey: MonthKey,
  startDay: number,
): number {
  const { start, end } = getMonthRange(monthKey, startDay);
  const t = parseLocal(today);
  const endD = parseLocal(end);
  if (t > endD) return 0;
  const from = t < parseLocal(start) ? parseLocal(start) : t;
  return differenceInCalendarDays(endD, from) + 1;
}
