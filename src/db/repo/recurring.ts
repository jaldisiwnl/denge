import { db } from '../db';
import { stripUndefined } from '../util';
import type { Necessity, RecurringRule, Transaction } from '../types';
import type { ISODate, Minor, UUID } from '../../lib/types';
import { dueDates } from '../../lib/recurrence';
import { addDaysISO, todayISO } from '../../lib/dates';

export function listRules(): Promise<RecurringRule[]> {
  return db.recurringRules.toArray();
}

export interface RuleDraft {
  name: string;
  amountMinor: Minor;
  categoryId: UUID;
  type: 'expense' | 'income';
  cadence: 'monthly' | 'weekly' | 'yearly';
  dayOfMonth?: number;
  month?: number;
  weekday?: number;
  isSubscription: boolean;
  autoPost: boolean;
  necessity?: Necessity;
}

export async function addRule(draft: RuleDraft): Promise<RecurringRule> {
  const rule: RecurringRule = stripUndefined({
    id: crypto.randomUUID(),
    isActive: true,
    // History starts at creation: seeding "yesterday" makes an occurrence
    // due today post immediately, and never backfills before the rule existed.
    lastPostedDate: addDaysISO(todayISO(), -1),
    ...draft,
  });
  await db.recurringRules.add(rule);
  return rule;
}

export async function updateRule(
  id: UUID,
  patch: Partial<RuleDraft> & { isActive?: boolean },
): Promise<void> {
  const existing = await db.recurringRules.get(id);
  if (!existing) return;
  const next = stripUndefined({ ...existing, ...patch });
  // Reactivating a paused rule must NOT backfill the paused period with
  // phantom transactions — posting resumes from today (P3/P4 review fix).
  if (patch.isActive === true && !existing.isActive) {
    next.lastPostedDate = addDaysISO(todayISO(), -1);
  }
  await db.recurringRules.put(next);
}

/** Posted transactions keep their recurringRuleId; only the rule goes. */
export async function deleteRule(id: UUID): Promise<void> {
  await db.recurringRules.delete(id);
}

function buildPostedTransaction(rule: RecurringRule, date: ISODate): Transaction {
  const necessity =
    rule.type === 'expense' ? (rule.necessity ?? 'gerekli') : undefined;
  return stripUndefined({
    id: crypto.randomUUID(),
    type: rule.type,
    amountMinor: rule.amountMinor,
    categoryId: rule.categoryId,
    date,
    createdAt: new Date().toISOString(),
    merchant: rule.name, // makes list rows readable ("Spotify")
    necessity,
    necessityOriginal: necessity,
    recurringRuleId: rule.id,
  });
}

/**
 * Auto-posts every due occurrence of active autoPost rules (§8.7). Runs on
 * app open and window focus (§6). Idempotent: the window's lower bound is
 * the persisted lastPostedDate, and both the inserts and the bound update
 * commit in one Dexie transaction.
 */
export async function postDueRecurring(today: ISODate): Promise<void> {
  await db.transaction('rw', db.recurringRules, db.transactions, async () => {
    const rules = await db.recurringRules.toArray();
    for (const rule of rules) {
      if (!rule.isActive || !rule.autoPost) continue;
      const from = rule.lastPostedDate ?? addDaysISO(today, -1);
      const due = dueDates(rule, from, today);
      if (due.length === 0) continue;
      await db.transactions.bulkAdd(due.map((d) => buildPostedTransaction(rule, d)));
      await db.recurringRules.update(rule.id, { lastPostedDate: due[due.length - 1] });
    }
  });
}

export interface PendingConfirmation {
  rule: RecurringRule;
  dueDate: ISODate;
}

/**
 * Earliest unhandled occurrence per active non-autoPost rule — the
 * "Bekleyen sabitler" dashboard cards (§9.6). Confirming/skipping advances
 * lastPostedDate one occurrence at a time, so stacked misses surface in order.
 */
export async function listPendingConfirmations(
  today: ISODate,
): Promise<PendingConfirmation[]> {
  const rules = await db.recurringRules.toArray();
  const pending: PendingConfirmation[] = [];
  for (const rule of rules) {
    if (!rule.isActive || rule.autoPost) continue;
    const from = rule.lastPostedDate ?? addDaysISO(today, -1);
    const due = dueDates(rule, from, today);
    if (due[0]) pending.push({ rule, dueDate: due[0] });
  }
  return pending.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

export async function confirmPending(rule: RecurringRule, dueDate: ISODate): Promise<void> {
  await db.transaction('rw', db.recurringRules, db.transactions, async () => {
    await db.transactions.add(buildPostedTransaction(rule, dueDate));
    await db.recurringRules.update(rule.id, { lastPostedDate: dueDate });
  });
}

/** "Bu ay atla": advances past the occurrence without posting. */
export async function skipPending(rule: RecurringRule, dueDate: ISODate): Promise<void> {
  await db.recurringRules.update(rule.id, { lastPostedDate: dueDate });
}
