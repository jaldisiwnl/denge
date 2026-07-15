// Month grade (§8.6), pure and fixture-tested.
//
// Weights: budget 30, waste 25, savings 20, regret 15, streak 10.
// A component with no data (null input) drops out and its weight is
// redistributed proportionally across the remaining components, so a month
// without envelopes is judged only on what actually happened.

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

const WEIGHTS = {
  budget: 30,
  waste: 25,
  savings: 20,
  regret: 15,
  streak: 10,
} as const;

export type GradeComponentKey = keyof typeof WEIGHTS;
export type GradeLetter = 'A' | 'B' | 'C' | 'D' | 'F';

export interface GradeInput {
  /** Σ max(0, spent−envelope) / Σ envelopes; null = no budget set. */
  overspendRatio: number | null;
  bosRate: number | null; // null = no expenses
  netSavingsRate: number | null; // null = no income logged
  regretRate: number | null; // null = no reviewed purchase
  bestStreakInMonth: number | null; // null = no activity
  savingsTargetRate?: number; // default 0.20 (§7)
  /** Stats of the previous CLOSED month; bonus requires one (§8.6). */
  previous?: {
    bosRate: number | null;
    netSavingsRate: number | null;
  } | null;
}

export interface GradeResult {
  score: number; // 0–100
  grade: GradeLetter;
  improvementBonus: number; // 0 | 5 | 10
  /** Redistributed weights actually used; 0 = component had no data. */
  effectiveWeights: Record<GradeComponentKey, number>;
}

export function gradeLetter(score: number): GradeLetter {
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

export function computeGrade(input: GradeInput): GradeResult {
  const target = input.savingsTargetRate || 0.2;

  const ratios: Record<GradeComponentKey, number | null> = {
    budget:
      input.overspendRatio === null ? null : clamp01(1 - input.overspendRatio),
    waste: input.bosRate === null ? null : clamp01(1 - input.bosRate / 0.25),
    savings:
      input.netSavingsRate === null
        ? null
        : clamp01(input.netSavingsRate / target),
    regret:
      input.regretRate === null ? null : clamp01(1 - input.regretRate / 0.5),
    streak:
      input.bestStreakInMonth === null
        ? null
        : clamp01(input.bestStreakInMonth / 10),
  };

  const keys = Object.keys(WEIGHTS) as GradeComponentKey[];
  const present = keys.filter((k) => ratios[k] !== null);
  const presentWeight = present.reduce((s, k) => s + WEIGHTS[k], 0);

  const effectiveWeights = Object.fromEntries(
    keys.map((k) => [k, 0]),
  ) as Record<GradeComponentKey, number>;
  let base = 0;
  if (presentWeight > 0) {
    for (const k of present) {
      const weight = (WEIGHTS[k] * 100) / presentWeight;
      effectiveWeights[k] = weight;
      base += weight * ratios[k]!;
    }
  }

  let improvementBonus = 0;
  if (input.previous) {
    const prev = input.previous;
    if (
      prev.bosRate !== null &&
      input.bosRate !== null &&
      input.bosRate < prev.bosRate
    ) {
      improvementBonus += 5;
    }
    if (
      prev.netSavingsRate !== null &&
      input.netSavingsRate !== null &&
      input.netSavingsRate > prev.netSavingsRate
    ) {
      improvementBonus += 5;
    }
  }

  const score = Math.min(100, Math.round(base + improvementBonus));
  return { score, grade: gradeLetter(score), improvementBonus, effectiveWeights };
}
