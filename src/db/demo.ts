import { db } from './db';
import { stripUndefined } from './util';
import type { Mood, Necessity, Regret, Transaction } from './types';
import type { ISODate, Minor } from '../lib/types';
import { addDaysISO, isoWeekdayOf, todayISO } from '../lib/dates';
import { getMonthKey, shiftMonthKey } from '../lib/fiscal';
import { getSettings } from './repo/settings';
import { buildCloseContext } from './repo/close';

// Demo seed (§18): ~4 months of realistic Turkish data so every screen and
// mechanic is demonstrable instantly. Every generated id carries the `demo-`
// prefix; "Demoyu temizle" deletes exactly those records and nothing else.

const P = 'demo-';

/** Deterministic PRNG so the demo is stable across loads. */
function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export async function hasDemoData(): Promise<boolean> {
  return (
    (await db.transactions.where(':id').startsWith(P).count()) > 0 ||
    (await db.savingsGoals.where(':id').startsWith(P).count()) > 0
  );
}

/** Removes only demo-originated records (§18). */
export async function clearDemoData(): Promise<void> {
  const tables = [
    db.transactions,
    db.budgets,
    db.recurringRules,
    db.wishlist,
    db.savingsGoals,
    db.savingsEntries,
    db.quickTemplates,
    db.monthlyCloses,
    db.obligations,
  ];
  await db.transaction('rw', tables, async () => {
    // Demo rules keep auto-posting while loaded; those rows get real uuids
    // but descend from demo- rules — they must go too (fake money), while
    // deliberate user entries (e.g. a demo template tap) stay untouched.
    await db.transactions
      .filter(
        (t) => t.id.startsWith(P) || Boolean(t.recurringRuleId?.startsWith(P)),
      )
      .delete();
    for (const table of tables) {
      if (table === db.transactions) continue;
      await table.where(':id').startsWith(P).delete();
    }
  });
}

export async function loadDemoData(): Promise<void> {
  await clearDemoData(); // idempotent reload

  const settings = await getSettings();
  const startDay = settings?.monthStartDay ?? 1;
  const categories = await db.categories.toArray();
  // Robust against renamed defaults: fall back to the KIND, never to an
  // arbitrary category (income must not land in an expense bucket).
  const cat = (names: string[], kind: 'expense' | 'income') =>
    names.map((n) => categories.find((c) => c.name === n)?.id).find(Boolean) ??
    categories.find((c) => c.kind === kind)!.id;
  const ids = {
    market: cat(['Market'], 'expense'),
    yemek: cat(['Yemek & Kafe'], 'expense'),
    ulasim: cat(['Ulaşım'], 'expense'),
    ev: cat(['Ev & Faturalar'], 'expense'),
    abonelik: cat(['Abonelikler'], 'expense'),
    eglence: cat(['Eğlence'], 'expense'),
    giyim: cat(['Giyim'], 'expense'),
    maas: cat(['Harçlık', 'Maaş'], 'income'),
  };

  const rnd = mulberry32(4211);
  const today = todayISO();
  const txns: Transaction[] = [];
  let seq = 0;

  const add = (input: {
    date: ISODate;
    type?: 'expense' | 'income';
    amountMinor: Minor;
    categoryId: string;
    necessity?: Necessity;
    mood?: Mood;
    merchant?: string;
    note?: string;
    regret?: Regret;
    reviewedAt?: string;
    necessityOriginal?: Necessity;
    necessityRevisedAt?: string;
    recurringRuleId?: string;
    isBackfilled?: boolean;
    templateId?: string;
  }): Transaction => {
    const type = input.type ?? 'expense';
    const txn: Transaction = stripUndefined({
      id: `${P}tx-${seq++}`,
      createdAt: `${input.date}T12:00:00+03:00`,
      ...input,
      type,
      amountMinor: Math.round(input.amountMinor),
      necessityOriginal:
        type === 'expense'
          ? (input.necessityOriginal ?? input.necessity)
          : undefined,
    });
    txns.push(txn);
    return txn;
  };

  // ---- 4 months of daily patterns, with a 4-day lapse gap ~110 days back
  const gapStart = addDaysISO(today, -110);
  const gapEnd = addDaysISO(today, -107);
  const moods: Mood[] = ['stresli', 'sikilmis', 'sosyal'];

  for (let back = 120; back >= 1; back--) {
    const date = addDaysISO(today, -back);
    const inGap = date >= gapStart && date <= gapEnd;
    // one partially backfilled day inside the gap (§18) — heatmap opacity
    if (inGap) {
      if (date === addDaysISO(gapStart, 1)) {
        add({ date, amountMinor: 2500, categoryId: ids.ulasim, necessity: 'gerekli', isBackfilled: true });
      }
      continue;
    }

    const wd = isoWeekdayOf(date);
    const dayOfMonth = Number(date.slice(8, 10));

    // weekly allowance, deliberately irregular: some Mondays it just
    // doesn't arrive (the owner's real income pattern)
    if (wd === 1 && rnd() > 0.2) {
      add({ date, type: 'income', amountMinor: 250000, categoryId: ids.maas, merchant: 'Harçlık', recurringRuleId: `${P}rule-harclik` });
    }
    if (dayOfMonth === 1) {
      add({ date, amountMinor: 40000 + rnd() * 20000, categoryId: ids.ev, necessity: 'gerekli', merchant: 'Faturalar', recurringRuleId: `${P}rule-ev` });
    }
    if (dayOfMonth === 5) {
      add({ date, amountMinor: 6000, categoryId: ids.abonelik, necessity: 'istek', merchant: 'Spotify', recurringRuleId: `${P}rule-spotify` });
    }
    if (dayOfMonth === 10) {
      add({ date, amountMinor: 15000, categoryId: ids.abonelik, necessity: 'istek', merchant: 'Netflix', recurringRuleId: `${P}rule-netflix` });
    }
    if (dayOfMonth === 3) {
      add({ date, amountMinor: 40000, categoryId: ids.abonelik, necessity: 'gerekli', merchant: 'Spor salonu', recurringRuleId: `${P}rule-spor` });
    }

    if (wd === 2 || wd === 6) {
      add({ date, amountMinor: 15000 + rnd() * 20000, categoryId: ids.market, necessity: 'gerekli', merchant: 'Market' });
    }
    if (wd === 1 || wd === 3 || wd === 5) {
      add({
        date,
        amountMinor: 8000 + rnd() * 12000,
        categoryId: ids.yemek,
        necessity: rnd() < 0.35 ? 'istek' : 'gerekli',
        merchant: rnd() < 0.5 ? 'Kahveci' : 'Lokanta',
      });
    }
    if (wd <= 5) {
      add({ date, amountMinor: 2500, categoryId: ids.ulasim, necessity: 'gerekli', note: 'Dolmuş' });
    }
    // boş purchases weighted to evenings/weekends with moods (§18)
    if ((wd === 5 || wd === 6 || wd === 7) && rnd() < 0.55) {
      add({
        date,
        amountMinor: 10000 + rnd() * 35000,
        categoryId: ids.eglence,
        necessity: rnd() < 0.45 ? 'bos' : 'istek',
        mood: moods[Math.floor(rnd() * moods.length)],
      });
    }
    if (rnd() < 0.05) {
      add({ date, amountMinor: 40000 + rnd() * 80000, categoryId: ids.giyim, necessity: 'istek', merchant: 'Mağaza' });
    }
  }

  // ---- reviewed regrets, incl. 2 honest istek→bos reclassifications (§18)
  const reviewable = txns.filter(
    (t) =>
      t.type === 'expense' &&
      (t.necessity === 'istek' || t.necessity === 'bos') &&
      t.date < addDaysISO(today, -14) &&
      t.date > addDaysISO(today, -60),
  );
  const regrets: Regret[] = ['degdi', 'eh', 'pisman', 'pisman', 'degdi', 'eh'];
  reviewable.slice(0, 6).forEach((t, i) => {
    t.regret = regrets[i]!;
    t.reviewedAt = `${addDaysISO(t.date, 3)}T20:00:00+03:00`;
  });
  reviewable
    .filter((t) => t.necessity === 'istek')
    .slice(0, 2)
    .forEach((t) => {
      t.necessityOriginal = 'istek';
      t.necessity = 'bos';
      t.necessityRevisedAt = `${addDaysISO(t.date, 3)}T20:00:00+03:00`;
    });

  await db.transactions.bulkAdd(txns);

  // ---- recurring rules (subscriptions + fixed), already posted above.
  // Harçlık is weekly and NON-auto: each week a confirmation card asks —
  // "geldi mi?" Onayla / Bu ay atla (the irregular-allowance flow).
  await db.recurringRules.bulkAdd([
    { id: `${P}rule-harclik`, name: 'Harçlık', amountMinor: 250000, categoryId: ids.maas, type: 'income', cadence: 'weekly', weekday: 1, isSubscription: false, autoPost: false, isActive: true, lastPostedDate: today },
    { id: `${P}rule-ev`, name: 'Faturalar', amountMinor: 50000, categoryId: ids.ev, type: 'expense', cadence: 'monthly', dayOfMonth: 1, isSubscription: false, autoPost: true, isActive: true, lastPostedDate: today, necessity: 'gerekli' },
    { id: `${P}rule-spotify`, name: 'Spotify', amountMinor: 6000, categoryId: ids.abonelik, type: 'expense', cadence: 'monthly', dayOfMonth: 5, isSubscription: true, autoPost: true, isActive: true, lastPostedDate: today, necessity: 'istek' },
    { id: `${P}rule-netflix`, name: 'Netflix', amountMinor: 15000, categoryId: ids.abonelik, type: 'expense', cadence: 'monthly', dayOfMonth: 10, isSubscription: true, autoPost: true, isActive: true, lastPostedDate: today, necessity: 'istek' },
    { id: `${P}rule-spor`, name: 'Spor salonu', amountMinor: 40000, categoryId: ids.abonelik, type: 'expense', cadence: 'monthly', dayOfMonth: 3, isSubscription: true, autoPost: true, isActive: true, lastPostedDate: today, necessity: 'gerekli' },
  ]);

  // ---- envelopes (only where the owner has none — never touch real data)
  for (const [categoryId, amountMinor] of [
    [ids.market, 250000],
    [ids.yemek, 200000],
    [ids.eglence, 100000],
  ] as const) {
    const existing = await db.budgets.where('categoryId').equals(categoryId).first();
    if (!existing) {
      await db.budgets.add({ id: `${P}budget-${categoryId}`, categoryId, amountMinor, rollover: false });
    }
  }

  // ---- ödemeler (v1.3): a credit card, a person debt, a planned payment
  const nextMonth = shiftMonthKey(getMonthKey(today, startDay), 1);
  await db.obligations.bulkAdd([
    {
      id: `${P}ob-kart`,
      kind: 'kart',
      title: 'Kredi kartı',
      amountMinor: 120000,
      categoryId: ids.ev,
      dayOfMonth: 10,
      autoPost: false,
      isActive: true,
      createdAt: `${addDaysISO(today, -60)}T10:00:00+03:00`,
      lastPostedDate: addDaysISO(today, -1),
    },
    {
      id: `${P}ob-borc`,
      kind: 'borc',
      title: 'Arkadaşa borç',
      amountMinor: 50000,
      dayOfMonth: 20,
      remainingMinor: 200000,
      autoPost: false,
      isActive: true,
      createdAt: `${addDaysISO(today, -40)}T10:00:00+03:00`,
      lastPostedDate: addDaysISO(today, -1),
    },
    {
      id: `${P}ob-planli`,
      kind: 'planli',
      title: 'Anne doğum günü hediyesi',
      amountMinor: 75000,
      dueDate: `${nextMonth}-05`,
      autoPost: false,
      isActive: true,
      createdAt: `${addDaysISO(today, -10)}T10:00:00+03:00`,
    },
  ]);

  // ---- kısayollar (§18)
  await db.quickTemplates.bulkAdd([
    { id: `${P}tpl-kahve`, name: 'Sabah kahvesi', emoji: '☕', amountMinor: 8500, categoryId: ids.yemek, necessity: 'istek', sortOrder: 0, usageCount: 9 },
    { id: `${P}tpl-dolmus`, name: 'Dolmuş', emoji: '🚌', amountMinor: 2500, categoryId: ids.ulasim, necessity: 'gerekli', sortOrder: 0, usageCount: 14 },
    { id: `${P}tpl-ogle`, name: 'Öğle yemeği', emoji: '🍽', amountMinor: 15000, categoryId: ids.yemek, necessity: 'gerekli', sortOrder: 0, usageCount: 6 },
  ]);

  // ---- kumbara: 🎸 Yeni gitar ~40% funded across all three sources (§18)
  await db.savingsGoals.add({
    id: `${P}goal-gitar`,
    name: 'Yeni gitar',
    emoji: '🎸',
    targetAmountMinor: 1500000,
    createdAt: `${addDaysISO(today, -80)}T10:00:00+03:00`,
    isArchived: false,
  });
  await db.savingsEntries.bulkAdd([
    { id: `${P}sav-1`, goalId: `${P}goal-gitar`, amountMinor: 250000, date: addDaysISO(today, -70), createdAt: `${addDaysISO(today, -70)}T10:00:00+03:00`, source: 'manuel' },
    { id: `${P}sav-2`, goalId: `${P}goal-gitar`, amountMinor: 230000, date: addDaysISO(today, -45), createdAt: `${addDaysISO(today, -45)}T10:00:00+03:00`, source: 'ayKapanisi' },
    { id: `${P}sav-3`, goalId: `${P}goal-gitar`, amountMinor: 120000, date: addDaysISO(today, -30), createdAt: `${addDaysISO(today, -30)}T10:00:00+03:00`, source: 'vazgecme', wishlistItemId: `${P}wish-klavye`, note: 'Mekanik klavye' },
  ]);

  // ---- soğuma listesi: one item of each status (§18)
  const boughtTxn = add({
    date: addDaysISO(today, -20),
    amountMinor: 180000,
    categoryId: ids.giyim,
    necessity: 'istek',
    merchant: 'Koşu ayakkabısı',
  });
  await db.transactions.add(boughtTxn);
  await db.wishlist.bulkAdd([
    { id: `${P}wish-kulaklik`, title: 'Kablosuz kulaklık', estimatedAmountMinor: 250000, addedAt: new Date(Date.now() - 80 * 3600_000).toISOString(), cooldownHours: 72, status: 'bekliyor' },
    { id: `${P}wish-ayakkabi`, title: 'Koşu ayakkabısı', estimatedAmountMinor: 180000, addedAt: `${addDaysISO(today, -24)}T09:00:00+03:00`, cooldownHours: 72, status: 'alindi', decidedAt: `${addDaysISO(today, -20)}T18:00:00+03:00`, linkedTransactionId: boughtTxn.id },
    { id: `${P}wish-klavye`, title: 'Mekanik klavye', estimatedAmountMinor: 120000, addedAt: `${addDaysISO(today, -34)}T09:00:00+03:00`, cooldownHours: 72, status: 'vazgecildi', decidedAt: `${addDaysISO(today, -30)}T18:00:00+03:00`, savingsEntryId: `${P}sav-3` },
  ]);

  // ---- two coherent closes: grades computed from the actual demo data,
  // so the newer one carries a real improvement bonus when earned (§18)
  const currentKey = getMonthKey(today, startDay);
  for (const [i, monthKey] of [
    shiftMonthKey(currentKey, -2),
    shiftMonthKey(currentKey, -1),
  ].entries()) {
    const context = await buildCloseContext(monthKey);
    if (!context) continue;
    await db.monthlyCloses.add({
      id: `${P}close-${i}`,
      monthKey,
      closedAt: `${addDaysISO(today, i === 0 ? -35 : -5)}T21:00:00+03:00`,
      grade: context.grade.grade,
      score: context.grade.score,
      stats: context.snapshot,
      note: i === 0 ? 'Zor ay, çok dışarıda yedik.' : 'Kumbara işe yarıyor.',
    });
  }
}
