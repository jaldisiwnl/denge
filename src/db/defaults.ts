import type { Category, Settings, SavingsGoal } from './types';

// 8-step muted category palette derived from ballpoint/green/ink hues
// (§11.1 — "define once; no rainbow"). Stored as hex on the Category so
// chart colors stay stable even if the palette evolves later.
export const CATEGORY_COLORS = [
  '#2447C5', // ballpoint
  '#6E86E0', // soft ballpoint
  '#1F7A4D', // green
  '#63A98C', // soft green
  '#3E6FA8', // slate blue
  '#4E8E9C', // muted teal
  '#5C6884', // ink-soft
  '#1C2B4B', // ink
] as const;

const EXPENSE_DEFAULTS: [emoji: string, name: string][] = [
  ['🛒', 'Market'],
  ['🍽', 'Yemek & Kafe'],
  ['🚌', 'Ulaşım'],
  ['🏠', 'Ev & Faturalar'],
  ['📱', 'Abonelikler'],
  ['🎮', 'Eğlence'],
  ['👕', 'Giyim'],
  ['💊', 'Sağlık'],
  ['🎓', 'Eğitim'],
  ['🎁', 'Hediye'],
  ['✈️', 'Seyahat'],
  ['📦', 'Diğer'],
];

const INCOME_DEFAULTS: [emoji: string, name: string][] = [
  ['💼', 'Maaş'],
  ['💸', 'Ek Gelir'],
  ['🎉', 'Diğer Gelir'],
];

export function defaultCategories(): Category[] {
  const make = (
    [emoji, name]: [string, string],
    kind: Category['kind'],
    sortOrder: number,
  ): Category => ({
    id: crypto.randomUUID(),
    name,
    emoji,
    kind,
    color: CATEGORY_COLORS[sortOrder % CATEGORY_COLORS.length]!,
    sortOrder,
    isArchived: false,
  });
  return [
    ...EXPENSE_DEFAULTS.map((c, i) => make(c, 'expense', i)),
    ...INCOME_DEFAULTS.map((c, i) => make(c, 'income', i)),
  ];
}

/** Targetless "Genel Kumbara" seeded at first run (§9.13, §10). */
export function defaultSavingsGoal(): SavingsGoal {
  return {
    id: crypto.randomUUID(),
    name: 'Genel Kumbara',
    emoji: '🏦',
    createdAt: new Date().toISOString(),
    isArchived: false,
  };
}

export function defaultSettings(): Settings {
  return {
    id: 'singleton',
    theme: 'system',
    monthStartDay: 1,
    weeklyWorkHours: 45,
    showTimeCost: false,
    onboardingDone: false,
    reviewDay: 7, // Sunday
    savingsTargetRate: 0.2,
  };
}
