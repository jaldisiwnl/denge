import type { Minor } from './types';

// Zaman maliyeti (§9.10), pure and unit-tested. Never applied to income
// or savings entries — callers guard that.

export interface WageSource {
  hourlyWageMinor?: Minor; // explicit wins
  monthlyNetIncomeMinor?: Minor;
  weeklyWorkHours?: number; // default 45
}

/** Hourly wage in kuruş, derived when not explicit; null = unknown. */
export function deriveHourlyWageMinor(source: WageSource): Minor | null {
  if (source.hourlyWageMinor && source.hourlyWageMinor > 0) {
    return source.hourlyWageMinor;
  }
  if (source.monthlyNetIncomeMinor && source.monthlyNetIncomeMinor > 0) {
    const monthlyHours = (source.weeklyWorkHours || 45) * 4.33;
    return Math.round(source.monthlyNetIncomeMinor / monthlyHours);
  }
  return null;
}

/** How many minutes of work a price equals. */
export function workMinutes(amountMinor: Minor, hourlyWageMinor: Minor): number {
  return Math.round((amountMinor / hourlyWageMinor) * 60);
}

/** Splits minutes for display: "X dk" under 1h, else "X sa Y dk" (§9.10). */
export function splitWorkTime(totalMinutes: number): {
  hours: number;
  minutes: number;
} {
  return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 };
}
