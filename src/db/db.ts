import Dexie, { type Table } from 'dexie';
import type {
  Budget,
  BudgetOverride,
  Category,
  MonthlyClose,
  Obligation,
  QuickTemplate,
  RecurringRule,
  SavingsEntry,
  SavingsGoal,
  Settings,
  Transaction,
  WishlistItem,
} from './types';
import { defaultCategories, defaultSavingsGoal, defaultSettings } from './defaults';

// Single source of truth (§6). Components never touch these tables directly;
// all writes go through src/db/repo/* and reads through useLiveQuery.

/** Lightweight presence-flags (clean days, dismissed gaps) — §8.8 allows it. */
export interface UiFlag {
  key: string;
}

class DengeDb extends Dexie {
  transactions!: Table<Transaction, string>;
  categories!: Table<Category, string>;
  budgets!: Table<Budget, string>;
  budgetOverrides!: Table<BudgetOverride, string>;
  recurringRules!: Table<RecurringRule, string>;
  wishlist!: Table<WishlistItem, string>;
  savingsGoals!: Table<SavingsGoal, string>;
  savingsEntries!: Table<SavingsEntry, string>;
  quickTemplates!: Table<QuickTemplate, string>;
  monthlyCloses!: Table<MonthlyClose, string>;
  settings!: Table<Settings, string>;
  uiFlags!: Table<UiFlag, string>;
  obligations!: Table<Obligation, string>;

  constructor() {
    super('denge');
    // Indexes per §7; first entry is the primary key (unindexed fields
    // still persist — Dexie stores whole objects).
    this.version(1).stores({
      transactions: 'id, date, categoryId, [type+date], necessity',
      categories: 'id, sortOrder',
      budgets: 'id, categoryId',
      budgetOverrides: 'id, categoryId, [categoryId+monthKey]',
      recurringRules: 'id, isActive',
      wishlist: 'id, status',
      savingsGoals: 'id',
      savingsEntries: 'id, goalId, date',
      quickTemplates: 'id, sortOrder',
      monthlyCloses: 'id, monthKey',
      settings: 'id',
    });

    // v2: drops the recurringRules.isActive index — IndexedDB cannot use
    // booleans as keys, so that index could never serve a query. Rules are
    // few; filter isActive in JS instead. (P0/P1 review fix.)
    this.version(2).stores({
      recurringRules: 'id',
    });

    // v3: uiFlags — presence-only flags for lapse recovery (§8.8): clean-day
    // marks and dismissed-gap keys. Not part of the §7 data model on purpose.
    this.version(3).stores({
      uiFlags: 'key',
    });

    // v4 (v1.3): obligations — credit cards, debts, one-off planned payments.
    // The Ödemeler screen merges these with recurringRules into one calendar.
    this.version(4).stores({
      obligations: 'id, kind, dueDate',
    });

    // Runs exactly once, inside the DB-creation transaction — the seed can
    // never duplicate (default categories §9.4, Genel Kumbara §9.13).
    this.on('populate', () => {
      void this.categories.bulkAdd(defaultCategories());
      void this.savingsGoals.add(defaultSavingsGoal());
      void this.settings.add(defaultSettings());
    });
  }
}

export const db = new DengeDb();
