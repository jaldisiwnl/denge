import { db } from '../db';
import type { ISODate, Minor, MonthKey, UUID } from '../../lib/types';
import { getDaysRemaining, getMonthKey, getMonthRange, shiftMonthKey } from '../../lib/fiscal';
import { computeSafeToSpend, type SafeToSpend } from '../../lib/stats';
import { dueDates } from '../../lib/recurrence';
import { addDaysISO } from '../../lib/dates';
import { listEnvelopeStatuses } from './budgets';
import { getSettings } from './settings';

export interface HeroData extends SafeToSpend {
  monthKey: MonthKey;
  daysRemaining: number;
  monthLength: number;
  elapsedDays: number;
}

/** Assembles §8.3 inputs for the current fiscal month. */
export async function getHeroData(today: ISODate): Promise<HeroData | null> {
  const settings = await getSettings();
  if (!settings) return null;
  const startDay = settings.monthStartDay;
  const monthKey = getMonthKey(today, startDay);
  const range = getMonthRange(monthKey, startDay);

  const [txns, envelopes, rules, savingsEntries] = await Promise.all([
    db.transactions.where('date').between(range.start, range.end, true, true).toArray(),
    listEnvelopeStatuses(monthKey, startDay),
    db.recurringRules.toArray(),
    db.savingsEntries.where('date').between(range.start, range.end, true, true).toArray(),
  ]);

  // Future-dated transactions are excluded from "spent" (§17).
  const posted = txns.filter((t) => t.date <= today);
  const incomeMinor = posted
    .filter((t) => t.type === 'income')
    .reduce((s, t) => s + t.amountMinor, 0);
  const fixedPostedMinor = posted
    .filter((t) => t.type === 'expense' && t.recurringRuleId)
    .reduce((s, t) => s + t.amountMinor, 0);
  const variableSpentMinor = posted
    .filter((t) => t.type === 'expense' && !t.recurringRuleId)
    .reduce((s, t) => s + t.amountMinor, 0);

  // Unposted occurrences of active expense rules within this fiscal month.
  const dayBeforeStart = addDaysISO(range.start, -1);
  const fixedRemainingMinor = rules
    .filter((r) => r.isActive && r.type === 'expense')
    .reduce((sum, r) => {
      const from =
        r.lastPostedDate && r.lastPostedDate > dayBeforeStart
          ? r.lastPostedDate
          : dayBeforeStart;
      return sum + dueDates(r, from, range.end).length * r.amountMinor;
    }, 0);

  const savedNetMinor = savingsEntries.reduce((s, e) => s + e.amountMinor, 0);

  const daysRemaining = getDaysRemaining(today, monthKey, startDay);
  const monthLength = getDaysRemaining(range.start, monthKey, startDay);

  return {
    ...computeSafeToSpend({
      incomeMinor,
      fallbackIncomeMinor: settings.monthlyNetIncomeMinor ?? 0,
      envelopeTotalMinor:
        envelopes.length > 0
          ? envelopes.reduce((s, e) => s + e.totalMinor, 0)
          : null,
      fixedPostedMinor,
      fixedRemainingMinor,
      variableSpentMinor,
      savedNetMinor,
      daysRemaining,
    }),
    monthKey,
    daysRemaining,
    monthLength,
    elapsedDays: monthLength - daysRemaining + 1,
  };
}

export interface DonutSlice {
  categoryId: UUID | null; // null = "Diğer"
  name: string;
  emoji: string;
  color: string;
  amountMinor: Minor;
}

/** Top 6 expense categories this month + Diğer (§9.7.5). */
export async function getDonutData(
  today: ISODate,
  otherLabel: string,
): Promise<{ slices: DonutSlice[]; totalMinor: Minor } | null> {
  const settings = await getSettings();
  if (!settings) return null;
  const monthKey = getMonthKey(today, settings.monthStartDay);
  const range = getMonthRange(monthKey, settings.monthStartDay);
  const [txns, categories] = await Promise.all([
    db.transactions.where('date').between(range.start, range.end, true, true).toArray(),
    db.categories.toArray(),
  ]);
  const byId = new Map(categories.map((c) => [c.id, c]));

  const sums = new Map<UUID, Minor>();
  let totalMinor = 0;
  for (const t of txns) {
    if (t.type !== 'expense' || t.date > today) continue;
    sums.set(t.categoryId, (sums.get(t.categoryId) ?? 0) + t.amountMinor);
    totalMinor += t.amountMinor;
  }
  if (totalMinor === 0) return { slices: [], totalMinor: 0 };

  const ranked = [...sums.entries()].sort((a, b) => b[1] - a[1]);
  const top = ranked.slice(0, 6).map(([id, amountMinor]): DonutSlice => {
    const c = byId.get(id);
    return {
      categoryId: id,
      name: c?.name ?? '—',
      emoji: c?.emoji ?? '❔',
      color: c?.color ?? '#5C6884',
      amountMinor,
    };
  });
  const restMinor = ranked.slice(6).reduce((s, [, v]) => s + v, 0);
  if (restMinor > 0) {
    top.push({
      categoryId: null,
      name: otherLabel,
      emoji: '📦',
      color: '#9AA3B8',
      amountMinor: restMinor,
    });
  }
  return { slices: top, totalMinor };
}

export interface TrendMonth {
  monthKey: MonthKey;
  totalMinor: Minor;
  bosMinor: Minor;
}

/** Last 6 fiscal months (oldest first), total spend + boş portion (§9.7.6). */
export async function getTrendData(today: ISODate): Promise<TrendMonth[] | null> {
  const settings = await getSettings();
  if (!settings) return null;
  const startDay = settings.monthStartDay;
  const currentKey = getMonthKey(today, startDay);

  const months: TrendMonth[] = [];
  for (let back = 5; back >= 0; back--) {
    const monthKey = shiftMonthKey(currentKey, -back);
    const range = getMonthRange(monthKey, startDay);
    const txns = await db.transactions
      .where('date')
      .between(range.start, range.end, true, true)
      .toArray();
    let totalMinor = 0;
    let bosMinor = 0;
    for (const t of txns) {
      if (t.type !== 'expense') continue;
      totalMinor += t.amountMinor;
      if (t.necessity === 'bos') bosMinor += t.amountMinor;
    }
    months.push({ monthKey, totalMinor, bosMinor });
  }
  return months;
}

export interface HeatmapDay {
  date: ISODate;
  spentMinor: Minor;
  hasBos: boolean;
  isBackfilled: boolean;
  isFuture: boolean;
}

/** Current fiscal month, day by day, for the custom SVG heatmap (§9.7.7). */
export async function getHeatmapData(
  today: ISODate,
): Promise<{ days: HeatmapDay[]; maxSpentMinor: Minor } | null> {
  const settings = await getSettings();
  if (!settings) return null;
  const monthKey = getMonthKey(today, settings.monthStartDay);
  const range = getMonthRange(monthKey, settings.monthStartDay);
  const txns = await db.transactions
    .where('date')
    .between(range.start, range.end, true, true)
    .toArray();

  const byDay = new Map<ISODate, { spent: Minor; bos: boolean; backfilled: boolean }>();
  for (const t of txns) {
    if (t.type !== 'expense') continue;
    const d = byDay.get(t.date) ?? { spent: 0, bos: false, backfilled: false };
    d.spent += t.amountMinor;
    if (t.necessity === 'bos') d.bos = true;
    if (t.isBackfilled) d.backfilled = true;
    byDay.set(t.date, d);
  }

  const days: HeatmapDay[] = [];
  let maxSpentMinor = 0;
  for (let d = range.start; d <= range.end; d = addDaysISO(d, 1)) {
    const info = byDay.get(d);
    days.push({
      date: d,
      spentMinor: info?.spent ?? 0,
      hasBos: info?.bos ?? false,
      isBackfilled: info?.backfilled ?? false,
      isFuture: d > today,
    });
    if (info && info.spent > maxSpentMinor) maxSpentMinor = info.spent;
  }
  return { days, maxSpentMinor };
}
