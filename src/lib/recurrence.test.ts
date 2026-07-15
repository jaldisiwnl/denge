import { describe, expect, it } from 'vitest';
import {
  annualizedMinor,
  dueDates,
  monthlyizedMinor,
  nextDueDate,
} from './recurrence';

describe('dueDates — monthly', () => {
  it('clamps day 31 to month end across months (§17)', () => {
    expect(
      dueDates({ cadence: 'monthly', dayOfMonth: 31 }, '2026-01-01', '2026-04-30'),
    ).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
  });

  it('clamps to Feb 29 in leap years', () => {
    expect(
      dueDates({ cadence: 'monthly', dayOfMonth: 30 }, '2028-02-01', '2028-03-01'),
    ).toEqual(['2028-02-29']);
  });

  it('excludes the lower bound and includes the upper bound', () => {
    expect(
      dueDates({ cadence: 'monthly', dayOfMonth: 15 }, '2026-07-15', '2026-08-15'),
    ).toEqual(['2026-08-15']);
  });

  it('backfills every missed month after a long gap (§17)', () => {
    expect(
      dueDates({ cadence: 'monthly', dayOfMonth: 1 }, '2025-11-20', '2026-02-10'),
    ).toEqual(['2025-12-01', '2026-01-01', '2026-02-01']);
  });

  it('returns nothing for an empty window — idempotency guard', () => {
    expect(
      dueDates({ cadence: 'monthly', dayOfMonth: 15 }, '2026-07-15', '2026-07-15'),
    ).toEqual([]);
  });
});

describe('dueDates — weekly', () => {
  it('finds all matching weekdays (1=Mon)', () => {
    // July 2026: the 1st is a Wednesday; Mondays fall on 6/13/20/27.
    expect(
      dueDates({ cadence: 'weekly', weekday: 1 }, '2026-06-30', '2026-07-31'),
    ).toEqual(['2026-07-06', '2026-07-13', '2026-07-20', '2026-07-27']);
  });

  it('handles Sunday (7) and window bounds', () => {
    expect(
      dueDates({ cadence: 'weekly', weekday: 7 }, '2026-07-05', '2026-07-19'),
    ).toEqual(['2026-07-12', '2026-07-19']);
  });
});

describe('dueDates — yearly', () => {
  it('clamps Feb 29 rules in non-leap years', () => {
    expect(
      dueDates(
        { cadence: 'yearly', month: 2, dayOfMonth: 29 },
        '2026-06-01',
        '2028-06-01',
      ),
    ).toEqual(['2027-02-28', '2028-02-29']);
  });
});

describe('nextDueDate', () => {
  it('returns the next occurrence after the given date', () => {
    expect(nextDueDate({ cadence: 'monthly', dayOfMonth: 31 }, '2026-01-31')).toBe(
      '2026-02-28',
    );
    expect(nextDueDate({ cadence: 'weekly', weekday: 3 }, '2026-07-15')).toBe(
      '2026-07-22',
    );
    expect(
      nextDueDate({ cadence: 'yearly', month: 1, dayOfMonth: 1 }, '2026-07-15'),
    ).toBe('2027-01-01');
  });
});

describe('annualized / monthlyized', () => {
  it('normalizes cadences for the Yıllık Şok math (§9.6)', () => {
    expect(annualizedMinor('monthly', 10000)).toBe(120000);
    expect(annualizedMinor('weekly', 10000)).toBe(520000);
    expect(annualizedMinor('yearly', 10000)).toBe(10000);
    expect(monthlyizedMinor('monthly', 10000)).toBe(10000);
    expect(monthlyizedMinor('weekly', 12000)).toBe(52000);
    expect(monthlyizedMinor('yearly', 120000)).toBe(10000);
  });
});
