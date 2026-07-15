import { db } from '../db';
import { stripUndefined } from '../util';
import type { Necessity, QuickTemplate, Transaction } from '../types';
import type { Minor, UUID } from '../../lib/types';
import { addTransaction } from './transactions';
import { todayISO } from '../../lib/dates';

/** Max 10 to keep the quick-add row scannable (§9.14). */
export const MAX_TEMPLATES = 10;

// Default order = most used first; an explicit manual order wins once the
// user has reordered (all seeded sortOrders are 0 until then) — §9.14.
function sortTemplates(list: QuickTemplate[]): QuickTemplate[] {
  return list.sort(
    (a, b) =>
      a.sortOrder - b.sortOrder ||
      b.usageCount - a.usageCount ||
      a.name.localeCompare(b.name, 'tr'),
  );
}

export async function listTemplates(): Promise<QuickTemplate[]> {
  return sortTemplates(await db.quickTemplates.toArray());
}

export interface TemplateDraft {
  name: string;
  emoji?: string;
  amountMinor: Minor;
  categoryId: UUID;
  necessity: Necessity;
  merchant?: string;
  note?: string;
}

/** Returns null when the 10-template limit is reached. */
export async function addTemplate(
  draft: TemplateDraft,
): Promise<QuickTemplate | null> {
  if ((await db.quickTemplates.count()) >= MAX_TEMPLATES) return null;
  const template: QuickTemplate = stripUndefined({
    id: crypto.randomUUID(),
    sortOrder: 0,
    usageCount: 0,
    ...draft,
  });
  await db.quickTemplates.add(template);
  return template;
}

export async function updateTemplate(
  id: UUID,
  patch: Partial<TemplateDraft>,
): Promise<void> {
  const existing = await db.quickTemplates.get(id);
  if (!existing) return;
  await db.quickTemplates.put(stripUndefined({ ...existing, ...patch }));
}

/** Never touches past transactions (§9.14). */
export async function deleteTemplate(id: UUID): Promise<void> {
  await db.quickTemplates.delete(id);
}

/**
 * Moves a template one position up/down. Persists an explicit 1..n order for
 * every template, which permanently switches ordering from usage-based to
 * manual (§9.14: "manual sortOrder wins if user reordered").
 */
export async function moveTemplate(id: UUID, direction: -1 | 1): Promise<void> {
  const list = await listTemplates();
  const index = list.findIndex((t) => t.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= list.length) return;
  const item = list.splice(index, 1)[0]!;
  list.splice(target, 0, item);
  await db.transaction('rw', db.quickTemplates, () =>
    Promise.all(
      list.map((t, i) => db.quickTemplates.update(t.id, { sortOrder: i + 1 })),
    ),
  );
}

/**
 * One-tap path (§9.1): saves with today's date, bumps usageCount.
 * The backfill stepper (§9.15) passes an explicit past date + isBackfilled.
 */
export async function applyTemplate(
  t: QuickTemplate,
  opts?: { date?: string; isBackfilled?: boolean },
): Promise<Transaction> {
  return db.transaction('rw', db.transactions, db.quickTemplates, async () => {
    const txn = await addTransaction({
      type: 'expense',
      amountMinor: t.amountMinor,
      categoryId: t.categoryId,
      date: opts?.date ?? todayISO(),
      note: t.note,
      merchant: t.merchant,
      necessity: t.necessity,
      templateId: t.id,
      isBackfilled: opts?.isBackfilled,
    });
    await db.quickTemplates.update(t.id, { usageCount: t.usageCount + 1 });
    return txn;
  });
}

/** "Kısayol yap" from a transaction detail (§9.3). Null when limit reached. */
export async function createTemplateFromTransaction(
  txn: Transaction,
): Promise<QuickTemplate | null> {
  const category = await db.categories.get(txn.categoryId);
  return addTemplate({
    name: txn.merchant || txn.note || category?.name || '—',
    emoji: category?.emoji,
    amountMinor: txn.amountMinor,
    categoryId: txn.categoryId,
    necessity: txn.necessity ?? 'gerekli',
    merchant: txn.merchant,
    note: txn.note,
  });
}
