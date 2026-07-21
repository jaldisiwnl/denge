import { describe, expect, it } from 'vitest';
import {
  applyPayment,
  forecastTotal,
  installmentsLeft,
  obligationDueDates,
  sortForecast,
  type ForecastEntry,
} from './payments';

describe('obligationDueDates — monthly (kart/borç)', () => {
  it('lists the due day within the window', () => {
    expect(
      obligationDueDates(
        { kind: 'kart', dayOfMonth: 10, isActive: true },
        '2026-07-01',
        '2026-08-31',
      ),
    ).toEqual(['2026-07-10', '2026-08-10']);
  });

  it('clamps day 31 to month end like the recurrence engine (§17)', () => {
    expect(
      obligationDueDates(
        { kind: 'borc', dayOfMonth: 31, isActive: true },
        '2026-02-01',
        '2026-02-28',
      ),
    ).toEqual(['2026-02-28']);
  });

  it('excludes occurrences already posted (lastPostedDate)', () => {
    expect(
      obligationDueDates(
        { kind: 'kart', dayOfMonth: 10, isActive: true, lastPostedDate: '2026-07-10' },
        '2026-07-01',
        '2026-08-31',
      ),
    ).toEqual(['2026-08-10']);
  });

  it('includes an occurrence exactly on the window start', () => {
    expect(
      obligationDueDates(
        { kind: 'kart', dayOfMonth: 1, isActive: true },
        '2026-07-01',
        '2026-07-31',
      ),
    ).toEqual(['2026-07-01']);
  });

  it('open-balance debt (no dayOfMonth) and inactive obligations yield nothing', () => {
    expect(
      obligationDueDates({ kind: 'borc', isActive: true }, '2026-07-01', '2026-12-31'),
    ).toEqual([]);
    expect(
      obligationDueDates(
        { kind: 'kart', dayOfMonth: 10, isActive: false },
        '2026-07-01',
        '2026-12-31',
      ),
    ).toEqual([]);
  });
});

describe('obligationDueDates — planlı (one-off)', () => {
  it('returns the single date when it lands in the window', () => {
    expect(
      obligationDueDates(
        { kind: 'planli', dueDate: '2026-08-15', isActive: true },
        '2026-08-01',
        '2026-08-31',
      ),
    ).toEqual(['2026-08-15']);
    expect(
      obligationDueDates(
        { kind: 'planli', dueDate: '2026-09-15', isActive: true },
        '2026-08-01',
        '2026-08-31',
      ),
    ).toEqual([]);
  });
});

describe('payoff math', () => {
  it('applyPayment never goes below zero', () => {
    expect(applyPayment(100000, 30000)).toBe(70000);
    expect(applyPayment(20000, 30000)).toBe(0);
  });

  it('installmentsLeft rounds up and floors at zero', () => {
    expect(installmentsLeft(100000, 25000)).toBe(4);
    expect(installmentsLeft(90000, 25000)).toBe(4); // 3.6 → 4
    expect(installmentsLeft(0, 25000)).toBe(0);
    expect(installmentsLeft(50000, 0)).toBe(0);
  });
});

describe('forecast helpers', () => {
  const entries: ForecastEntry[] = [
    { date: '2026-07-10', title: 'Kredi kartı', amountMinor: 50000, kind: 'kart', sourceId: 'a' },
    { date: '2026-07-05', title: 'Spotify', amountMinor: 6000, kind: 'abonelik', sourceId: 'b' },
    { date: '2026-07-05', title: 'Netflix', amountMinor: 15000, kind: 'abonelik', sourceId: 'c' },
  ];

  it('sorts by date then Turkish title', () => {
    expect(sortForecast(entries).map((e) => e.title)).toEqual([
      'Netflix',
      'Spotify',
      'Kredi kartı',
    ]);
  });

  it('totals the slice', () => {
    expect(forecastTotal(entries)).toBe(71000);
  });
});
