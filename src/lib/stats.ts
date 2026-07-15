import type { Minor } from './types';

// Safe-to-spend (§8.3), pure and unit-tested. The repo layer assembles the
// inputs from Dexie; this stays free of data access.

export interface SafeToSpendInput {
  /** Income logged this fiscal month. */
  incomeMinor: Minor;
  /** Settings.monthlyNetIncomeMinor — used only when no income is logged. */
  fallbackIncomeMinor: Minor;
  /** Σ effective envelope totals, or null when no envelopes exist. */
  envelopeTotalMinor: Minor | null;
  /** Recurring-posted expenses already written this month. */
  fixedPostedMinor: Minor;
  /** Active recurring expense occurrences still ahead this month. */
  fixedRemainingMinor: Minor;
  /** Expenses this month excluding recurring-posted ones. */
  variableSpentMinor: Minor;
  /** Net SavingsEntry sum this month (deposits − withdrawals). */
  savedNetMinor: Minor;
  daysRemaining: number;
}

export interface SafeToSpend {
  availableMinor: Minor;
  perDayMinor: Minor; // "Güne düşen"
  budgetTotalMinor: Minor;
  spentTotalMinor: Minor; // fixed posted + variable — reconciles with the list
}

/**
 * Note on the fixed component: the spec's formula subtracts only
 * fixedRemaining, but since spentVariable excludes recurring-posted rows,
 * posted fixed costs would vanish and `available` would jump the moment a
 * rule posts. We subtract posted + remaining so the number is stable across
 * a posting (§0.7 simplest-consistent interpretation, noted in PHASE_NOTES).
 */
export function computeSafeToSpend(input: SafeToSpendInput): SafeToSpend {
  const income =
    input.incomeMinor > 0 ? input.incomeMinor : input.fallbackIncomeMinor;
  // With zero income data, min(0, envelopes) would floor the budget at 0 and
  // show a meaninglessly negative "Kalan". When envelopes exist they are the
  // best available budget estimate — use them until income is known
  // (documented §0.7 deviation, P3/P4 review fix).
  const budgetTotalMinor =
    input.envelopeTotalMinor !== null
      ? income > 0
        ? Math.min(income, input.envelopeTotalMinor)
        : input.envelopeTotalMinor
      : income;
  // Kumbara deposits are gone from the spending pool by design (§8.3).
  const saved = Math.max(0, input.savedNetMinor);
  const availableMinor =
    budgetTotalMinor -
    input.fixedPostedMinor -
    input.fixedRemainingMinor -
    input.variableSpentMinor -
    saved;
  const perDayMinor = Math.max(
    0,
    Math.floor(availableMinor / Math.max(1, input.daysRemaining)),
  );
  return {
    availableMinor,
    perDayMinor,
    budgetTotalMinor,
    spentTotalMinor: input.fixedPostedMinor + input.variableSpentMinor,
  };
}
