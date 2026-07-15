import { describe, expect, it } from 'vitest';
import { reviewWindow } from './review';

// 2026-07-12 is a Sunday; 2026-07-15 a Wednesday.

describe('reviewWindow', () => {
  it('on Sunday (reviewDay 7) covers the week ending that day', () => {
    expect(reviewWindow('2026-07-12', 7)).toEqual({
      start: '2026-07-06',
      end: '2026-07-12',
    });
  });

  it('stays on the same week until the next reviewDay (AC)', () => {
    expect(reviewWindow('2026-07-15', 7)).toEqual({
      start: '2026-07-06',
      end: '2026-07-12',
    });
    expect(reviewWindow('2026-07-18', 7)).toEqual({
      start: '2026-07-06',
      end: '2026-07-12',
    });
    // next Sunday rolls the window forward
    expect(reviewWindow('2026-07-19', 7)).toEqual({
      start: '2026-07-13',
      end: '2026-07-19',
    });
  });

  it('supports non-Sunday review days as a 7-day window ending that day', () => {
    expect(reviewWindow('2026-07-15', 1)).toEqual({
      start: '2026-07-07',
      end: '2026-07-13', // most recent Monday
    });
  });
});
