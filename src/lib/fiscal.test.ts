import { describe, expect, it } from 'vitest';
import { getDaysRemaining, getMonthKey, getMonthRange } from './fiscal';

// AC (§16 P1): fiscal month math correct for startDay 1, 15, 28
// around month boundaries.

describe('getMonthKey', () => {
  it('startDay 1: fiscal month = calendar month', () => {
    expect(getMonthKey('2026-07-01', 1)).toBe('2026-07');
    expect(getMonthKey('2026-07-31', 1)).toBe('2026-07');
    expect(getMonthKey('2026-08-01', 1)).toBe('2026-08');
  });

  it('startDay 15: month boundary sits mid-calendar-month', () => {
    expect(getMonthKey('2026-07-14', 15)).toBe('2026-06');
    expect(getMonthKey('2026-07-15', 15)).toBe('2026-07');
    expect(getMonthKey('2026-08-14', 15)).toBe('2026-07');
    expect(getMonthKey('2026-08-15', 15)).toBe('2026-08');
  });

  it('startDay 15: year boundary', () => {
    expect(getMonthKey('2026-01-05', 15)).toBe('2025-12');
    expect(getMonthKey('2026-01-15', 15)).toBe('2026-01');
  });

  it('startDay 28: February (non-leap)', () => {
    expect(getMonthKey('2026-02-27', 28)).toBe('2026-01');
    expect(getMonthKey('2026-02-28', 28)).toBe('2026-02');
  });

  it('startDay 28: February (leap year)', () => {
    expect(getMonthKey('2028-02-27', 28)).toBe('2028-01');
    expect(getMonthKey('2028-02-28', 28)).toBe('2028-02');
    expect(getMonthKey('2028-02-29', 28)).toBe('2028-02');
  });
});

describe('getMonthRange', () => {
  it('startDay 1: full calendar months', () => {
    expect(getMonthRange('2026-07', 1)).toEqual({
      start: '2026-07-01',
      end: '2026-07-31',
    });
    expect(getMonthRange('2026-02', 1)).toEqual({
      start: '2026-02-01',
      end: '2026-02-28',
    });
  });

  it('startDay 15: Jul 15 → Aug 14', () => {
    expect(getMonthRange('2026-07', 15)).toEqual({
      start: '2026-07-15',
      end: '2026-08-14',
    });
  });

  it('startDay 15: December range crosses the year', () => {
    expect(getMonthRange('2025-12', 15)).toEqual({
      start: '2025-12-15',
      end: '2026-01-14',
    });
  });

  it('startDay 28: ranges stay contiguous through February', () => {
    expect(getMonthRange('2026-01', 28)).toEqual({
      start: '2026-01-28',
      end: '2026-02-27',
    });
    expect(getMonthRange('2026-02', 28)).toEqual({
      start: '2026-02-28',
      end: '2026-03-27',
    });
  });

  it('defensively clamps startDay beyond month length (>28 is blocked in UI)', () => {
    expect(getMonthRange('2026-01', 31)).toEqual({
      start: '2026-01-31',
      end: '2026-02-27', // next start clamps to Feb 28
    });
  });
});

describe('getDaysRemaining', () => {
  it('counts today inclusively', () => {
    expect(getDaysRemaining('2026-07-15', '2026-07', 1)).toBe(17);
    expect(getDaysRemaining('2026-07-31', '2026-07', 1)).toBe(1);
  });

  it('handles boundaries of a startDay-15 month', () => {
    expect(getDaysRemaining('2026-07-15', '2026-07', 15)).toBe(31);
    expect(getDaysRemaining('2026-08-14', '2026-07', 15)).toBe(1);
  });

  it('is 0 after the month ends, full length before it starts', () => {
    expect(getDaysRemaining('2026-08-15', '2026-07', 15)).toBe(0);
    expect(getDaysRemaining('2026-07-01', '2026-07', 15)).toBe(31);
  });
});
