import { addDays, format } from 'date-fns';
import type { ISODate } from './types';

/** Today as a local "YYYY-MM-DD" string (dates are local, §6). */
export function todayISO(): ISODate {
  return format(new Date(), 'yyyy-MM-dd');
}

/** Local date N days back — e.g. the 90-day window for chip ordering (§9.1). */
export function daysAgoISO(days: number): ISODate {
  return format(addDays(new Date(), -days), 'yyyy-MM-dd');
}
