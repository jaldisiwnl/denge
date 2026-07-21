import { db } from '../db';
import type { Transaction } from '../types';
import { todayISO } from '../../lib/dates';

// Export / import (§14). Export = full dump of every store; import = upsert
// by id where the NEWER record wins for timestamped stores, incoming wins
// for the rest (documented simplest rule).

const STORES = [
  'transactions',
  'categories',
  'budgets',
  'budgetOverrides',
  'recurringRules',
  'wishlist',
  'savingsGoals',
  'savingsEntries',
  'quickTemplates',
  'monthlyCloses',
  'settings',
  'uiFlags',
  'obligations',
] as const;

type StoreName = (typeof STORES)[number];

/** "Newer wins" comparison field per store (§14); others: incoming wins. */
const TIMESTAMP_FIELD: Partial<Record<StoreName, string>> = {
  transactions: 'createdAt',
  wishlist: 'addedAt',
  savingsGoals: 'createdAt',
  savingsEntries: 'createdAt',
  monthlyCloses: 'closedAt',
};

/** Stores absent from older backups (schemaVersion 1); filled empty on import. */
const V1_MISSING: StoreName[] = [
  'savingsGoals',
  'savingsEntries',
  'quickTemplates',
  'uiFlags',
  'obligations',
];

interface BackupRecord {
  id?: string;
  key?: string; // uiFlags
  [field: string]: unknown;
}

export interface BackupFile {
  schemaVersion: number;
  exportedAt: string;
  data: Record<string, BackupRecord[]>;
}

export async function buildExport(): Promise<BackupFile> {
  const data: Record<string, BackupRecord[]> = {};
  for (const store of STORES) {
    data[store] = (await db.table(store).toArray()) as BackupRecord[];
  }
  return {
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    data,
  };
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadJsonBackup(): Promise<void> {
  const file = await buildExport();
  triggerDownload(
    new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' }),
    `denge-yedek-${todayISO()}.json`,
  );
}

function csvField(value: string): string {
  return /[;"\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Transactions CSV (§14): semicolons, comma decimals, UTF-8 BOM for Excel. */
export async function downloadCsvExport(): Promise<void> {
  const [txns, categories] = await Promise.all([
    db.transactions.toArray(),
    db.categories.toArray(),
  ]);
  const catName = new Map(categories.map((c) => [c.id, c.name]));
  const rows = txns
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((t: Transaction) =>
      [
        t.date,
        t.type,
        (t.amountMinor / 100).toFixed(2).replace('.', ','),
        csvField(catName.get(t.categoryId) ?? ''),
        t.necessity ?? '',
        csvField(t.merchant ?? ''),
        csvField(t.note ?? ''),
        t.mood ?? '',
        t.regret ?? '',
      ].join(';'),
    );
  const head = 'tarih;tur;tutar;kategori;etiket;mekan;not;ruhHali;degerlendirme';
  triggerDownload(
    // Explicit BOM escape — an invisible literal char is too easy to lose.
    new Blob(['\uFEFF' + [head, ...rows].join('\r\n')], {
      type: 'text/csv;charset=utf-8',
    }),
    `denge-islemler-${todayISO()}.csv`,
  );
}

export interface ImportPlan {
  /** Per store: records to write (winners only). */
  writes: Partial<Record<StoreName, BackupRecord[]>>;
  addedCount: number;
  updatedCount: number;
  migratedFromV1: boolean;
}

/** Parses + validates a backup file; migrates v1 in place (§14). */
export function parseBackup(text: string): BackupFile {
  const parsed = JSON.parse(text) as BackupFile;
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    (parsed.schemaVersion !== 1 && parsed.schemaVersion !== 2) ||
    typeof parsed.data !== 'object' ||
    parsed.data === null
  ) {
    throw new Error('invalid backup');
  }
  if (parsed.schemaVersion === 1) {
    for (const store of V1_MISSING) parsed.data[store] ??= [];
  }
  for (const store of STORES) parsed.data[store] ??= [];
  return parsed;
}

function recordKey(store: StoreName, r: BackupRecord): string | undefined {
  return store === 'uiFlags' ? r.key : r.id;
}

/** Computes the diff summary shown before committing (§14). */
export async function planImport(file: BackupFile): Promise<ImportPlan> {
  const writes: ImportPlan['writes'] = {};
  let addedCount = 0;
  let updatedCount = 0;

  for (const store of STORES) {
    const incoming = file.data[store] ?? [];
    if (incoming.length === 0) continue;
    const existing = new Map(
      ((await db.table(store).toArray()) as BackupRecord[]).map((r) => [
        recordKey(store, r),
        r,
      ]),
    );
    const winners: BackupRecord[] = [];
    const tsField = TIMESTAMP_FIELD[store];

    for (const record of incoming) {
      const key = recordKey(store, record);
      if (!key) continue;
      const current = existing.get(key);
      if (!current) {
        winners.push(record);
        addedCount++;
        continue;
      }
      // Rules merge the posting cursor: importing an older backup must not
      // rewind lastPostedDate, or the engine would re-post the gap and
      // duplicate every fixed transaction the local db already has.
      if (store === 'recurringRules') {
        const localCursor = String(current.lastPostedDate ?? '');
        const incomingCursor = String(record.lastPostedDate ?? '');
        if (localCursor > incomingCursor) {
          record.lastPostedDate = current.lastPostedDate;
        }
      }
      if (JSON.stringify(current) === JSON.stringify(record)) continue;
      if (tsField) {
        const currentTs = String(current[tsField] ?? '');
        const incomingTs = String(record[tsField] ?? '');
        if (currentTs > incomingTs) continue; // local is newer — keep it
      }
      winners.push(record);
      updatedCount++;
    }
    if (winners.length > 0) writes[store] = winners;
  }

  return {
    writes,
    addedCount,
    updatedCount,
    migratedFromV1: file.schemaVersion === 1,
  };
}

/** Commits the plan atomically. */
export async function applyImport(plan: ImportPlan): Promise<void> {
  const tables = STORES.map((s) => db.table(s));
  await db.transaction('rw', tables, async () => {
    for (const store of STORES) {
      const winners = plan.writes[store];
      if (winners?.length) await db.table(store).bulkPut(winners);
    }
  });
}
