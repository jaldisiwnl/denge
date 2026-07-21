import { db } from '../db';
import { stripUndefined } from '../util';
import type { WishlistItem } from '../types';
import type { Minor, MonthKey, UUID } from '../../lib/types';
import { getMonthKey, getMonthRange, shiftMonthKey } from '../../lib/fiscal';

export function listWishlist(): Promise<WishlistItem[]> {
  return db.wishlist.toArray();
}

export interface WishDraft {
  title: string;
  estimatedAmountMinor?: Minor;
  url?: string;
  note?: string;
  cooldownHours: number; // default 72 (§9.9)
}

export async function addWishlistItem(draft: WishDraft): Promise<WishlistItem> {
  const item: WishlistItem = stripUndefined({
    id: crypto.randomUUID(),
    addedAt: new Date().toISOString(),
    status: 'bekliyor',
    ...draft,
  });
  await db.wishlist.add(item);
  return item;
}

export async function deleteWishlistItem(id: UUID): Promise<void> {
  await db.wishlist.delete(id);
}

/** Cooldown deadline in epoch ms. */
export function expiresAtMs(item: WishlistItem): number {
  return new Date(item.addedAt).getTime() + item.cooldownHours * 3_600_000;
}

/** "Al": links the purchase transaction (§9.9). */
export async function markPurchased(
  itemId: UUID,
  transactionId: UUID,
): Promise<void> {
  await db.wishlist.update(itemId, {
    status: 'alindi',
    decidedAt: new Date().toISOString(),
    linkedTransactionId: transactionId,
  });
}

/** "Vazgeç": the kumbara offer follows in the UI (§9.9). */
export async function markForgone(itemId: UUID): Promise<void> {
  await db.wishlist.update(itemId, {
    status: 'vazgecildi',
    decidedAt: new Date().toISOString(),
  });
}

/** Back-link after the vazgeç→kumbara transfer. */
export async function linkSavingsEntry(
  itemId: UUID,
  savingsEntryId: UUID,
): Promise<void> {
  await db.wishlist.update(itemId, { savingsEntryId });
}

export interface CooldownCounters {
  /** Σ estimates of all vazgeçildi items, all time — the virtual counter. */
  forgoneTotalMinor: Minor;
  /** Σ SavingsEntry amounts with source 'vazgecme' — the real one. */
  inKumbaraMinor: Minor;
}

export async function getCooldownCounters(): Promise<CooldownCounters> {
  const [items, entries] = await Promise.all([
    db.wishlist.toArray(),
    db.savingsEntries.toArray(),
  ]);
  return {
    forgoneTotalMinor: items
      .filter((i) => i.status === 'vazgecildi')
      .reduce((s, i) => s + (i.estimatedAmountMinor ?? 0), 0),
    inKumbaraMinor: entries
      .filter((e) => e.source === 'vazgecme')
      .reduce((s, e) => s + e.amountMinor, 0),
  };
}

// "Harcamadığın paranın kıymeti" (v1.4): money resisted via cooldown vazgeç
// is a win in itself — surfaced on the dashboard and tracked over time.

export interface ForgoneStats {
  thisMonthMinor: Minor;
  thisMonthCount: number;
  allTimeMinor: Minor;
  allTimeCount: number;
  inKumbaraMinor: Minor;
}

/** Forgone (vazgeçildi) totals for the fiscal month + all time. */
export async function getForgoneStats(
  monthKey: MonthKey,
  startDay: number,
): Promise<ForgoneStats> {
  const [items, entries] = await Promise.all([
    db.wishlist.toArray(),
    db.savingsEntries.toArray(),
  ]);
  const forgone = items.filter(
    (i) => i.status === 'vazgecildi' && i.estimatedAmountMinor,
  );
  const { start, end } = getMonthRange(monthKey, startDay);
  // Bucket by the fiscal month the decision was made in (decidedAt's date).
  const thisMonth = forgone.filter((i) => {
    const d = (i.decidedAt ?? '').slice(0, 10);
    return d >= start && d <= end;
  });
  return {
    thisMonthMinor: thisMonth.reduce((s, i) => s + (i.estimatedAmountMinor ?? 0), 0),
    thisMonthCount: thisMonth.length,
    allTimeMinor: forgone.reduce((s, i) => s + (i.estimatedAmountMinor ?? 0), 0),
    allTimeCount: forgone.length,
    inKumbaraMinor: entries
      .filter((e) => e.source === 'vazgecme')
      .reduce((s, e) => s + e.amountMinor, 0),
  };
}

/** Forgone amount per fiscal month, oldest first (İçgörü trend). */
export async function getForgoneTrend(
  currentKey: MonthKey,
  startDay: number,
  months: number,
): Promise<{ monthKey: MonthKey; minor: Minor }[]> {
  const items = await db.wishlist.toArray();
  const forgone = items.filter(
    (i) => i.status === 'vazgecildi' && i.estimatedAmountMinor && i.decidedAt,
  );
  const buckets = new Map<MonthKey, Minor>();
  for (const i of forgone) {
    const key = getMonthKey(i.decidedAt!.slice(0, 10), startDay);
    buckets.set(key, (buckets.get(key) ?? 0) + (i.estimatedAmountMinor ?? 0));
  }
  const result: { monthKey: MonthKey; minor: Minor }[] = [];
  for (let back = months - 1; back >= 0; back--) {
    const monthKey = shiftMonthKey(currentKey, -back);
    result.push({ monthKey, minor: buckets.get(monthKey) ?? 0 });
  }
  return result;
}
