import { describe, expect, it } from 'vitest';
import { detectLapse, findGaps, gapKey, pausedDaySet } from './lapse';

const TODAY = '2026-07-15';

describe('findGaps', () => {
  it('finds a ≥3-day zero-activity run ending before today (AC: 5-day gap)', () => {
    const activity = ['2026-07-01', '2026-07-09']; // gap Jul 2..8? no: 9 active
    expect(findGaps(activity, '2026-07-10')).toEqual([
      { from: '2026-07-02', to: '2026-07-08', dayCount: 7 },
    ]);
  });

  it('treats an ongoing silence (up to yesterday) as a gap', () => {
    expect(findGaps(['2026-07-10'], TODAY)).toEqual([
      { from: '2026-07-11', to: '2026-07-14', dayCount: 4 },
    ]);
  });

  it('ignores runs shorter than 3 days', () => {
    expect(findGaps(['2026-07-10', '2026-07-13'], '2026-07-14')).toEqual([]);
  });

  it('never reports the void before first activity', () => {
    expect(findGaps(['2026-07-14'], TODAY)).toEqual([]);
  });

  it('shrinks when days are backfilled; sub-3 remnants stop being gaps', () => {
    const base = ['2026-07-05', '2026-07-11'];
    expect(findGaps(base, '2026-07-12')).toEqual([
      { from: '2026-07-06', to: '2026-07-10', dayCount: 5 },
    ]);
    // Backfilling the 8th splits 5 days into 2+2 → gap fully dissolves.
    expect(findGaps([...base, '2026-07-08'], '2026-07-12')).toEqual([]);
  });

  it('reports multiple gaps in ascending order', () => {
    const gaps = findGaps(['2026-06-01', '2026-06-10', '2026-07-01'], TODAY);
    expect(gaps.map(gapKey)).toEqual([
      '2026-06-02_2026-06-09',
      '2026-06-11_2026-06-30',
      '2026-07-02_2026-07-14',
    ]);
  });
});

describe('detectLapse', () => {
  const activity = ['2026-06-01', '2026-06-10', '2026-07-01'];

  it('returns the most recent unresolved gap', () => {
    expect(detectLapse(activity, TODAY, new Set())).toMatchObject({
      from: '2026-07-02',
      to: '2026-07-14',
    });
  });

  it('skips dismissed gaps and surfaces the next unresolved one', () => {
    const dismissed = new Set(['2026-07-02_2026-07-14']);
    expect(detectLapse(activity, TODAY, dismissed)).toMatchObject({
      from: '2026-06-11',
      to: '2026-06-30',
    });
  });

  it('returns null when every gap is dismissed (AC: Boş ver)', () => {
    const dismissed = new Set([
      '2026-06-02_2026-06-09',
      '2026-06-11_2026-06-30',
      '2026-07-02_2026-07-14',
    ]);
    expect(detectLapse(activity, TODAY, dismissed)).toBeNull();
  });

  it('keeps remnant gaps inside a dismissed range resolved (post-backfill)', () => {
    // Gap Jul 2–14 was handled; a Jul 10 backfill split it into Jul 2–9 and
    // Jul 11–14 — both inside the dismissed range, so neither may resurface.
    const withBackfill = [...activity, '2026-07-10'];
    const dismissed = new Set(['2026-07-02_2026-07-14']);
    expect(detectLapse(withBackfill, TODAY, dismissed)).toMatchObject({
      from: '2026-06-11',
      to: '2026-06-30',
    });
  });

  it('a gap that grew past the dismissed range resurfaces', () => {
    // Dismissed through Jul 14, but the silence continued to Jul 15.
    const dismissed = new Set(['2026-07-02_2026-07-14']);
    expect(detectLapse(['2026-07-01'], '2026-07-16', dismissed)).toMatchObject({
      from: '2026-07-02',
      to: '2026-07-15',
    });
  });
});

describe('pausedDaySet', () => {
  it('collects every day of every gap (dismissed ones included by caller)', () => {
    const days = pausedDaySet([{ from: '2026-07-02', to: '2026-07-04', dayCount: 3 }]);
    expect([...days].sort()).toEqual(['2026-07-02', '2026-07-03', '2026-07-04']);
  });
});
