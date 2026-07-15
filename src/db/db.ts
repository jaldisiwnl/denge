import Dexie, { type Table } from 'dexie';
import type {
  Budget,
  BudgetOverride,
  Category,
  MonthlyClose,
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
