import type { ISODate } from './types';
import { addDaysISO } from './dates';

// Lapse detection (§8.8), pure and unit-tested. "Activity" = user-entered
// transaction dates plus explicit "Bu gün harcama yoktu" clean-day marks;
// auto-posted recurring transactions never count as activity.

export interface Gap {
  from: ISODate;
  to: ISODate;
  dayCount: number;
}

/** Stable identity for dismissal flags. */
export function gapKey(gap: Pick<Gap, 'from' | 'to'>): string {
  return `${gap.from}_${gap.to}`;
}

/**
 * All maximal runs of ≥3 consecutive zero-activity days that start after the
 * user's first activity and end before today (ascending order). A partially
 * backfilled gap shrinks; remnants under 3 days stop being gaps entirely.
 */
export function findGaps(
  activityDates: Iterable<ISODate>,
  today: ISODate,
): Gap[] {
  const activity = new Set(activityDates);
  if (activity.size === 0) return [];
  const first = [...activity].sort()[0]!;

  const gaps: Gap[] = [];
  let runStart: ISODate | null = null;

  const close = (endExclusive: ISODate) => {
    if (!runStart) return;
    const to = addDaysISO(endExclusive, -1);
    const dayCount = diffDays(runStart, to) + 1;
    if (dayCount >= 3) gaps.push({ from: runStart, to, dayCount });
    runStart = null;
  };

  for (let d = addDaysISO(first, 1); d < today; d = addDaysISO(d, 1)) {
    if (activity.has(d)) close(d);
    else runStart ??= d;
  }
  close(today);
  return gaps;
}

function parseRange(key: string): { from: ISODate; to: ISODate } | null {
  const [from, to] = key.split('_');
  return from && to ? { from, to } : null;
}

/**
 * Most recent gap the user hasn't resolved via backfill flow or dismissal.
 * Dismissals are RANGES, not exact keys: partial backfill splits a gap into
 * remnants with new boundaries, and a remnant inside an already-dismissed
 * range must stay resolved — otherwise the card would reappear the moment
 * the user finishes the recovery flow. A gap that grew past the dismissed
 * range (user stayed silent) is no longer contained and resurfaces.
 */
export function detectLapse(
  activityDates: Iterable<ISODate>,
  today: ISODate,
  dismissedRanges: Iterable<string>, // "from_to" keys, see gapKey()
): Gap | null {
  const ranges = [...dismissedRanges]
    .map(parseRange)
    .filter((r): r is { from: ISODate; to: ISODate } => r !== null);
  const gaps = findGaps(activityDates, today);
  for (let i = gaps.length - 1; i >= 0; i--) {
    const gap = gaps[i]!;
    const resolved = ranges.some((r) => gap.from >= r.from && gap.to <= r.to);
    if (!resolved) return gap;
  }
  return null;
}

/**
 * Every day inside any detected gap — paused for streak math (§8.5).
 * Dismissed gaps stay paused too; only backfilled data (which removes the
 * day from the gap by becoming activity) un-pauses a day.
 */
export function pausedDaySet(gaps: Gap[]): Set<ISODate> {
  const days = new Set<ISODate>();
  for (const gap of gaps) {
    for (let d = gap.from; d <= gap.to; d = addDaysISO(d, 1)) days.add(d);
  }
  return days;
}

function diffDays(from: ISODate, to: ISODate): number {
  let count = 0;
  for (let d = from; d < to; d = addDaysISO(d, 1)) count++;
  return count;
}
