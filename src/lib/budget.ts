import type { Minor } from './types';

// Envelope math (§9.5), pure and unit-tested.

export interface EnvelopeInput {
  baseMinor: Minor; // this month's override ?? default amount
  rollover: boolean;
  prevBaseMinor?: Minor; // previous month's override ?? default
  prevSpentMinor?: Minor; // previous month's spend in the category
}

/**
 * Effective envelope = base + last month's positive remainder when rollover
 * is on. One level deep by design: the remainder is computed from the
 * previous month's *base* (not its own rolled-over total), so a long idle
 * streak can't compound into an unrealistic envelope.
 */
export function effectiveEnvelope(input: EnvelopeInput): {
  totalMinor: Minor;
  rolloverMinor: Minor;
} {
  const rolloverMinor = input.rollover
    ? Math.max(0, (input.prevBaseMinor ?? 0) - (input.prevSpentMinor ?? 0))
    : 0;
  return { totalMinor: input.baseMinor + rolloverMinor, rolloverMinor };
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]!
    : Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
}

/**
 * Suggestion chip value (§9.5): median of recent months' spend, ignoring
 * months with zero spend so one quiet month doesn't drag a young history
 * to a useless suggestion. Null = not enough history, hide the chip.
 */
export function suggestEnvelope(monthlySpends: Minor[]): Minor | null {
  return median(monthlySpends.filter((v) => v > 0));
}
