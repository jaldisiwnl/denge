import { db } from '../db';
import { stripUndefined } from '../util';
import type { WishlistItem } from '../types';
import type { Minor, UUID } from '../../lib/types';

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
