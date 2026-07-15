import type { ISODate } from './types';
import { addDaysISO, isoWeekdayOf } from './dates';

// Pazar Muhasebesi window math (§9.8), pure and unit-tested.
//
// The window is the 7 days ENDING on the most recent reviewDay ≤ today.
// With the default reviewDay 7 (Sunday) that is exactly the last completed
// Mon–Sun week — on Sunday itself, the week ending that evening (the
// ritual). The review stays available on later days until it's done,
// because the same window keeps being returned until the next reviewDay.

export function reviewWindow(
  today: ISODate,
  reviewDay: number,
): { start: ISODate; end: ISODate } {
  const delta = (isoWeekdayOf(today) - reviewDay + 7) % 7;
  const end = addDaysISO(today, -delta);
  return { start: addDaysISO(end, -6), end };
}
