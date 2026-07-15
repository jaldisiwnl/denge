import { addDays, format } from 'date-fns';
import type { ISODate } from './types';

/** Parses "YYYY-MM-DD" as a local Date (never UTC — dates are local, §6). */
export function parseLocalDate(date: ISODate): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y!, m! - 1, d!);
}

/** Today as a local "YYYY-MM-DD" string. */
export function todayISO(): ISODate {
  return format(new Date(), 'yyyy-MM-dd');
}

/** Local date N days back — e.g. the 90-day window for chip ordering (§9.1). */
export function daysAgoISO(days: number): ISODate {
  return format(addDays(new Date(), -days), 'yyyy-MM-dd');
}

/** Shifts an ISO date by whole days. */
export function addDaysISO(date: ISODate, delta: number): ISODate {
  return format(addDays(parseLocalDate(date), delta), 'yyyy-MM-dd');
}
