import { describe, expect, it } from 'vitest';
import { computeSafeToSpend } from './stats';

const base = {
  incomeMinor: 5000000, // ₺50.000
  fallbackIncomeMinor: 0,
  envelopeTotalMinor: null as number | null,
  fixedPostedMinor: 0,
  fixedRemainingMinor: 0,
  variableSpentMinor: 0,
  savedNetMinor: 0,
  daysRemaining: 10,
};

describe('computeSafeToSpend', () => {
  it('divides the remainder over the remaining days', () => {
    const r = computeSafeToSpend({
      ...base,
      fixedRemainingMinor: 2000000,
      variableSpentMinor: 1000000,
    });
    expect(r.availableMinor).toBe(2000000);
    expect(r.perDayMinor).toBe(200000);
  });

  it('is stable across a recurring posting (posted+remaining both count)', () => {
    const before = computeSafeToSpend({ ...base, fixedRemainingMinor: 2000000 });
    const after = computeSafeToSpend({ ...base, fixedPostedMinor: 2000000 });
    expect(after.availableMinor).toBe(before.availableMinor);
    expect(after.spentTotalMinor).toBe(2000000); // reconciles with list totals
  });

  it('falls back to settings income when nothing is logged yet', () => {
    const r = computeSafeToSpend({
      ...base,
      incomeMinor: 0,
      fallbackIncomeMinor: 3000000,
    });
    expect(r.budgetTotalMinor).toBe(3000000);
  });

  it('caps the budget at envelope totals when envelopes exist', () => {
    const r = computeSafeToSpend({ ...base, envelopeTotalMinor: 3000000 });
    expect(r.budgetTotalMinor).toBe(3000000);
    expect(computeSafeToSpend(base).budgetTotalMinor).toBe(5000000);
  });

  it('kumbara deposits shrink the pool; withdrawals never grow it', () => {
    expect(
      computeSafeToSpend({ ...base, savedNetMinor: 1000000 }).availableMinor,
    ).toBe(4000000);
    expect(
      computeSafeToSpend({ ...base, savedNetMinor: -500000 }).availableMinor,
    ).toBe(5000000);
  });

  it('clamps per-day at zero when overspent; available stays negative', () => {
    const r = computeSafeToSpend({ ...base, variableSpentMinor: 6000000 });
    expect(r.availableMinor).toBe(-1000000);
    expect(r.perDayMinor).toBe(0);
  });
});
