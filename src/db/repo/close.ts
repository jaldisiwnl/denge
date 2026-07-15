import { db } from '../db';
import { stripUndefined } from '../util';
import type { MonthlyClose } from '../types';
import type { ISODate, Minor, MonthKey } from '../../lib/types';
import { getMonthKey, getMonthRange, shiftMonthKey } from '../../lib/fiscal';
import { addDaysISO, todayISO } from '../../lib/dates';
import { computeMonthMetrics, type MonthStatsSnapshot } from '../../lib/stats';
import { computeGrade, type GradeResult } from '../../lib/grade';
import { bestStreakInRange } from '../../lib/streaks';
import { listEnvelopeStatuses, type EnvelopeStatus } from './budgets';
import { getLapseState } from './lapse';
import { getSettings } from './settings';

export function getClose(monthKey: MonthKey): Promise<MonthlyClose | undefined> {
  return db.monthlyCloses.where('monthKey').equals(monthKey).first();
}

export async function listCloses(): Promise<MonthlyClose[]> {
  const all = await db.monthlyCloses.toArray();
  return all.sort((a, b) => b.monthKey.localeCompare(a.monthKey));
}

/**
 * Which month is offered for closing (§9.12)? An unclosed previous month
 * with activity always comes first; otherwise the current month during its
 * last 2 days.
 */
export async function closableMonth(
  today: ISODate,
  startDay: number,
): Promise<MonthKey | null> {
  const currentKey = getMonthKey(today, startDay);
  const prevKey = shiftMonthKey(currentKey, -1);

  if (!(await getClose(prevKey))) {
    const prevRange = getMonthRange(prevKey, startDay);
    const prevCount = await db.transactions
      .where('date')
      .between(prevRange.start, prevRange.end, true, true)
      .count();
    if (prevCount > 0) return prevKey;
  }

  const range = getMonthRange(currentKey, startDay);
  if (today >= addDaysISO(range.end, -1) && !(await getClose(currentKey))) {
    return currentKey;
  }
  return null;
}

export interface CloseContext {
  monthKey: MonthKey;
  snapshot: MonthStatsSnapshot;
  grade: GradeResult;
  envelopes: EnvelopeStatus[];
  /** max(0, income − expenses − alreadySaved) — the savings step (§9.12). */
  suggestedTransferMinor: Minor;
  worstBosCategoryId: string | null;
  worstBosShare: number; // of total bos
  worstEnvelope: { categoryId: string; overMinor: Minor } | null;
  worstRegretCategoryId: string | null;
}

/** Assembles everything the wizard and the grade need for one month. */
export async function buildCloseContext(monthKey: MonthKey): Promise<CloseContext | null> {
  const settings = await getSettings();
  if (!settings) return null;
  const startDay = settings.monthStartDay;
  const range = getMonthRange(monthKey, startDay);

  const [txns, savingsEntries, envelopes, lapse, previousClose] =
    await Promise.all([
      db.transactions.where('date').between(range.start, range.end, true, true).toArray(),
      db.savingsEntries.where('date').between(range.start, range.end, true, true).toArray(),
      listEnvelopeStatuses(monthKey, startDay),
      getLapseState(todayISO()),
      getClose(shiftMonthKey(monthKey, -1)),
    ]);

  const savedNet = savingsEntries.reduce((s, e) => s + e.amountMinor, 0);
  const metrics = computeMonthMetrics(txns, savedNet);

  const budgetTotal =
    envelopes.length > 0 ? envelopes.reduce((s, e) => s + e.totalMinor, 0) : null;
  const overspend =
    budgetTotal && budgetTotal > 0
      ? envelopes.reduce((s, e) => s + Math.max(0, e.spentMinor - e.totalMinor), 0) /
        budgetTotal
      : null;

  const streakEnd = range.end < todayISO() ? range.end : todayISO();
  const bosDays = new Set(
    txns.filter((t) => t.necessity === 'bos' && t.date <= streakEnd).map((t) => t.date),
  );
  const bestStreak =
    txns.length > 0
      ? bestStreakInRange(
          { firstActivity: range.start, bosDays, pausedDays: lapse.pausedDays },
          range.start,
          streakEnd,
        )
      : 0;

  const snapshot: MonthStatsSnapshot = {
    incomeMinor: metrics.incomeMinor,
    expenseMinor: metrics.expenseMinor,
    gerekliMinor: metrics.gerekliMinor,
    istekMinor: metrics.istekMinor,
    bosMinor: metrics.bosMinor,
    bosRate: metrics.bosRate,
    reviewedBaseMinor: metrics.reviewedBaseMinor,
    pismanMinor: metrics.pismanMinor,
    regretRate: metrics.regretRate,
    durtuIndex: metrics.durtuIndex,
    savedNetMinor: metrics.savedNetMinor,
    netSavingsRate: metrics.netSavingsRate,
    budgetTotalMinor: budgetTotal,
    overspendRatio: overspend,
    bestStreak,
    reclassifiedCount: metrics.reclassifiedCount,
    istekToBosCount: metrics.istekToBosCount,
  };

  const grade = computeGrade({
    overspendRatio: overspend,
    bosRate: metrics.bosRate,
    netSavingsRate: metrics.netSavingsRate,
    regretRate: metrics.regretRate,
    bestStreakInMonth: txns.length > 0 ? bestStreak : null,
    savingsTargetRate: settings.savingsTargetRate ?? 0.2,
    previous: previousClose
      ? {
          bosRate: previousClose.stats.bosRate,
          netSavingsRate: previousClose.stats.netSavingsRate,
        }
      : null,
  });

  // Actionable-observation inputs for the D/F no-shame reveal (§8.6).
  const bosByCategory = new Map<string, Minor>();
  const regretByCategory = new Map<string, Minor>();
  for (const t of txns) {
    if (t.type !== 'expense') continue;
    if (t.necessity === 'bos') {
      bosByCategory.set(t.categoryId, (bosByCategory.get(t.categoryId) ?? 0) + t.amountMinor);
    }
    if (t.regret === 'pisman') {
      regretByCategory.set(
        t.categoryId,
        (regretByCategory.get(t.categoryId) ?? 0) + t.amountMinor,
      );
    }
  }
  const worstBos = [...bosByCategory.entries()].sort((a, b) => b[1] - a[1])[0];
  const worstRegret = [...regretByCategory.entries()].sort((a, b) => b[1] - a[1])[0];
  const worstEnv = envelopes
    .map((e) => ({ categoryId: e.categoryId, overMinor: e.spentMinor - e.totalMinor }))
    .filter((e) => e.overMinor > 0)
    .sort((a, b) => b.overMinor - a.overMinor)[0];

  return {
    monthKey,
    snapshot,
    grade,
    envelopes,
    suggestedTransferMinor: Math.max(
      0,
      metrics.incomeMinor - metrics.expenseMinor - Math.max(0, savedNet),
    ),
    worstBosCategoryId: worstBos?.[0] ?? null,
    worstBosShare:
      worstBos && metrics.bosMinor > 0 ? worstBos[1] / metrics.bosMinor : 0,
    worstEnvelope: worstEnv ?? null,
    worstRegretCategoryId: worstRegret?.[0] ?? null,
  };
}

export async function saveClose(input: {
  monthKey: MonthKey;
  snapshot: MonthStatsSnapshot;
  grade: GradeResult;
  note?: string;
  nextMonthWasteLimitMinor?: Minor;
}): Promise<void> {
  const close: MonthlyClose = stripUndefined({
    id: crypto.randomUUID(),
    monthKey: input.monthKey,
    closedAt: new Date().toISOString(),
    grade: input.grade.grade,
    score: input.grade.score,
    stats: input.snapshot,
    note: input.note,
    nextMonthWasteLimitMinor: input.nextMonthWasteLimitMinor,
  });
  await db.monthlyCloses.add(close);
}
