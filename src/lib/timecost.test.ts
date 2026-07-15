import { describe, expect, it } from 'vitest';
import { deriveHourlyWageMinor, splitWorkTime, workMinutes } from './timecost';

describe('deriveHourlyWageMinor', () => {
  it('prefers the explicit wage', () => {
    expect(
      deriveHourlyWageMinor({
        hourlyWageMinor: 50000,
        monthlyNetIncomeMinor: 4500000,
      }),
    ).toBe(50000);
  });

  it('derives from income and weekly hours (×4.33)', () => {
    // ₺45.000 / (45h × 4.33) ≈ ₺230,95/h
    expect(
      deriveHourlyWageMinor({ monthlyNetIncomeMinor: 4500000, weeklyWorkHours: 45 }),
    ).toBe(23095);
  });

  it('defaults weekly hours to 45 and returns null without data', () => {
    expect(deriveHourlyWageMinor({ monthlyNetIncomeMinor: 4500000 })).toBe(23095);
    expect(deriveHourlyWageMinor({})).toBeNull();
    expect(deriveHourlyWageMinor({ monthlyNetIncomeMinor: 0 })).toBeNull();
  });
});

describe('workMinutes / splitWorkTime', () => {
  it('converts a price into work time', () => {
    expect(workMinutes(23095, 23095)).toBe(60);
    expect(workMinutes(12000, 24000)).toBe(30);
  });

  it('splits for display (§9.10: "X dk" under 1h, else "X sa Y dk")', () => {
    expect(splitWorkTime(45)).toEqual({ hours: 0, minutes: 45 });
    expect(splitWorkTime(135)).toEqual({ hours: 2, minutes: 15 });
    expect(splitWorkTime(120)).toEqual({ hours: 2, minutes: 0 });
  });
});
