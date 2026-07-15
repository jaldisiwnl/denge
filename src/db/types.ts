// Authoritative data model (spec §7). Do not extend without a spec change.

import type { ISODate, ISODateTime, Minor, MonthKey, UUID } from '../lib/types';

export type Necessity = 'gerekli' | 'istek' | 'bos';
export type Mood = 'normal' | 'stresli' | 'sikilmis' | 'sosyal' | 'ac' | 'kutlama';
export type Regret = 'degdi' | 'eh' | 'pisman';

export interface Transaction {
  id: UUID;
  type: 'expense' | 'income';
  amountMinor: Minor; // always positive; sign implied by type
  categoryId: UUID;
  date: ISODate;
  createdAt: ISODateTime;
  note?: string;
  merchant?: string;
  necessity?: Necessity; // REQUIRED for expenses in UI; undefined for income
  necessityOriginal?: Necessity; // set once, at first save — never changes (§9.11)
  necessityRevisedAt?: ISODateTime; // set when reclassified (§9.8 / detail edit)
  mood?: Mood; // optional, expenses only
  regret?: Regret; // set only via Pazar Muhasebesi (or transaction detail)
  reviewedAt?: ISODateTime; // when regret was answered
  recurringRuleId?: UUID; // set if auto-posted
  wishlistItemId?: UUID; // set if purchased from Soğuma Listesi
  templateId?: UUID; // set if created from a Kısayol
  isBackfilled?: boolean; // set if entered via lapse-recovery flow (§9.15)
}

export interface Category {
  id: UUID;
  name: string;
  emoji: string;
  kind: 'expense' | 'income';
  color: string; // one of the palette category colors (§11)
  sortOrder: number;
  isArchived: boolean; // archive instead of delete when transactions exist
}

export interface Budget {
  // default monthly envelope per category
  id: UUID;
  categoryId: UUID;
  amountMinor: Minor;
  rollover: boolean; // unused remainder carries to next fiscal month
}

export interface BudgetOverride {
  // one-off change for a specific month
  id: UUID;
  categoryId: UUID;
  monthKey: MonthKey;
  amountMinor: Minor;
}

export interface RecurringRule {
  id: UUID;
  name: string;
  amountMinor: Minor;
  categoryId: UUID;
  type: 'expense' | 'income';
  cadence: 'monthly' | 'weekly' | 'yearly';
  dayOfMonth?: number; // monthly/yearly (clamped, §17)
  month?: number; // yearly: 1–12
  weekday?: number; // weekly: 1 (Mon) – 7 (Sun)
  isSubscription: boolean; // shown in Abonelikler view
  autoPost: boolean; // if false: only a reminder row, user confirms
  isActive: boolean;
  lastPostedDate?: ISODate; // idempotency guard
  necessity?: Necessity; // default tag applied to posted transactions
}

export interface WishlistItem {
  id: UUID;
  title: string;
  estimatedAmountMinor?: Minor;
  url?: string;
  note?: string;
  addedAt: ISODateTime;
  cooldownHours: number; // default 72
  status: 'bekliyor' | 'alindi' | 'vazgecildi';
  decidedAt?: ISODateTime;
  linkedTransactionId?: UUID; // when status = 'alindi'
  savingsEntryId?: UUID; // when 'vazgecildi' amount moved to Kumbara (§9.9)
}

export interface SavingsGoal {
  // Kumbara (§9.13)
  id: UUID;
  name: string;
  emoji: string;
  targetAmountMinor?: Minor; // optional: goal-less "genel kumbara" allowed
  deadline?: ISODate; // optional
  createdAt: ISODateTime;
  isArchived: boolean; // archive when completed/abandoned; history preserved
}

export interface SavingsEntry {
  // a real transfer into/out of a goal
  id: UUID;
  goalId: UUID;
  amountMinor: Minor; // positive = deposit, negative = withdrawal
  date: ISODate;
  createdAt: ISODateTime;
  source: 'manuel' | 'vazgecme' | 'ayKapanisi';
  wishlistItemId?: UUID; // when source = 'vazgecme'
  note?: string;
}

export interface QuickTemplate {
  // Kısayollar (§9.14)
  id: UUID;
  name: string; // e.g. "Sabah kahvesi"
  emoji?: string;
  amountMinor: Minor;
  categoryId: UUID;
  necessity: Necessity;
  merchant?: string;
  note?: string;
  sortOrder: number;
  usageCount: number;
}

// Frozen stats snapshot embedded in MonthlyClose; fully defined with
// lib/stats.ts in P6. Kept open-shaped until then.
export type MonthStatsSnapshot = Record<string, unknown>;

export interface MonthlyClose {
  id: UUID;
  monthKey: MonthKey;
  closedAt: ISODateTime;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  score: number; // 0–100 (§8.6)
  stats: MonthStatsSnapshot; // computed snapshot, frozen
  note?: string; // one-line user reflection
  nextMonthWasteLimitMinor?: Minor; // optional self-set challenge
}

export interface Settings {
  id: 'singleton';
  theme: 'light' | 'dark' | 'system';
  monthStartDay: number; // 1–28; align to salary day
  monthlyNetIncomeMinor?: Minor; // for safe-to-spend fallback & time cost
  weeklyWorkHours?: number; // default 45
  hourlyWageMinor?: Minor; // derived if income+hours given; explicit wins
  showTimeCost: boolean; // default false until wage known
  onboardingDone: boolean;
  reviewDay: number; // default 7 (Sunday), for Pazar Muhasebesi
  savingsTargetRate?: number; // default 0.20; used in §8.6 & §9.12
}
