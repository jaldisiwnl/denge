import type { ISODate } from './types';
import { addDaysISO } from './dates';

// Streak math (§8.5), pure and unit-tested. Temiz gün = a day with zero
// `bos` expenses; days with no expenses at all count too. Days inside lapse
// windows are PAUSED: they neither extend nor break a streak. Future-dated
// transactions are excluded by the caller (only dates ≤ today arrive here).

export interface StreakInput {
  today: ISODate;
  /** First ever user activity; streaks cannot begin before the ledger did. */
  firstActivity: ISODate | null;
  /** Days containing at least one `bos` expense. */
  bosDays: Set<ISODate>;
  /** Days inside detected lapse windows (§8.8). */
  pausedDays: Set<ISODate>;
}

/** Consecutive clean days ending today; paused days are skipped over. */
export function currentStreak(input: StreakInput): number {
  if (!input.firstActivity) return 0;
  let count = 0;
  for (let d = input.today; d >= input.firstActivity; d = addDaysISO(d, -1)) {
    if (input.pausedDays.has(d)) continue;
    if (input.bosDays.has(d)) break;
    count++;
  }
  return count;
}

/** Longest clean run in [from, to] with the same pause semantics. */
export function bestStreakInRange(
  input: Omit<StreakInput, 'today'>,
  from: ISODate,
  to: ISODate,
): number {
  let best = 0;
  let current = 0;
  for (let d = from; d <= to; d = addDaysISO(d, 1)) {
    if (input.pausedDays.has(d)) continue;
    if (input.bosDays.has(d)) {
      current = 0;
    } else {
      current++;
      if (current > best) best = current;
    }
  }
  return best;
}

/** All-time best (computed, never stored — §8.5). */
export function bestStreak(input: StreakInput): number {
  if (!input.firstActivity) return 0;
  return bestStreakInRange(input, input.firstActivity, input.today);
}

export const STREAK_MILESTONES = [3, 7, 14, 30] as const;
