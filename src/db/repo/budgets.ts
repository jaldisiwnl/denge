import { db } from '../db';
import type { Budget } from '../types';
import type { Minor, MonthKey, UUID } from '../../lib/types';
import { getMonthRange, shiftMonthKey } from '../../lib/fiscal';
import { effectiveEnvelope, suggestEnvelope } from '../../lib/budget';

export interface EnvelopeStatus {
  categoryId: UUID;
  baseMinor: Minor; // override ?? default for the month
  totalMinor: Minor; // base + rollover
  rolloverMinor: Minor;
  spentMinor: Minor;
}

async function spentInCategory(
  categoryId: UUID,
  monthKey: MonthKey,
  startDay: number,
): Promise<Minor> {
  const { start, end } = getMonthRange(monthKey, startDay);
  const txns = await db.transactions
    .where('date')
    .between(start, end, true, true)
    .toArray();
  return txns
    .filter((t) => t.type === 'expense' && t.categoryId === categoryId)
    .reduce((sum, t) => sum + t.amountMinor, 0);
}

export function getBudget(categoryId: UUID): Promise<Budget | undefined> {
  return db.budgets.where('categoryId').equals(categoryId).first();
}

export async function upsertBudget(
  categoryId: UUID,
  amountMinor: Minor,
  rollover: boolean,
): Promise<void> {
  const existing = await getBudget(categoryId);
  if (existing) {
    await db.budgets.update(existing.id, { amountMinor, rollover });
  } else {
    await db.budgets.add({ id: crypto.randomUUID(), categoryId, amountMinor, rollover });
  }
}

/** Removing an envelope also clears its month overrides. */
export async function deleteBudget(categoryId: UUID): Promise<void> {
  await db.transaction('rw', db.budgets, db.budgetOverrides, async () => {
    const existing = await getBudget(categoryId);
    if (existing) await db.budgets.delete(existing.id);
    await db.budgetOverrides.where('categoryId').equals(categoryId).delete();
  });
}

export function getOverride(categoryId: UUID, monthKey: MonthKey) {
  return db.budgetOverrides
    .where('[categoryId+monthKey]')
    .equals([categoryId, monthKey])
    .first();
}

/** amountMinor = null clears the override for that month. */
export async function setOverride(
  categoryId: UUID,
  monthKey: MonthKey,
  amountMinor: Minor | null,
): Promise<void> {
  const existing = await getOverride(categoryId, monthKey);
  if (amountMinor === null) {
    if (existing) await db.budgetOverrides.delete(existing.id);
    return;
  }
  if (existing) {
    await db.budgetOverrides.update(existing.id, { amountMinor });
  } else {
    await db.budgetOverrides.add({
      id: crypto.randomUUID(),
      categoryId,
      monthKey,
      amountMinor,
    });
  }
}

/** Full envelope status for one category+month; null when no budget set. */
export async function getEnvelopeStatus(
  categoryId: UUID,
  monthKey: MonthKey,
  startDay: number,
): Promise<EnvelopeStatus | null> {
  const budget = await getBudget(categoryId);
  if (!budget) return null;

  const override = await getOverride(categoryId, monthKey);
  const baseMinor = override?.amountMinor ?? budget.amountMinor;

  let prevBaseMinor: Minor | undefined;
  let prevSpentMinor: Minor | undefined;
  if (budget.rollover) {
    const prevKey = shiftMonthKey(monthKey, -1);
    const prevOverride = await getOverride(categoryId, prevKey);
    prevBaseMinor = prevOverride?.amountMinor ?? budget.amountMinor;
    prevSpentMinor = await spentInCategory(categoryId, prevKey, startDay);
  }

  const { totalMinor, rolloverMinor } = effectiveEnvelope({
    baseMinor,
    rollover: budget.rollover,
    prevBaseMinor,
    prevSpentMinor,
  });
  const spentMinor = await spentInCategory(categoryId, monthKey, startDay);
  return { categoryId, baseMinor, totalMinor, rolloverMinor, spentMinor };
}

/** Statuses for every budgeted category in one month. */
export async function listEnvelopeStatuses(
  monthKey: MonthKey,
  startDay: number,
): Promise<EnvelopeStatus[]> {
  const budgets = await db.budgets.toArray();
  return Promise.all(
    budgets.map(
      (b) =>
        getEnvelopeStatus(b.categoryId, monthKey, startDay) as Promise<EnvelopeStatus>,
    ),
  );
}

/** Suggestion chip (§9.5): median spend of the previous 3 fiscal months. */
export async function suggestForCategory(
  categoryId: UUID,
  currentMonthKey: MonthKey,
  startDay: number,
): Promise<Minor | null> {
  const spends = await Promise.all(
    [1, 2, 3].map((back) =>
      spentInCategory(categoryId, shiftMonthKey(currentMonthKey, -back), startDay),
    ),
  );
  return suggestEnvelope(spends);
}
