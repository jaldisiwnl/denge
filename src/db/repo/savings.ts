import { db } from '../db';
import { stripUndefined } from '../util';
import type { SavingsEntry, SavingsGoal } from '../types';
import type { ISODate, Minor, MonthKey, UUID } from '../../lib/types';
import { getMonthRange, shiftMonthKey } from '../../lib/fiscal';
import { addDaysISO, todayISO } from '../../lib/dates';

// Kumbara semantics (§9.13): Denge tracks savings *decisions*; the actual
// money lives wherever the owner keeps it (bank, cash). A deposit is a
// commitment marker that reduces safe-to-spend (§8.3). Withdrawals can
// never take a goal below zero (§17).

export async function listGoals(includeArchived = false): Promise<SavingsGoal[]> {
  const all = await db.savingsGoals.toArray();
  return all
    .filter((g) => includeArchived || !g.isArchived)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function createGoal(input: {
  name: string;
  emoji?: string;
  targetAmountMinor?: Minor;
  deadline?: ISODate;
}): Promise<SavingsGoal> {
  const goal: SavingsGoal = stripUndefined({
    id: crypto.randomUUID(),
    name: input.name,
    emoji: input.emoji ?? '🎯',
    targetAmountMinor: input.targetAmountMinor,
    deadline: input.deadline,
    createdAt: new Date().toISOString(),
    isArchived: false,
  });
  await db.savingsGoals.add(goal);
  return goal;
}

export async function updateGoal(
  id: UUID,
  patch: Partial<Pick<SavingsGoal, 'name' | 'emoji' | 'targetAmountMinor' | 'deadline'>>,
): Promise<void> {
  const existing = await db.savingsGoals.get(id);
  if (!existing) return;
  await db.savingsGoals.put(stripUndefined({ ...existing, ...patch }));
}

/** Deleting a goal is forbidden (§17) — archive only, entries preserved. */
export async function setGoalArchived(id: UUID, isArchived: boolean): Promise<void> {
  await db.savingsGoals.update(id, { isArchived });
}

/** Net saved per goal (deposits − withdrawals). */
export async function goalTotals(): Promise<Map<UUID, Minor>> {
  const entries = await db.savingsEntries.toArray();
  const totals = new Map<UUID, Minor>();
  for (const e of entries) {
    totals.set(e.goalId, (totals.get(e.goalId) ?? 0) + e.amountMinor);
  }
  return totals;
}

export interface AddEntryResult {
  entry: SavingsEntry;
  /** True when this deposit pushed the goal to/past its target (§9.13). */
  completedGoal: boolean;
}

/**
 * Adds a deposit (+) or withdrawal (−). Returns null when a withdrawal
 * would take the goal below zero (§17).
 */
export async function addSavingsEntry(input: {
  goalId: UUID;
  amountMinor: Minor;
  source: SavingsEntry['source'];
  note?: string;
  wishlistItemId?: UUID;
  date?: ISODate;
}): Promise<AddEntryResult | null> {
  return db.transaction('rw', db.savingsEntries, db.savingsGoals, async () => {
    const entries = await db.savingsEntries
      .where('goalId')
      .equals(input.goalId)
      .toArray();
    const before = entries.reduce((s, e) => s + e.amountMinor, 0);
    if (before + input.amountMinor < 0) return null;

    const entry: SavingsEntry = stripUndefined({
      id: crypto.randomUUID(),
      goalId: input.goalId,
      amountMinor: input.amountMinor,
      date: input.date ?? todayISO(),
      createdAt: new Date().toISOString(),
      source: input.source,
      note: input.note,
      wishlistItemId: input.wishlistItemId,
    });
    await db.savingsEntries.add(entry);

    const goal = await db.savingsGoals.get(input.goalId);
    const target = goal?.targetAmountMinor;
    const completedGoal = Boolean(
      target && before < target && before + input.amountMinor >= target,
    );
    return { entry, completedGoal };
  });
}

export async function listGoalEntries(goalId: UUID): Promise<SavingsEntry[]> {
  const entries = await db.savingsEntries.where('goalId').equals(goalId).toArray();
  return entries.sort(
    (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
  );
}

export async function totalSavedMinor(): Promise<Minor> {
  const entries = await db.savingsEntries.toArray();
  return entries.reduce((s, e) => s + e.amountMinor, 0);
}

/** Net deposits within one fiscal month ("Bu ay +₺X", §9.7.3). */
export async function savedInMonthMinor(
  monthKey: MonthKey,
  startDay: number,
): Promise<Minor> {
  const range = getMonthRange(monthKey, startDay);
  const entries = await db.savingsEntries
    .where('date')
    .between(range.start, range.end, true, true)
    .toArray();
  return entries.reduce((s, e) => s + e.amountMinor, 0);
}

/** Cumulative totals for the last N fiscal months (sparkline §9.7.3). */
export async function cumulativeByMonth(
  currentMonthKey: MonthKey,
  startDay: number,
  months: number,
): Promise<{ monthKey: MonthKey; cumulativeMinor: Minor }[]> {
  const all = await db.savingsEntries.toArray();
  const result: { monthKey: MonthKey; cumulativeMinor: Minor }[] = [];
  for (let back = months - 1; back >= 0; back--) {
    const monthKey = shiftMonthKey(currentMonthKey, -back);
    const { end } = getMonthRange(monthKey, startDay);
    const cumulativeMinor = all
      .filter((e) => e.date <= end)
      .reduce((s, e) => s + e.amountMinor, 0);
    result.push({ monthKey, cumulativeMinor });
  }
  return result;
}

/**
 * Projected finish (§9.13): trailing 3-month average deposit rate. Hidden
 * (null) with less than ~2 months of entry history or a non-positive rate.
 */
export async function projectedFinish(
  goal: SavingsGoal,
  savedMinor: Minor,
): Promise<ISODate | null> {
  if (!goal.targetAmountMinor || savedMinor >= goal.targetAmountMinor) return null;
  const entries = await db.savingsEntries.where('goalId').equals(goal.id).toArray();
  if (entries.length === 0) return null;
  const firstDate = entries.map((e) => e.date).sort()[0]!;
  const today = todayISO();
  const spanDays =
    (new Date(today).getTime() - new Date(firstDate).getTime()) / 86_400_000;
  if (spanDays < 60) return null; // <2 months of data

  const windowStart = addDaysISO(today, -90);
  const recentNet = entries
    .filter((e) => e.date >= windowStart)
    .reduce((s, e) => s + e.amountMinor, 0);
  const monthlyRate = recentNet / 3;
  if (monthlyRate <= 0) return null;

  const monthsLeft = (goal.targetAmountMinor - savedMinor) / monthlyRate;
  return addDaysISO(today, Math.ceil(monthsLeft * 30));
}
