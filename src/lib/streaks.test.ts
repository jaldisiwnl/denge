import { describe, expect, it } from 'vitest';
import { bestStreak, currentStreak } from './streaks';

const base = {
  today: '2026-07-15',
  firstActivity: '2026-07-01' as string | null,
  bosDays: new Set<string>(),
  pausedDays: new Set<string>(),
};

describe('currentStreak', () => {
  it('counts consecutive clean days ending today (no-expense days count)', () => {
    expect(currentStreak({ ...base, bosDays: new Set(['2026-07-10']) })).toBe(5);
  });

  it('is 0 when today has a bos expense, or when no activity ever', () => {
    expect(currentStreak({ ...base, bosDays: new Set(['2026-07-15']) })).toBe(0);
    expect(currentStreak({ ...base, firstActivity: null })).toBe(0);
  });

  it('paused days neither extend nor break — streak resumes at pre-lapse value', () => {
    // bos on Jul 5; lapse Jul 8–12 paused; clean 6,7 + 13,14,15 → 5.
    expect(
      currentStreak({
        ...base,
        bosDays: new Set(['2026-07-05']),
        pausedDays: new Set([
          '2026-07-08',
          '2026-07-09',
          '2026-07-10',
          '2026-07-11',
          '2026-07-12',
        ]),
      }),
    ).toBe(5);
  });

  it('backfilling un-pauses days (AC): fewer paused days, longer streak', () => {
    // Same lapse but Jul 9–11 backfilled clean → only 8 & 12 stay paused.
    expect(
      currentStreak({
        ...base,
        bosDays: new Set(['2026-07-05']),
        pausedDays: new Set(['2026-07-08', '2026-07-12']),
      }),
    ).toBe(8);
  });

  it('a backfilled bos day breaks the streak at that point', () => {
    expect(
      currentStreak({
        ...base,
        bosDays: new Set(['2026-07-09']),
        pausedDays: new Set(['2026-07-08']),
      }),
    ).toBe(6); // 10..15, skipping paused 8, blocked by bos 9
  });
});

describe('bestStreak', () => {
  it('finds the longest historical run with pause semantics', () => {
    expect(
      bestStreak({
        ...base,
        bosDays: new Set(['2026-07-04', '2026-07-13']),
        pausedDays: new Set(['2026-07-08']),
      }),
    ).toBe(7); // Jul 5–12: clean 5,6,7 + paused 8 skipped + clean 9–12 = 7
  });
});
