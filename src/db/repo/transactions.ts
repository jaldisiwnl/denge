import { db } from '../db';
import { stripUndefined } from '../util';
import type { Mood, Necessity, Regret, Transaction } from '../types';
import type { ISODate, Minor, MonthKey, UUID } from '../../lib/types';
import { getMonthRange } from '../../lib/fiscal';

export interface TransactionDraft {
  type: 'expense' | 'income';
  amountMinor: Minor;
  categoryId: UUID;
  date: ISODate;
  note?: string;
  merchant?: string;
  necessity?: Necessity;
  mood?: Mood;
  templateId?: UUID;
  recurringRuleId?: UUID;
  wishlistItemId?: UUID;
  isBackfilled?: boolean;
}

export async function addTransaction(draft: TransactionDraft): Promise<Transaction> {
  const txn: Transaction = stripUndefined({
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    ...draft,
    // Honesty baseline (§9.2): frozen at first save, never changes again.
    necessityOriginal: draft.type === 'expense' ? draft.necessity : undefined,
  });
  await db.transactions.add(txn);
  return txn;
}

export interface TransactionPatch {
  amountMinor?: Minor;
  categoryId?: UUID;
  date?: ISODate;
  note?: string;
  merchant?: string;
  necessity?: Necessity;
  mood?: Mood;
  regret?: Regret; // detail-edit answer (§7: "or transaction detail")
}

/**
 * Edits outside the review flow: a necessity change marks the revision and
 * clears any prior regret answer (§9.2) — the question must be re-asked.
 * A regret given in the same edit is a fresh answer and wins afterwards.
 */
export async function updateTransaction(
  id: UUID,
  patch: TransactionPatch,
): Promise<void> {
  const existing = await db.transactions.get(id);
  if (!existing) return;
  const { regret, ...fields } = patch;
  const next: Transaction = { ...existing, ...fields };
  if (patch.necessity && patch.necessity !== existing.necessity) {
    next.necessityRevisedAt = new Date().toISOString();
    delete next.regret;
    delete next.reviewedAt;
  }
  if (regret && next.necessity !== 'gerekli') {
    next.regret = regret;
    next.reviewedAt = new Date().toISOString();
  }
  await db.transactions.put(stripUndefined(next));
}

/**
 * The Pazar Muhasebesi path (§9.8): reclassifying here does NOT clear a
 * regret answered in the same flow — except reclassify-to-gerekli, which
 * clears regret and retires the item from review entirely (§17).
 */
export async function reviewTransaction(
  id: UUID,
  patch: { necessity?: Necessity; regret?: Regret },
): Promise<void> {
  const existing = await db.transactions.get(id);
  if (!existing) return;
  const next: Transaction = { ...existing };
  if (patch.necessity && patch.necessity !== existing.necessity) {
    next.necessity = patch.necessity;
    next.necessityRevisedAt = new Date().toISOString();
    if (patch.necessity === 'gerekli') {
      delete next.regret;
      delete next.reviewedAt;
    }
  }
  if (patch.regret && next.necessity !== 'gerekli') {
    next.regret = patch.regret;
    next.reviewedAt = new Date().toISOString();
  }
  await db.transactions.put(stripUndefined(next));
}

/** Unreviewed istek/boş expenses inside the review window (§9.8). */
export async function listReviewItems(window: {
  start: ISODate;
  end: ISODate;
}): Promise<Transaction[]> {
  const txns = await db.transactions
    .where('date')
    .between(window.start, window.end, true, true)
    .toArray();
  return txns
    .filter(
      (t) =>
        t.type === 'expense' &&
        (t.necessity === 'istek' || t.necessity === 'bos') &&
        !t.reviewedAt,
    )
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
}

export async function deleteTransaction(id: UUID): Promise<void> {
  await db.transactions.delete(id);
}

/** All transactions of one fiscal month, unsorted (callers sort/group). */
export function listMonthTransactions(
  monthKey: MonthKey,
  startDay: number,
): Promise<Transaction[]> {
  const { start, end } = getMonthRange(monthKey, startDay);
  return db.transactions.where('date').between(start, end, true, true).toArray();
}

/** Usage counts per category since a date — orders quick-add chips (§9.1). */
export async function categoryUsageSince(
  since: ISODate,
): Promise<Map<UUID, number>> {
  const recent = await db.transactions.where('date').aboveOrEqual(since).toArray();
  const counts = new Map<UUID, number>();
  for (const t of recent) {
    counts.set(t.categoryId, (counts.get(t.categoryId) ?? 0) + 1);
  }
  return counts;
}

export function countTransactionsInCategory(categoryId: UUID): Promise<number> {
  return db.transactions.where('categoryId').equals(categoryId).count();
}

/** Moves every transaction of one category to another (reassign flow, §9.4). */
export async function reassignCategory(fromId: UUID, toId: UUID): Promise<void> {
  await db.transactions.where('categoryId').equals(fromId).modify({ categoryId: toId });
}
