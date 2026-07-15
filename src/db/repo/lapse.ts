import { db } from '../db';
import type { ISODate } from '../../lib/types';
import { detectLapse, findGaps, gapKey, pausedDaySet, type Gap } from '../../lib/lapse';
import { bestStreak, currentStreak } from '../../lib/streaks';
import { listFlagKeys, setFlag } from './uiFlags';

export interface LapseState {
  /** Most recent unresolved gap — drives the recovery card (§9.15). */
  activeGap: Gap | null;
  /** Days paused for streak math: all gap days, dismissed included (§8.5). */
  pausedDays: Set<ISODate>;
  currentStreak: number;
  bestStreak: number;
  firstActivity: ISODate | null;
}

/** One assembled read for the streak card, lapse card and heatmap. */
export async function getLapseState(today: ISODate): Promise<LapseState> {
  const [txns, cleanKeys, dismissedKeys] = await Promise.all([
    db.transactions.toArray(),
    listFlagKeys('cleanDay:'),
    listFlagKeys('gapDismissed:'),
  ]);

  // Auto-posted recurring rows are not "activity" (§8.8); future dates are
  // excluded from streaks (§17).
  const manualDates = txns
    .filter((t) => !t.recurringRuleId && t.date <= today)
    .map((t) => t.date);
  const activity = new Set(manualDates);
  for (const key of cleanKeys) activity.add(key.slice('cleanDay:'.length));

  const gaps = findGaps(activity, today);
  const dismissed = new Set(dismissedKeys.map((k) => k.slice('gapDismissed:'.length)));
  const pausedDays = pausedDaySet(gaps);

  const bosDays = new Set(
    txns
      .filter((t) => t.necessity === 'bos' && t.date <= today)
      .map((t) => t.date),
  );
  const firstActivity =
    manualDates.length > 0 ? [...activity].sort()[0]! : null;
  const streakInput = { today, firstActivity, bosDays, pausedDays };

  return {
    activeGap: detectLapse(activity, today, dismissed),
    pausedDays,
    currentStreak: currentStreak(streakInput),
    bestStreak: bestStreak(streakInput),
    firstActivity,
  };
}

/** "Bu gün harcama yoktu" — becomes activity and a clean streak day. */
export async function markCleanDay(date: ISODate): Promise<void> {
  await setFlag(`cleanDay:${date}`);
}

/** "Boş ver" or completed backfill flow: the card goes; days stay paused. */
export async function dismissGap(gap: Gap): Promise<void> {
  await setFlag(`gapDismissed:${gapKey(gap)}`);
}
