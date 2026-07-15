import { db } from '../db';
import type { Mood, Transaction } from '../types';
import type { Minor, MonthKey } from '../../lib/types';
import { getMonthRange, shiftMonthKey } from '../../lib/fiscal';
import { addDaysISO, isoWeekdayOf, todayISO } from '../../lib/dates';
import { computeMonthMetrics } from '../../lib/stats';

async function monthTxns(monthKey: MonthKey, startDay: number): Promise<Transaction[]> {
  const range = getMonthRange(monthKey, startDay);
  return db.transactions.where('date').between(range.start, range.end, true, true).toArray();
}

/** Dürtü Endeksi dial + trailing series (§9.11.1). */
export async function getDurtuSeries(
  currentKey: MonthKey,
  startDay: number,
  months: number,
): Promise<{ monthKey: MonthKey; index: number | null }[]> {
  const result = [];
  for (let back = months - 1; back >= 0; back--) {
    const monthKey = shiftMonthKey(currentKey, -back);
    const metrics = computeMonthMetrics(await monthTxns(monthKey, startDay), 0);
    result.push({ monthKey, index: metrics.durtuIndex });
  }
  return result;
}

/** 12-month cumulative savings line + goal-completion months (§9.11.2). */
export async function getSavingsLine(
  currentKey: MonthKey,
  startDay: number,
  months: number,
): Promise<{
  points: { monthKey: MonthKey; cumulativeMinor: Minor }[];
  completionMonths: Set<MonthKey>;
} | null> {
  const [entries, goals] = await Promise.all([
    db.savingsEntries.toArray(),
    db.savingsGoals.toArray(),
  ]);
  if (entries.length === 0) return null;

  const points = [];
  for (let back = months - 1; back >= 0; back--) {
    const monthKey = shiftMonthKey(currentKey, -back);
    const { end } = getMonthRange(monthKey, startDay);
    points.push({
      monthKey,
      cumulativeMinor: entries
        .filter((e) => e.date <= end)
        .reduce((s, e) => s + e.amountMinor, 0),
    });
  }

  // A goal "completes" in the month its running total first crosses target.
  const completionMonths = new Set<MonthKey>();
  for (const goal of goals) {
    const target = goal.targetAmountMinor;
    if (!target) continue;
    const goalEntries = entries
      .filter((e) => e.goalId === goal.id)
      .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
    let running = 0;
    for (const e of goalEntries) {
      const before = running;
      running += e.amountMinor;
      if (before < target && running >= target) {
        completionMonths.add(e.date.slice(0, 7) as MonthKey);
        break;
      }
    }
  }
  return { points, completionMonths };
}

/** Boş oranı per month (§9.11.3). */
export async function getBosTrend(
  currentKey: MonthKey,
  startDay: number,
  months: number,
): Promise<{ monthKey: MonthKey; bosRate: number | null }[]> {
  const result = [];
  for (let back = months - 1; back >= 0; back--) {
    const monthKey = shiftMonthKey(currentKey, -back);
    const metrics = computeMonthMetrics(await monthTxns(monthKey, startDay), 0);
    result.push({ monthKey, bosRate: metrics.bosRate });
  }
  return result;
}

/** Honesty card (§9.11.4): istek→bos conversions, min 5 original-istek. */
export async function getHonesty(
  monthKey: MonthKey,
  startDay: number,
): Promise<{ originalIstekCount: number; istekToBosCount: number } | null> {
  const metrics = computeMonthMetrics(await monthTxns(monthKey, startDay), 0);
  if (metrics.originalIstekCount < 5) return null;
  return {
    originalIstekCount: metrics.originalIstekCount,
    istekToBosCount: metrics.istekToBosCount,
  };
}

export interface MoodImpactRow {
  mood: Mood;
  badShare: number; // boş+pişman amount share for this mood
  n: number;
}

/**
 * Mood correlations (§9.11.5) — ALL TIME, because per-month samples are too
 * small to mean anything (documented §0.7 choice). Guarded at n ≥ 5.
 */
export async function getMoodImpact(): Promise<{
  rows: MoodImpactRow[];
  overallBadShare: number;
} | null> {
  const txns = await db.transactions.toArray();
  const expenses = txns.filter((t) => t.type === 'expense' && t.date <= todayISO());
  if (expenses.length === 0) return null;

  const bad = (t: Transaction) => t.necessity === 'bos' || t.regret === 'pisman';
  const total = expenses.reduce((s, t) => s + t.amountMinor, 0);
  const badTotal = expenses.filter(bad).reduce((s, t) => s + t.amountMinor, 0);
  if (total === 0) return null;

  const byMood = new Map<Mood, { amount: Minor; badAmount: Minor; n: number }>();
  for (const t of expenses) {
    if (!t.mood) continue;
    const row = byMood.get(t.mood) ?? { amount: 0, badAmount: 0, n: 0 };
    row.amount += t.amountMinor;
    row.n++;
    if (bad(t)) row.badAmount += t.amountMinor;
    byMood.set(t.mood, row);
  }

  const rows = [...byMood.entries()]
    .filter(([, r]) => r.n >= 5 && r.amount > 0)
    .map(([mood, r]) => ({ mood, badShare: r.badAmount / r.amount, n: r.n }))
    .sort((a, b) => b.badShare - a.badShare);
  if (rows.length === 0) return null;
  return { rows, overallBadShare: badTotal / total };
}

/** Avg spend per weekday occurrence within the month (§9.11.6). */
export async function getWeekdaySpend(
  monthKey: MonthKey,
  startDay: number,
): Promise<{ weekday: number; avgMinor: Minor }[] | null> {
  const range = getMonthRange(monthKey, startDay);
  const txns = await monthTxns(monthKey, startDay);
  const spent = new Map<number, Minor>();
  for (const t of txns) {
    if (t.type !== 'expense' || t.date > todayISO()) continue;
    const wd = isoWeekdayOf(t.date);
    spent.set(wd, (spent.get(wd) ?? 0) + t.amountMinor);
  }
  if (spent.size === 0) return null;

  // Count elapsed occurrences of each weekday in the month.
  const counts = new Map<number, number>();
  const last = range.end < todayISO() ? range.end : todayISO();
  for (let d = range.start; d <= last; d = addDaysISO(d, 1)) {
    const wd = isoWeekdayOf(d);
    counts.set(wd, (counts.get(wd) ?? 0) + 1);
  }
  return Array.from({ length: 7 }, (_, i) => {
    const wd = i + 1;
    const c = counts.get(wd) ?? 0;
    return { weekday: wd, avgMinor: c > 0 ? Math.round((spent.get(wd) ?? 0) / c) : 0 };
  });
}

export interface RegretChampion {
  categoryId: string;
  regretRate: number;
  reviewedCount: number;
}

/** Top categories by regret rate, min 3 reviewed items (§9.11.7). */
export async function getRegretChampions(
  monthKey: MonthKey,
  startDay: number,
): Promise<RegretChampion[]> {
  const txns = await monthTxns(monthKey, startDay);
  const byCat = new Map<string, { reviewed: Minor; pisman: Minor; n: number }>();
  for (const t of txns) {
    if (t.type !== 'expense' || !t.reviewedAt) continue;
    const row = byCat.get(t.categoryId) ?? { reviewed: 0, pisman: 0, n: 0 };
    row.reviewed += t.amountMinor;
    row.n++;
    if (t.regret === 'pisman') row.pisman += t.amountMinor;
    byCat.set(t.categoryId, row);
  }
  return [...byCat.entries()]
    .filter(([, r]) => r.n >= 3 && r.reviewed > 0 && r.pisman > 0)
    .map(([categoryId, r]) => ({
      categoryId,
      regretRate: r.pisman / r.reviewed,
      reviewedCount: r.n,
    }))
    .sort((a, b) => b.regretRate - a.regretRate)
    .slice(0, 5);
}

/** Top merchants by total (§9.11.8). */
export async function getTopMerchants(
  monthKey: MonthKey,
  startDay: number,
): Promise<{ merchant: string; totalMinor: Minor; n: number }[]> {
  const txns = await monthTxns(monthKey, startDay);
  const byMerchant = new Map<string, { totalMinor: Minor; n: number }>();
  for (const t of txns) {
    if (t.type !== 'expense' || !t.merchant) continue;
    const row = byMerchant.get(t.merchant) ?? { totalMinor: 0, n: 0 };
    row.totalMinor += t.amountMinor;
    row.n++;
    byMerchant.set(t.merchant, row);
  }
  return [...byMerchant.entries()]
    .map(([merchant, r]) => ({ merchant, ...r }))
    .sort((a, b) => b.totalMinor - a.totalMinor)
    .slice(0, 5);
}

/** Biggest category deltas vs previous fiscal month (§9.11.9). */
export async function getMonthDeltas(
  monthKey: MonthKey,
  startDay: number,
): Promise<{ categoryId: string; deltaMinor: Minor }[]> {
  const [current, previous] = await Promise.all([
    monthTxns(monthKey, startDay),
    monthTxns(shiftMonthKey(monthKey, -1), startDay),
  ]);
  const sum = (txns: Transaction[]) => {
    const m = new Map<string, Minor>();
    for (const t of txns) {
      if (t.type !== 'expense') continue;
      m.set(t.categoryId, (m.get(t.categoryId) ?? 0) + t.amountMinor);
    }
    return m;
  };
  const cur = sum(current);
  const prev = sum(previous);
  if (prev.size === 0) return [];
  const ids = new Set([...cur.keys(), ...prev.keys()]);
  return [...ids]
    .map((categoryId) => ({
      categoryId,
      deltaMinor: (cur.get(categoryId) ?? 0) - (prev.get(categoryId) ?? 0),
    }))
    .filter((d) => d.deltaMinor !== 0)
    .sort((a, b) => Math.abs(b.deltaMinor) - Math.abs(a.deltaMinor))
    .slice(0, 5);
}

/** Reviewed items, newest first — Pazar Muhasebesi history (§9.11). */
export async function getReviewHistory(limit = 50): Promise<Transaction[]> {
  const txns = await db.transactions.toArray();
  return txns
    .filter((t) => t.reviewedAt)
    .sort((a, b) => (b.reviewedAt ?? '').localeCompare(a.reviewedAt ?? ''))
    .slice(0, limit);
}
