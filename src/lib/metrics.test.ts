import { describe, expect, it } from 'vitest';
import { computeMonthMetrics, durtuBand, type TxnLike } from './stats';

const expense = (
  amountMinor: number,
  necessity: string,
  extra: Partial<TxnLike> = {},
): TxnLike => ({ type: 'expense', amountMinor, necessity, ...extra });

describe('computeMonthMetrics (§8.4)', () => {
  it('computes boş oranı from CURRENT tags (retrospective honesty counts)', () => {
    const m = computeMonthMetrics(
      [
        expense(60000, 'gerekli'),
        expense(20000, 'istek'),
        // originally istek, honestly reclassified to bos:
        expense(20000, 'bos', { necessityOriginal: 'istek' }),
      ],
      0,
    );
    expect(m.bosRate).toBeCloseTo(0.2);
    expect(m.reclassifiedCount).toBe(1);
    expect(m.istekToBosCount).toBe(1);
  });

  it('regret rate counts only reviewed istek/bos in the denominator', () => {
    const m = computeMonthMetrics(
      [
        expense(10000, 'istek', { reviewedAt: 't', regret: 'pisman' }),
        expense(30000, 'bos', { reviewedAt: 't', regret: 'degdi' }),
        expense(50000, 'istek'), // unreviewed → excluded
      ],
      0,
    );
    expect(m.reviewedBaseMinor).toBe(40000);
    expect(m.regretRate).toBeCloseTo(0.25);
  });

  it('dürtü endeksi = round(100 × (0.5·boş + 0.5·pişmanlık))', () => {
    const m = computeMonthMetrics(
      [
        expense(50000, 'bos', { reviewedAt: 't', regret: 'pisman' }),
        expense(50000, 'gerekli'),
      ],
      0,
    );
    // boş 0.5, pişmanlık 1.0 → 75; 46+ → fırtına
    expect(m.durtuIndex).toBe(75);
    expect(durtuBand(m.durtuIndex!)).toBe('firtina');
    expect(durtuBand(20)).toBe('sakin');
    expect(durtuBand(21)).toBe('dalgali');
  });

  it('net birikim oranı = (saved + leftover) / income, clamped', () => {
    const m = computeMonthMetrics(
      [
        { type: 'income', amountMinor: 100000 },
        expense(60000, 'gerekli'),
      ],
      20000,
    );
    // (20000 + 40000) / 100000
    expect(m.netSavingsRate).toBeCloseTo(0.6);
    // no income → null
    expect(computeMonthMetrics([expense(1000, 'bos')], 0).netSavingsRate).toBeNull();
  });

  it('returns nulls gracefully with no data', () => {
    const m = computeMonthMetrics([], 0);
    expect(m.bosRate).toBeNull();
    expect(m.regretRate).toBeNull();
    expect(m.durtuIndex).toBeNull();
  });
});
