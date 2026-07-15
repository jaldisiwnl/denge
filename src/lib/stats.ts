import type { Minor } from './types';

// Safe-to-spend (§8.3) and month metrics (§8.4), pure and unit-tested.
// The repo layer assembles the inputs from Dexie; this stays free of data
// access.

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/** Structural subset of Transaction that the metric math needs. */
export interface TxnLike {
  type: 'expense' | 'income';
  amountMinor: Minor;
  necessity?: string;
  necessityOriginal?: string;
  regret?: string;
  reviewedAt?: string;
}

export interface MonthMetrics {
  incomeMinor: Minor;
  expenseMinor: Minor;
  gerekliMinor: Minor;
  istekMinor: Minor;
  bosMinor: Minor;
  /** Boş oranı (§8.4) — current tags, so retrospective honesty counts. */
  bosRate: number | null; // null = no expenses
  reviewedBaseMinor: Minor; // reviewed istek+bos amount (denominator)
  pismanMinor: Minor;
  regretRate: number | null; // null = nothing reviewed
  /** Dürtü Endeksi 0–100 (§8.4): 50/50 boş + pişmanlık. */
  durtuIndex: number | null; // null = no expenses
  savedNetMinor: Minor;
  /** Net birikim oranı (§8.4), clamped [0,1]; null = no income logged. */
  netSavingsRate: number | null;
  reclassifiedCount: number;
  istekToBosCount: number;
  originalIstekCount: number;
}

export function computeMonthMetrics(
  txns: TxnLike[],
  savedNetMinor: Minor,
): MonthMetrics {
  let income = 0;
  let expense = 0;
  let gerekli = 0;
  let istek = 0;
  let bos = 0;
  let reviewedBase = 0;
  let pisman = 0;
  let reclassified = 0;
  let istekToBos = 0;
  let originalIstek = 0;

  for (const t of txns) {
    if (t.type === 'income') {
      income += t.amountMinor;
      continue;
    }
    expense += t.amountMinor;
    if (t.necessity === 'gerekli') gerekli += t.amountMinor;
    else if (t.necessity === 'istek') istek += t.amountMinor;
    else if (t.necessity === 'bos') bos += t.amountMinor;
    if (t.necessityOriginal === 'istek') originalIstek++;
    if (t.necessityOriginal && t.necessity && t.necessityOriginal !== t.necessity) {
      reclassified++;
      if (t.necessityOriginal === 'istek' && t.necessity === 'bos') istekToBos++;
    }
    // Only reviewed items enter the regret denominator (§8.4).
    if (t.reviewedAt && (t.necessity === 'istek' || t.necessity === 'bos')) {
      reviewedBase += t.amountMinor;
      if (t.regret === 'pisman') pisman += t.amountMinor;
    }
  }

  const bosRate = expense > 0 ? bos / expense : null;
  const regretRate = reviewedBase > 0 ? pisman / reviewedBase : null;
  return {
    incomeMinor: income,
    expenseMinor: expense,
    gerekliMinor: gerekli,
    istekMinor: istek,
    bosMinor: bos,
    bosRate,
    reviewedBaseMinor: reviewedBase,
    pismanMinor: pisman,
    regretRate,
    durtuIndex:
      expense > 0
        ? Math.round(100 * (0.5 * (bosRate ?? 0) + 0.5 * (regretRate ?? 0)))
        : null,
    savedNetMinor,
    netSavingsRate:
      income > 0
        ? clamp01((savedNetMinor + Math.max(0, income - expense)) / income)
        : null,
    reclassifiedCount: reclassified,
    istekToBosCount: istekToBos,
    originalIstekCount: originalIstek,
  };
}

export type DurtuBand = 'sakin' | 'dalgali' | 'firtina';

/** Bands (§8.4): 0–20 Sakin, 21–45 Dalgalı, 46+ Fırtına. */
export function durtuBand(index: number): DurtuBand {
  if (index <= 20) return 'sakin';
  if (index <= 45) return 'dalgali';
  return 'firtina';
}

/** Frozen snapshot stored inside MonthlyClose (§7 — defined here). */
export interface MonthStatsSnapshot {
  incomeMinor: Minor;
  expenseMinor: Minor;
  gerekliMinor: Minor;
  istekMinor: Minor;
  bosMinor: Minor;
  bosRate: number | null;
  reviewedBaseMinor: Minor;
  pismanMinor: Minor;
  regretRate: number | null;
  durtuIndex: number | null;
  savedNetMinor: Minor;
  netSavingsRate: number | null;
  budgetTotalMinor: Minor | null;
  overspendRatio: number | null;
  bestStreak: number;
  reclassifiedCount: number;
  istekToBosCount: number;
}

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
