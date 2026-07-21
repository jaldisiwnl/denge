import { db } from '../db';
import { stripUndefined } from '../util';
import type { Obligation, ObligationKind } from '../types';
import type { ISODate, Minor, UUID } from '../../lib/types';
import { getMonthKey, getMonthRange, shiftMonthKey } from '../../lib/fiscal';
import { dueDates } from '../../lib/recurrence';
import { addDaysISO, todayISO } from '../../lib/dates';
import {
  applyPayment,
  obligationDueDates,
  sortForecast,
  type ForecastEntry,
} from '../../lib/payments';
import { addTransaction } from './transactions';

export function listObligations(includeInactive = false): Promise<Obligation[]> {
  return db.obligations
    .toArray()
    .then((all) => (includeInactive ? all : all.filter((o) => o.isActive)));
}

export interface ObligationDraft {
  kind: ObligationKind;
  title: string;
  amountMinor: Minor;
  categoryId?: UUID;
  dayOfMonth?: number;
  dueDate?: ISODate;
  remainingMinor?: Minor;
  autoPost: boolean;
  note?: string;
}

export async function addObligation(draft: ObligationDraft): Promise<Obligation> {
  const ob: Obligation = stripUndefined({
    id: crypto.randomUUID(),
    isActive: true,
    createdAt: new Date().toISOString(),
    // Recurring kinds start "yesterday" so a due-today occurrence surfaces
    // immediately without back-filling history before it existed.
    lastPostedDate:
      draft.kind !== 'planli' && draft.dayOfMonth !== undefined
        ? addDaysISO(todayISO(), -1)
        : undefined,
    ...draft,
  });
  await db.obligations.add(ob);
  return ob;
}

export async function updateObligation(
  id: UUID,
  patch: Partial<ObligationDraft> & { isActive?: boolean },
): Promise<void> {
  const existing = await db.obligations.get(id);
  if (!existing) return;
  await db.obligations.put(stripUndefined({ ...existing, ...patch }));
}

export async function deleteObligation(id: UUID): Promise<void> {
  await db.obligations.delete(id);
}

/**
 * Records a payment: writes the expense transaction (merchant = title) and
 * updates the obligation. For a due monthly occurrence, advances
 * lastPostedDate; for a debt, reduces the remaining balance and deactivates
 * when it hits zero; for planli, marks it paid and done.
 */
export async function payObligation(
  ob: Obligation,
  opts: { dueDate?: ISODate; amountMinor?: Minor } = {},
): Promise<void> {
  const amountMinor = opts.amountMinor ?? ob.amountMinor;
  await db.transaction('rw', db.transactions, db.obligations, async () => {
    if (ob.categoryId) {
      await addTransaction({
        type: 'expense',
        amountMinor,
        categoryId: ob.categoryId,
        date: opts.dueDate ?? todayISO(),
        merchant: ob.title,
        necessity: 'gerekli', // obligations are commitments, not wants
        note: ob.note,
      });
    }
    const patch: Partial<Obligation> = {};
    if (ob.kind === 'planli') {
      patch.isActive = false;
      patch.paidAt = new Date().toISOString();
    } else {
      if (opts.dueDate) patch.lastPostedDate = opts.dueDate;
      if (ob.remainingMinor !== undefined) {
        const remaining = applyPayment(ob.remainingMinor, amountMinor);
        patch.remainingMinor = remaining;
        if (remaining === 0) patch.isActive = false;
      }
    }
    await db.obligations.update(ob.id, stripUndefined(patch));
  });
}

/** Auto-posts due 'kart' obligations with autoPost on app open (like §8.7). */
export async function postDueObligations(today: ISODate): Promise<void> {
  const obligations = await db.obligations.toArray();
  for (const ob of obligations) {
    if (!ob.isActive || !ob.autoPost || ob.kind !== 'kart') continue;
    const due = obligationDueDates(ob, addDaysISO(today, -370), today);
    for (const date of due) {
      // payObligation is transactional per call; idempotent via lastPostedDate.
      await payObligation(ob, { dueDate: date });
    }
  }
}

export interface UpcomingItem extends ForecastEntry {
  autoPost: boolean;
  categoryId?: UUID;
  amountEditable: boolean; // debts/cards can be paid with a different amount
}

/**
 * The dashboard reminder list: obligation occurrences due within `days` from
 * today (past-due included, so nothing slips). Auto-posting cards are
 * excluded — they settle themselves.
 */
export async function listUpcomingObligations(
  today: ISODate,
  days = 7,
): Promise<UpcomingItem[]> {
  const horizon = addDaysISO(today, days);
  const obligations = await db.obligations.toArray();
  const items: UpcomingItem[] = [];
  for (const ob of obligations) {
    if (!ob.isActive || ob.autoPost) continue;
    // Look back so an occurrence whose day already passed still nags.
    const due = obligationDueDates(ob, addDaysISO(today, -370), horizon);
    const next = due.find((d) => d > (ob.lastPostedDate ?? '')); // earliest unpaid
    if (!next) continue;
    items.push({
      date: next,
      title: ob.title,
      amountMinor: ob.amountMinor,
      kind: ob.kind,
      sourceId: ob.id,
      autoPost: ob.autoPost,
      categoryId: ob.categoryId,
      amountEditable: ob.kind !== 'planli',
    });
  }
  return sortForecast(items) as UpcomingItem[];
}

export interface ForecastMonth {
  monthKey: string;
  label: ISODate; // first day, for formatting
  entries: ForecastEntry[];
  totalMinor: Minor;
}

/**
 * Full "what goes out when" calendar for a fiscal month: recurring expense
 * rules + obligation occurrences, merged and sorted. This is the Ödemeler
 * screen's headline (madde 1+2+5).
 */
export async function getPaymentForecast(
  monthKey: string,
  startDay: number,
): Promise<ForecastMonth> {
  const { start, end } = getMonthRange(monthKey, startDay);
  const [rules, obligations] = await Promise.all([
    db.recurringRules.toArray(),
    db.obligations.toArray(),
  ]);
  const entries: ForecastEntry[] = [];

  for (const rule of rules) {
    if (!rule.isActive || rule.type !== 'expense') continue;
    // Forecast shows the whole month regardless of what's posted, so callers
    // see the full picture; use the month window, not lastPostedDate.
    for (const date of dueDates(rule, addDaysISO(start, -1), end)) {
      entries.push({
        date,
        title: rule.name,
        amountMinor: rule.amountMinor,
        kind: rule.isSubscription ? 'abonelik' : 'sabit',
        sourceId: rule.id,
      });
    }
  }

  for (const ob of obligations) {
    if (!ob.isActive) continue;
    for (const date of obligationDueDates(
      { ...ob, lastPostedDate: undefined },
      start,
      end,
    )) {
      entries.push({
        date,
        title: ob.title,
        amountMinor: ob.amountMinor,
        kind: ob.kind,
        sourceId: ob.id,
      });
    }
  }

  const sorted = sortForecast(entries);
  return {
    monthKey,
    label: start,
    entries: sorted,
    totalMinor: sorted.reduce((s, e) => s + e.amountMinor, 0),
  };
}

/** Convenience: this fiscal month + next, for the screen's toggle. */
export async function getForecastMonths(
  today: ISODate,
  startDay: number,
): Promise<[ForecastMonth, ForecastMonth]> {
  const current = getMonthKey(today, startDay);
  return Promise.all([
    getPaymentForecast(current, startDay),
    getPaymentForecast(shiftMonthKey(current, 1), startDay),
  ]);
}
