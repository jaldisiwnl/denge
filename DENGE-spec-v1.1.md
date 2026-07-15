# DENGE — Personal Budget & Conscious Spending App
## Technical Specification v1.1 — Antigravity / Claude Code Handoff Document

> **Document language:** English (for agent precision).
> **App UI language:** Turkish only. All user-facing strings must be in Turkish (see §12).
> **Owner:** Selim — EEE graduate, comfortable with TypeScript/embedded/DSP; prefers step-by-step development with explanations.
> **Currency/locale:** TRY, `tr-TR`, timezone `Europe/Istanbul` (fixed UTC+3, Turkey has no DST since 2016).

### Changelog v1.0 → v1.1
The owner's goal is not only *awareness* but *actual saving*. v1.1 closes that gap:
1. **Kumbara (savings module) promoted from v2 to v1** — goals, real transfers, cumulative savings chart (new §9.13, F16).
2. **Soğuma Listesi → Kumbara bridge**: "Vazgeç" can now move the saved amount into a real savings goal, not just a virtual counter (§9.9).
3. **In-the-moment prevention**: quick-add shows the selected category's remaining envelope live (§9.1).
4. **Kısayollar (one-tap transaction templates)** for frequent purchases (new §9.14, F17).
5. **Pazar Muhasebesi honesty upgrade**: reclassify necessity retrospectively + celebrate the best "değdi" purchase, not only regrets (§9.8). New honesty fields on `Transaction`.
6. **Lapse recovery ("Boşluk affı")**: gap detection, fast backfill mode, streak pausing instead of silent corruption (new §8.8, §9.15, F18).
7. **Grade redesigned**: savings rate now scored; improvement bonus vs previous month; no-shame copy rule for low grades (§8.6).
8. **Dürtü Endeksi rebalanced** to 50/50 and made reclassification-aware (§8.4).
9. **Inflation caveat** on all month-over-month comparisons (§9.11).
10. Dashboard gains Kumbara and lapse-recovery cards (§9.7); Ay Kapanışı gains a savings step (§9.12); phases, seed data, edge cases, copy updated accordingly.

---

## 0. How the agent must work with this document

These rules override default agent behavior. They exist because the owner wants to *understand* the codebase, not just receive it.

1. **Build strictly in phases** (§16). Never start a phase before the previous one is approved.
2. **End every phase with a debrief**, appended to `PHASE_NOTES.md`:
   - What was built (5 bullets max)
   - 2–3 key technical decisions and *why*
   - 3 manual verification steps the owner can perform in the browser
   - Then **STOP and wait** for explicit approval.
3. **No unrequested dependencies.** The dependency list in §5 is closed. If you believe something else is needed, ask first with a one-line justification.
4. **Explain non-obvious code** with short comments (the *why*, not the *what*).
5. **Small, labeled commits** per logical unit, e.g. `feat(p2): quick-add sheet`.
6. All UI strings live in `src/i18n/tr.ts` — never hardcode Turkish text in components.
7. If this spec is ambiguous, choose the simplest interpretation, note it in `PHASE_NOTES.md`, and move on. Do not gold-plate.

---

## 1. Product vision

**Denge** ("balance") is a local-first, privacy-absolute personal finance PWA with one opinionated thesis:

> The problem is rarely *not knowing* what you spend. The problem is spending without **awareness** — and never confronting which purchases were actually worth it. And awareness alone is not the destination: money not wasted must become money **saved**.

Every budget app counts money. Denge counts money **and meaning**, then converts the difference into savings. Its signature mechanics:

1. **Bilinç etiketi** — every expense is tagged at entry as *Gerekli* (necessary), *İstek* (want), or *Boş* (empty/pointless). One tap, mandatory, zero judgment at entry time.
2. **Pazar Muhasebesi** — a weekly Sunday ritual where last week's non-essential purchases resurface with one question: *"Buna değdi mi?"* (Was it worth it?). Tags can be corrected here — the app expects that in-the-moment honesty is imperfect. It also celebrates what *was* worth it: conscious spending means cutting what you don't love so you can spend guilt-free on what you do.
3. **Soğuma Listesi** — a cooldown wishlist. Want something? It waits 72 hours. If you still want it, buy it guilt-free. If not —
4. **Kumbara** — the bridge from virtual to real. Money you didn't waste can be moved, one tap, into a savings goal with a target and a growing cumulative chart. Saving is the point, not the afterthought.

Tagline: **"Paranla aranı düzelt."**

## 2. Target user & core problem

Single user (the owner). Symptoms: overspending, a meaningful share of purchases feel "boş" in retrospect, no current tracking habit, and a concrete desire to **start saving**. Constraints: must be effortless (expense entry **under 5 seconds**), must survive lapses of several days without the data feeling "broken", must work offline on phone (PWA installed), must never send data anywhere.

## 3. Product principles

- **P1 — Friction budget:** entry is near-frictionless; *reflection* carries the deliberate friction (weekly, not per-purchase).
- **P2 — Dost ama dürüst:** the voice is friendly but honest. Never shaming, never preachy. Humor allowed in empty states and achievements; never in warnings. Low grades and lapses get direction, not guilt.
- **P3 — Local-first, forever:** no accounts, no network calls, no analytics. IndexedDB + manual export.
- **P4 — Numbers are sacred:** money stored as integer kuruş, displayed with `tr-TR` formatting, always in tabular mono type.
- **P5 — One bold thing per screen** (see design system §11): restrained UI, one signature device.
- **P6 — Carrot before stick:** every reflective surface that names a regret must also name a win where one exists.

## 4. Scope

### v1 features
| # | Feature | Section |
|---|---------|---------|
| F1 | Quick expense/income entry (numpad-first sheet, live envelope status) | §9.1 |
| F2 | Bilinç etiketi (Gerekli / İstek / Boş) + optional mood tag | §9.2 |
| F3 | Transactions list: filters, search, edit, delete | §9.3 |
| F4 | Categories (Turkish defaults, editable, archivable) | §9.4 |
| F5 | Monthly envelope budgets + per-month overrides + rollover | §9.5 |
| F6 | Recurring rules & subscriptions (auto-post, annual cost view) | §9.6 |
| F7 | Dashboard: safe-to-spend, donut, trend, heatmap, streaks, kumbara | §9.7 |
| F8 | Pazar Muhasebesi (weekly review: regret + reclassify + celebrate) | §9.8 |
| F9 | Soğuma Listesi (cooldown wishlist + transfer-to-kumbara) | §9.9 |
| F10 | Zaman maliyeti (price → hours of work, optional) | §9.10 |
| F11 | İçgörüler (insights, correlations, honesty stats, savings chart) | §9.11 |
| F12 | Ay Kapanışı (guided monthly close + savings step + grade + archive) | §9.12 |
| F13 | Fiscal month aligned to salary day | §8.1 |
| F14 | Export/import (JSON + CSV), demo seed data | §14, §18 |
| F15 | PWA: installable, fully offline, dark/light theme | §13 |
| F16 | **Kumbara: savings goals, transfers, cumulative chart** | §9.13 |
| F17 | **Kısayollar: one-tap transaction templates** | §9.14 |
| F18 | **Geri dönüş: lapse detection, fast backfill, streak pause** | §9.15 |

### Non-goals (v1) — do not build
Bank/API integration, cloud sync, multi-user, multi-currency, authentication, notifications outside the app (in-app badges only), receipt OCR, AI features, iOS/Android native wrappers, real inflation-adjusted math (v1 ships a copy caveat only, §9.11).

## 5. Tech stack (closed list)

| Concern | Choice | Notes |
|---|---|---|
| Build | Vite + React 18 + TypeScript (strict) | |
| Styling | Tailwind CSS 3.4 | tokens via CSS variables, §11 |
| Storage | Dexie 4 + `dexie-react-hooks` (`useLiveQuery`) | IndexedDB |
| UI state | Zustand (UI-only state: open sheets, filters, theme) | persistent data lives in Dexie only |
| Routing | react-router-dom 6 | tab routes + detail routes |
| Charts | Recharts (donut, bars, lines); **custom SVG** for heatmap & red-pen marks | |
| Dates | date-fns + `date-fns/locale/tr` | no moment/dayjs |
| PWA | vite-plugin-pwa | offline precache |
| Tests | Vitest | pure logic in `src/lib` only |
| Fonts | Fraunces, IBM Plex Sans, IBM Plex Mono | self-host via `@fontsource/*`; PWA must not depend on Google Fonts CDN |

Suggested structure:

```
src/
  app/            # router, layout shell, tab bar, theme provider
  components/     # reusable UI (Button, Card, Sheet, Segmented, Chip, ProgressBar, RedPen)
  features/
    transactions/ budgets/ recurring/ dashboard/ review/ cooldown/ kumbara/
    insights/ close/ settings/ templates/ recovery/
  db/             # dexie schema, repositories, migrations
  lib/            # pure logic: money, fiscal, stats, streaks, grade, recurrence, lapse
  i18n/tr.ts
  styles/tokens.css
```

## 6. Architecture

- **Single source of truth = Dexie.** Components read via `useLiveQuery`; writes go through repository functions in `src/db/repo/*.ts` (never raw table access from components).
- **Pure logic in `src/lib`** with no React/Dexie imports → unit-testable: `money.ts`, `fiscal.ts`, `stats.ts`, `streaks.ts`, `grade.ts`, `recurrence.ts`, `lapse.ts`.
- **On app open** (and on window focus): run `postDueRecurring()` (§8.7), `detectLapse()` (§8.8), and `refreshBadges()` (review due? cooldowns expired? lapse card?).
- **IDs:** `crypto.randomUUID()`. **Timestamps:** ISO 8601 with offset. **Dates:** `YYYY-MM-DD` local strings.

## 7. Data model (TypeScript, authoritative)

```ts
type UUID = string;
type ISODate = string;      // "2026-07-08" (local, Europe/Istanbul)
type ISODateTime = string;  // "2026-07-08T14:03:00+03:00"
type MonthKey = string;     // fiscal month key "2026-07" (see §8.1)
type Minor = number;        // integer kuruş; 1 TRY = 100

type Necessity = 'gerekli' | 'istek' | 'bos';
type Mood = 'normal' | 'stresli' | 'sikilmis' | 'sosyal' | 'ac' | 'kutlama';
type Regret = 'degdi' | 'eh' | 'pisman';

interface Transaction {
  id: UUID;
  type: 'expense' | 'income';
  amountMinor: Minor;              // always positive; sign implied by type
  categoryId: UUID;
  date: ISODate;
  createdAt: ISODateTime;
  note?: string;
  merchant?: string;
  necessity?: Necessity;           // REQUIRED for expenses in UI; undefined for income
  necessityOriginal?: Necessity;   // set once, at first save — never changes (honesty stats §9.11)
  necessityRevisedAt?: ISODateTime;// set when reclassified in Pazar Muhasebesi or detail edit
  mood?: Mood;                     // optional, expenses only
  regret?: Regret;                 // set only via Pazar Muhasebesi (or transaction detail)
  reviewedAt?: ISODateTime;        // when regret was answered
  recurringRuleId?: UUID;          // set if auto-posted
  wishlistItemId?: UUID;           // set if purchased from Soğuma Listesi
  templateId?: UUID;               // set if created from a Kısayol
  isBackfilled?: boolean;          // set if entered via lapse-recovery flow (§9.15)
}

interface Category {
  id: UUID; name: string; emoji: string;
  kind: 'expense' | 'income';
  color: string;                   // one of the palette category colors (§11)
  sortOrder: number;
  isArchived: boolean;             // archive instead of delete when transactions exist
}

interface Budget {                 // default monthly envelope per category
  id: UUID; categoryId: UUID;
  amountMinor: Minor;
  rollover: boolean;               // unused remainder carries to next fiscal month
}

interface BudgetOverride {         // one-off change for a specific month
  id: UUID; categoryId: UUID; monthKey: MonthKey; amountMinor: Minor;
}

interface RecurringRule {
  id: UUID; name: string;
  amountMinor: Minor; categoryId: UUID;
  type: 'expense' | 'income';
  cadence: 'monthly' | 'weekly' | 'yearly';
  dayOfMonth?: number;             // monthly/yearly (clamped, §17)
  month?: number;                  // yearly: 1–12
  weekday?: number;                // weekly: 1 (Mon) – 7 (Sun)
  isSubscription: boolean;         // shown in Abonelikler view
  autoPost: boolean;               // if false: only a reminder row, user confirms
  isActive: boolean;
  lastPostedDate?: ISODate;        // idempotency guard
  necessity?: Necessity;           // default tag applied to posted transactions
}

interface WishlistItem {
  id: UUID; title: string;
  estimatedAmountMinor?: Minor; url?: string; note?: string;
  addedAt: ISODateTime;
  cooldownHours: number;           // default 72
  status: 'bekliyor' | 'alindi' | 'vazgecildi';
  decidedAt?: ISODateTime;
  linkedTransactionId?: UUID;      // when status = 'alindi'
  savingsEntryId?: UUID;           // when 'vazgecildi' amount was moved to Kumbara (§9.9)
}

interface SavingsGoal {            // Kumbara (§9.13)
  id: UUID; name: string; emoji: string;
  targetAmountMinor?: Minor;       // optional: goal-less "genel kumbara" allowed
  deadline?: ISODate;              // optional
  createdAt: ISODateTime;
  isArchived: boolean;             // archive when completed/abandoned; history preserved
}

interface SavingsEntry {           // a real transfer into/out of a goal
  id: UUID; goalId: UUID;
  amountMinor: Minor;              // positive = deposit, negative = withdrawal
  date: ISODate; createdAt: ISODateTime;
  source: 'manuel' | 'vazgecme' | 'ayKapanisi';
  wishlistItemId?: UUID;           // when source = 'vazgecme'
  note?: string;
}

interface QuickTemplate {          // Kısayollar (§9.14)
  id: UUID; name: string;          // e.g. "Sabah kahvesi"
  emoji?: string;
  amountMinor: Minor; categoryId: UUID;
  necessity: Necessity; merchant?: string; note?: string;
  sortOrder: number; usageCount: number;
}

interface MonthlyClose {
  id: UUID; monthKey: MonthKey; closedAt: ISODateTime;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  score: number;                   // 0–100 (§8.6)
  stats: MonthStatsSnapshot;       // computed snapshot, frozen (define in lib/stats.ts)
  note?: string;                   // one-line user reflection
  nextMonthWasteLimitMinor?: Minor;// optional self-set challenge
}

interface Settings {
  id: 'singleton';
  theme: 'light' | 'dark' | 'system';
  monthStartDay: number;           // 1–28; align to salary day
  monthlyNetIncomeMinor?: Minor;   // for safe-to-spend fallback & time cost
  weeklyWorkHours?: number;        // default 45
  hourlyWageMinor?: Minor;         // derived if income+hours given; explicit wins
  showTimeCost: boolean;           // default false until wage known
  onboardingDone: boolean;
  reviewDay: number;               // default 7 (Sunday), for Pazar Muhasebesi
  savingsTargetRate?: number;      // default 0.20; used in grade §8.6 & close §9.12
}
```

**Dexie stores:** `transactions, categories, budgets, budgetOverrides, recurringRules, wishlist, savingsGoals, savingsEntries, quickTemplates, monthlyCloses, settings`. Index `transactions` by `date`, `categoryId`, `[type+date]`, `necessity`; `savingsEntries` by `goalId`, `date`.

## 8. Business logic & algorithms (implement in `src/lib`, unit-test all)

### 8.1 Fiscal month (`fiscal.ts`)
`monthStartDay = d` means fiscal month `2026-07` spans **Jul d → Aug (d−1)**. If `d > days in month`, clamp to last day. Functions: `getMonthKey(date, startDay)`, `getMonthRange(monthKey, startDay)`, `getDaysRemaining(today, monthKey, startDay)`. UI always says "bu ay" but ranges are fiscal. Setting capped at 28 to avoid clamp chaos.

### 8.2 Money (`money.ts`)
All arithmetic in integer kuruş. Format: `new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' })` → `₺1.234,56`. Compact form for charts: `₺1,2 B` (bin) / `₺1,2 Mn`. Parse Turkish decimal input (comma).

### 8.3 Safe-to-spend (dashboard hero)
```
income        = income this fiscal month, or Settings.monthlyNetIncomeMinor if none logged yet
fixedRemaining= sum of active recurring expenses not yet posted this fiscal month
spentVariable = expenses this month excluding recurring-posted ones
savedSoFar    = net positive SavingsEntry deposits this fiscal month
budgetTotal   = min(income, sum of category envelopes) if envelopes exist, else income
available     = budgetTotal − fixedRemaining − spentVariable − savedSoFar
safePerDay    = max(0, available / daysRemaining)
```
Kumbara deposits reduce spendable money — saved money is *gone* from the spending pool by design. Show both `available` and `safePerDay` ("Güne düşen"). If negative → red-pen treatment (§11.5).

### 8.4 Waste, regret & savings metrics (`stats.ts`)
- **Boş oranı** = Σ(bos expenses) / Σ(all expenses), per month & per category. Uses the *current* necessity tag (i.e. after reclassification — retrospective honesty counts).
- **Pişmanlık oranı** = Σ(amount where regret='pisman') / Σ(reviewed istek+bos amount). Only reviewed transactions count in the denominator.
- **Dürtü Endeksi (0–100)** = round(100 × (0.5 × boş oranı + 0.5 × pişmanlık oranı)) for the fiscal month. Bands: 0–20 "Sakin", 21–45 "Dalgalı", 46+ "Fırtına". Rationale for 50/50: entry-time tags underestimate waste (people rarely admit "boş" at purchase time); retrospective regret is the corrective signal and deserves equal weight.
- **Dürüstlük istatistiği** = share of transactions where `necessityOriginal ≠ necessity` (reclassified), and specifically `istek→bos` conversions. Feeds insight card §9.11.
- **Net birikim oranı** = (net SavingsEntry deposits + max(0, income − expenses)) / income for the fiscal month, clamped to [0, 1]. Used in grade and close.

### 8.5 Streaks (`streaks.ts`)
**Temiz gün** = a calendar day with zero expenses tagged `bos`. Days with no expenses at all also count — **except** days inside a detected lapse window (§8.8), which are **paused**: they neither extend nor break the streak (the streak resumes at its pre-lapse value once the user is active again or backfills the gap). Future-dated transactions excluded. Track `bestStreak` (computed, not stored). Milestones at 3/7/14/30 days trigger a highlight toast.

### 8.6 Month grade (`grade.ts`)
```
budgetScore  (0–30): 30 × clamp01(1 − overspendRatio)            // overspend across envelopes
wasteScore   (0–25): 25 × clamp01(1 − boşOranı / 0.25)            // 0% waste → full; ≥25% → 0
savingsScore (0–20): 20 × clamp01(netBirikimOranı / savingsTargetRate)  // default target 20%
regretScore  (0–15): 15 × clamp01(1 − pişmanlıkOranı / 0.5)
streakScore  (0–10): 10 × clamp01(bestStreakInMonth / 10)
improvementBonus (0–10): +5 if boşOranı improved vs previous closed month,
                         +5 if netBirikimOranı improved; requires a previous close.
score = min(100, round(sum)); grade: ≥85 A, ≥70 B, ≥55 C, ≥40 D, else F
```
If a component has no data (no budget, no reviewed purchase, no income logged), redistribute its weight proportionally across the rest (document in code). **No-shame rule:** the grade reveal for D/F must lead with the single most actionable observation (e.g. `"Boş harcamanın %70'i hafta sonu akşamları — tek cephe, kazanılabilir."`) and never with the letter alone; copy tone per §11.7.

### 8.7 Recurrence posting (`recurrence.ts`)
`postDueRecurring(today)`: for each active rule, compute all due dates in `(lastPostedDate, today]`; for each, create a transaction (flagged `recurringRuleId`, tagged with the rule's default necessity or `gerekli`), then update `lastPostedDate`. Clamp `dayOfMonth` 29–31 to month end. Rules with `autoPost:false` instead surface a "Bekleyen sabitler" confirmation card on the dashboard. Must be idempotent (guard by `lastPostedDate`).

### 8.8 Lapse detection (`lapse.ts`)
`detectLapse(today)`: a lapse = **≥3 consecutive calendar days** with zero user-entered transactions (auto-posted recurring transactions don't count as activity), ending before today, where the user had prior activity (≥1 manual transaction ever). Returns `{ from, to, dayCount } | null` for the most recent unresolved gap. A gap is resolved when the user either backfills it (§9.15) or dismisses the recovery card (store dismissal in Zustand-persisted UI state keyed by gap range — a lightweight `uiFlags` Dexie row is acceptable; agent's choice, note it). Streak pausing per §8.5 applies to unresolved *and* dismissed gaps alike (only actual backfilled data un-pauses those days).

## 9. Feature specifications

### 9.1 Quick add (F1) — the 5-second promise
FAB (`+`) on every tab → full-screen bottom sheet:
1. **Kısayollar row** (if any templates exist): horizontally scrollable one-tap chips at the very top — `☕ Sabah kahvesi ₺85` — tapping one saves the transaction *immediately* with today's date and shows the toast. Long-press → opens the sheet prefilled for editing before save. (§9.14)
2. **Numpad first.** Big mono amount at top (`₺0,00` placeholder), custom numpad (no OS keyboard), comma key for kuruş.
3. **Category chips**, ordered by usage frequency (last 90 days), horizontally scrollable, emoji + name.
4. **Live envelope status** (the in-the-moment nudge): the instant a category with a budget is selected, a single line appears under the chips: `"Yemek zarfında ₺180 kaldı"` — and if the entered amount would exceed the remainder, it switches to red-pen tint: `"Bu harcamayla zarf ₺45 aşılır"`. Updates live as digits are typed. Hidden when no envelope exists. Informative, never blocking.
5. **Bilinç segmented control** — `Gerekli | İstek | Boş` (§9.2). Required for expenses; Save disabled until chosen.
6. Collapsed "Detay" row expands to: note, merchant, date (default today), mood chips.
7. Toggle `Gider | Gelir` at top (income hides necessity/mood).
8. **Kaydet** → toast: `"Yazıldı: ₺120,50 · Kahve"` + subtle time cost if enabled (§9.10).
Happy path = amount → category → necessity → save: **3 taps + digits**. Template path: **1 tap**.

### 9.2 Bilinç etiketi & mood (F2)
- Colors: Gerekli = green tint, İstek = ballpoint tint, Boş = red-pen tint (§11).
- Copy under the control, small: `"Yargı yok — sadece dürüstlük."`
- Mood chips (optional): `😐 Normal · 😖 Stresli · 🥱 Sıkılmış · 🥳 Sosyal · 🍔 Aç · 🎉 Kutlama`.
- Editable later from transaction detail or during Pazar Muhasebesi. On first save, copy `necessity → necessityOriginal`. Any later change sets `necessityRevisedAt` and clears `regret`/`reviewedAt` **unless** the change happens inside the review flow itself (§9.8), where regret is answered in the same step.

### 9.3 Transactions list (F3)
Route `/islemler`. Grouped by day (`Bugün`, `Dün`, else `8 Temmuz Salı`), day subtotal right-aligned mono. Row: emoji, name/merchant, necessity dot, amount (expenses ink, income green, `pisman` gets a small red-pen strike glyph §11.5). Sticky filter bar: month selector (fiscal), category, necessity, search (note+merchant). Tap → detail sheet: all fields editable, delete with confirm, `"Kısayol yap"` action (creates a QuickTemplate from this transaction, §9.14). Empty state: `"Defter bomboş. İlk harcamanı ekle — yargılamak yok, sadece yazıyoruz."`

### 9.4 Categories (F4)
Defaults seeded on first run (all editable):
Expenses: `🛒 Market · 🍽 Yemek & Kafe · 🚌 Ulaşım · 🏠 Ev & Faturalar · 📱 Abonelikler · 🎮 Eğlence · 👕 Giyim · 💊 Sağlık · 🎓 Eğitim · 🎁 Hediye · ✈️ Seyahat · 📦 Diğer`
Income: `💼 Maaş · 💸 Ek Gelir · 🎉 Diğer Gelir`
Manager in settings: add/edit/reorder/archive. **Delete only if zero transactions**, else offer archive or reassign-then-archive flow. Archiving a category also hides (does not delete) templates pointing at it.

### 9.5 Budgets (F5)
Route `/butce` → segment `Zarflar`. Per-category envelopes for the current fiscal month: progress bar with spent/total, remaining, days left. Over budget → red-pen circle around the total (§11.5). Header: total budget vs total spent + `Güne düşen`. Edit sheet per category: default amount, `Bu aya özel` override, rollover toggle (rollover adds last month's positive remainder to this month's effective envelope — show as `+₺X devir`). Suggestion chip when editing: median of last 3 months' spend. No budget yet → CTA: `"Zarfları hazırla"` with a one-tap "suggest from history" action.

### 9.6 Recurring & subscriptions (F6)
Route `/butce` → segment `Sabitler`. List of rules with next due date. Subscriptions subsection shows **monthly total** and the **Yıllık Şok** line: `"Aboneliklerin yılda ₺X ediyor."` Each subscription row shows annual cost in small mono. Add/edit rule sheet with cadence controls. Auto-post per §8.7; non-auto rules appear as dashboard confirmation cards (`Onayla | Bu ay atla`).

### 9.7 Dashboard (F7)
Route `/` (`Özet`). Order:
1. **Hero**: month name (fiscal), `Kalan` big mono number, `Güne düşen ₺X` below, thin pace bar (elapsed days vs spent ratio). Faint grid-paper texture behind hero only (§11.6). Negative → red-pen circle.
2. **Bekleyen kartlar** (conditional): lapse-recovery card (§9.15) — always first when present; Pazar Muhasebesi due badge → §9.8; expired cooldowns → §9.9; pending non-auto recurrings.
3. **Kumbara card**: total saved (all goals) big mono + this month's deposits (`Bu ay +₺X`) + a compact 6-month cumulative savings sparkline. Tap → `/butce` Kumbara segment. Hidden until the first SavingsEntry exists; before that, a slim CTA: `"Kumbarayı başlat"`.
4. **Streak card**: `🔥 X gündür boş harcama yok` + best streak; highlighter background at milestones; paused state shows `⏸ Seri duraklatıldı — boşluğu doldur, kaldığın yerden devam` when a lapse is unresolved.
5. **Kategori dağılımı**: donut (top 6 + Diğer), center = total spent; tap slice → filtered list.
6. **6 aylık eğilim**: grouped bars — total spend + `boş` portion overlaid in red tint. This makes the waste trend visible at a glance.
7. **Harcama takvimi**: custom SVG heatmap of current fiscal month, 5 intensity steps of ballpoint; days containing `bos` spending get a tiny red corner tick; backfilled-lapse days rendered at 60% opacity. Tap day → that day's list.

### 9.8 Pazar Muhasebesi (F8) — signature feature
Trigger: from `reviewDay` (default Sunday) onward, if unreviewed `istek`/`bos` expenses exist from the last completed Mon–Sun week → dashboard badge card: `"Pazar Muhasebesi hazır — 7 kalem seni bekliyor."`
Flow (full-screen, one card per transaction, swipe/buttons):
- Card: amount (big mono), category, note/merchant, date, mood if any, current necessity tag.
- **Step A — reclassify (optional):** a small inline control on the card: `"Etiket doğru mu?"` with the three necessity chips, current one selected. Changing it here sets `necessityRevisedAt` (and updates stats per §8.4) without leaving the flow. If reclassified to `gerekli`, the card is thanked and skipped (gerekli items aren't regret-reviewed): `"Tamam, gereğiydi. Sıradaki."`
- **Step B — the question:** **"Buna değdi mi?"** → `👍 Değdi` / `😐 Eh` / `👎 Pişman`. Sets `regret` + `reviewedAt`. Progress dots on top. Skippable (`Sonra`).
Summary screen (carrot before stick, P6):
1. **En çok değen:** the highest-amount `değdi` item celebrated first: `"₺450 · Konser bileti — işte buna para harcanır."` (omit if none)
2. Regret recap: `"Bu hafta: ₺X'lik alışverişin ₺Y'si pişmanlık."` + most-regretted category.
3. One dry-but-kind line: `"₺Y az değil — ama artık görüyorsun. Görünen iyileşir."`
4. If any `istek→bos` reclassifications happened: `"3 kalemi dürüstçe Boş'a çektin. Bu, işin en zor kısmıydı."`
`pisman` items get the red strike in lists thereafter. History accessible from İçgörüler.

### 9.9 Soğuma Listesi (F9) — signature feature
Route `/islemler` → segment `Soğuma`. Add item: title, estimated price, optional URL/note; cooldown 72h default (24/48/72/168 options). Item card shows a countdown ring. When expired → badge + card state: **"Hâlâ istiyor musun?"** →
- `Al` — opens quick-add prefilled, links transaction, status `alindi`.
- `Vazgeç` — status `vazgecildi`, then immediately a follow-up sheet: **"₺X'i kurtardın. Kumbaraya atalım mı?"** → `Kumbaraya aktar` (goal picker if multiple; creates `SavingsEntry` with `source:'vazgecme'`, links via `savingsEntryId`) / `Şimdilik kalsın`. This is the virtual→real bridge; make it one tap for the single-goal case.
Header counters, always visible: **`Vazgeçerek kurtardın: ₺X`** (sum of `vazgecildi` estimates, all time) and beneath it, smaller: `"₺Y'si gerçekten kumbarada."` Highlighter treatment on the first. Empty state: `"Bir şey mi istiyorsun? Buraya yaz, 72 saat sonra konuşalım."`

### 9.10 Zaman maliyeti (F10)
If `hourlyWageMinor` known (explicit, or derived = monthlyNetIncome / (weeklyWorkHours × 4.33)) and `showTimeCost` on: show `≈ 2 sa 15 dk çalışma` in quick-add (live under amount), transaction detail, and cooldown item cards. Format: `X dk` under 1h; `X sa Y dk` otherwise. Never on income or savings entries.

### 9.11 İçgörüler (F11)
Route `/icgoru`. Month selector at top. Cards (each hidden until enough data, with an explanatory empty state):
1. **Dürtü Endeksi** dial (§8.4) + 6-month sparkline.
2. **Birikim çizgisi** — 12-month **cumulative** net savings line (all goals combined), the "growing number" that fuels motivation. Annotate goal completions with a highlighter dot.
3. **Boş oranı trendi** — line, monthly.
4. **Dürüstlük kartı** — reclassification stats: `"Satın alırken İstek dediklerinin %30'u sonradan Boş çıktı."` (min 5 reclassifiable items before showing).
5. **Ruh hali etkisi** — for each mood with ≥5 tagged expenses: avg `boş+pişman` share vs overall, e.g. `"Stresliyken boş harcaman %38 daha yüksek."` Guard small samples (`n` shown small).
6. **Haftanın günleri** — bar of avg spend by weekday; the worst day annotated: `"Cuma senin zayıf günün."`
7. **Pişmanlık şampiyonları** — top 5 categories by regret rate (min 3 reviewed items).
8. **Sık mekânlar** — top merchants by total (if merchant data exists).
9. **Ay farkları** — biggest category deltas vs previous fiscal month. **Every month-over-month comparison card in the app carries a one-line footnote:** `"Not: Enflasyonu unutma — farkın bir kısmı fiyat artışı olabilir."` (Real inflation adjustment is v2, §19.)
Also from here: `Arşiv` (closed months with grade history strip) and Pazar Muhasebesi history.

### 9.12 Ay Kapanışı (F12)
From the last 2 days of a fiscal month (and until done), dashboard shows `"Ayı kapat"` card. Guided 6 steps (full-screen wizard):
1. Totals recap (income, spend, and the headline: `"Cebinde kalan: ₺X"`).
2. Bilinç recap: gerekli/istek/boş split + regret summary + honesty stat if any.
3. Budget performance table (envelope vs actual, red-pen on overs).
4. **Birikim adımı:** suggested transfer = `max(0, income − expenses − alreadySavedThisMonth)`, editable inline, one tap → `SavingsEntry` with `source:'ayKapanisi'`. Copy: `"₺X boşta duruyor. Kumbaraya taşıyalım mı? Taşınan para harcanmaz."` Skippable without guilt.
5. Next month setup: envelope suggestions (median 3 months, editable inline) + optional `boş` limit challenge for next month.
6. **Grade reveal** (§8.6): for A–C, large Fraunces letter with count-up score; for D/F, lead with the most actionable observation first, letter second (no-shame rule §8.6). Improvement bonus shown explicitly when earned: `"+10 gelişim — geçen aydan daha az boş, daha çok birikim."` One-line note input (`"Bu ayı bir cümleyle anlat"`). Save → `MonthlyClose` archived.

### 9.13 Kumbara (F16) — the savings module
Route `/butce` → segment `Kumbara`.
- **Goals list**: each goal card = emoji, name, saved/target mono amounts, progress bar (ballpoint; switches to green at 100% with a highlighter flash once), optional deadline countdown, projected finish date based on trailing 3-month average deposit rate (`"Bu hızla: Kasım 2026"`, hidden with <2 months of data).
- **Default goal** `🏦 Genel Kumbara` seeded at onboarding (targetless). Add/edit/archive goals; archiving preserves entries.
- **Goal detail**: entries list (deposits green, withdrawals ink with confirm dialog), source badges (`vazgeçme` entries show the wishlist item title — the story of the money), `Para ekle / Para çek` actions.
- **Semantics (document in code):** Denge tracks savings *decisions*; the actual money lives wherever the owner keeps it (bank, cash). A deposit is a commitment marker that reduces safe-to-spend (§8.3). Withdrawals cannot take a goal below zero.
- Completion: reaching target → celebration toast + highlighter treatment + insight annotation (§9.11), goal offered for archive.

### 9.14 Kısayollar (F17) — one-tap templates
Managed inline: created via `"Kısayol yap"` from any transaction detail (§9.3) or from settings → `Kısayollar` (add/edit/reorder/delete; max 10 to keep the row scannable). Rendered as the top row of quick-add (§9.1). Tapping saves instantly (today's date, all template fields); long-press opens prefilled sheet. `usageCount` increments per use and drives default ordering (manual `sortOrder` wins if user reordered). Deleting a template never touches past transactions.

### 9.15 Geri dönüş / Boşluk affı (F18) — lapse recovery
When `detectLapse()` (§8.8) returns a gap, the dashboard shows a warm, guilt-free card — always above other pending cards:
`"5 gündür yazmadın. Sorun değil — defter beklemeyi bilir."` Actions:
- **`Boşluğu doldur`** → backfill mode: a compact day-by-day stepper (one screen per gap day, date prominent), each day offering the Kısayollar row + a mini quick-add + `"Bu gün harcama yoktu"` + `"Hatırlamıyorum"` buttons. Transactions created here get `isBackfilled: true`. "Harcama yoktu" marks the day clean (streak un-pauses per §8.5); "Hatırlamıyorum" leaves it paused and moves on. Designed to clear a 5-day gap in under a minute.
- **`Boş ver, bugünden devam`** → dismisses the card (gap stays paused in streak math), quick-add opens for today. No lecture, no red anywhere on this card — lapses are met with a door, not a wall (P2).
Backfilled days render at reduced opacity on the heatmap (§9.7). Backfilled `istek/bos` items join the *next* Pazar Muhasebesi normally.

## 10. Information architecture

Bottom tab bar (5 slots): `Özet /` · `İşlemler /islemler` · `[+ FAB]` · `Bütçe /butce` · `İçgörü /icgoru`.
`/islemler` segments: `İşlemler | Soğuma`. `/butce` segments: `Zarflar | Sabitler | Kumbara`.
Settings gear in the Özet header → `/ayarlar`: theme, salary day, income & work hours, time-cost toggle, review day, savings target rate, categories manager, Kısayollar manager, export/import, demo data load/clear, about.
Onboarding (first run, 4 screens max): concept in 30 words, salary day picker, optional income, **Kumbara starter** — `"İlk hedefini koy (istersen sonra)"` with the default Genel Kumbara pre-created → done. Skippable throughout.

## 11. Design system — "Modern Bakkal Defteri"

**Concept.** The Turkish corner-shop debt ledger (bakkal defteri): squared paper, ballpoint navy ink, and the red pen that circles what went wrong. Reimagined as a calm, modern fintech surface — the *feeling* of an honest handwritten ledger with none of the kitsch. This grounds every visual choice below.

### 11.1 Color tokens (CSS variables in `styles/tokens.css`)
| Token | Light | Dark ("Gece Defteri") | Use |
|---|---|---|---|
| `--paper` | `#FAF9F4` | `#0F1524` | app background |
| `--card` | `#FFFFFF` | `#161D30` | cards, sheets |
| `--grid` | `#E7E4D9` | `#232B42` | borders, dividers, chart grid |
| `--ink` | `#1C2B4B` | `#E9E8DF` | primary text |
| `--ink-soft` | `#5C6884` | `#9AA3B8` | secondary text |
| `--ballpoint` | `#2447C5` | `#7C97FF` | primary actions, links, heatmap |
| `--redpen` | `#D2352B` | `#FF6B5E` | overspend, `boş`, regret, destructive |
| `--green` | `#1F7A4D` | `#4CC38A` | income, savings, `gerekli`, under budget |
| `--highlight` | `#F5C84B` | `#F5C84B` | streaks, achievements, savings milestones ONLY |

Category chart colors: 8-step muted set derived from ballpoint/green/ink hues (define once; no rainbow).

### 11.2 Typography
- **Display — Fraunces** (600–700, softened optical size): screen titles, month names, the grade letter, onboarding. Used with restraint.
- **UI/body — IBM Plex Sans** (400/500/600): everything else. Full Turkish glyph support.
- **Numeric — IBM Plex Mono** (500, tabular): **every currency amount, no exceptions**, countdowns, dates in tables.
- Scale: 13 / 15 (base) / 17 / 22 / 28 / 40. Hero amount: 40 mono. Line-height 1.5 body, 1.15 display.

### 11.3 Shape & depth
Radius: 12px cards, 16px sheets, 999px chips/FAB. Borders: 1px `--grid` on cards — **no shadows on cards** (flat paper). Shadows only on overlays (sheets, toasts): `0 8px 32px rgb(0 0 0 / 0.16)`. Spacing on a 4px grid; screen padding 16px; card padding 16px.

### 11.4 Components
Buttons (primary = ballpoint fill / secondary = 1px ink border / destructive = redpen), segmented control (bilinç: selected state fills with the tag's tint at 15% + colored text), category chips (emoji + label, 999px, `--grid` border), template chips (same shape + mono amount suffix), progress bars (8px, track `--grid`, fill ballpoint → redpen when >100%; kumbara bars → green at 100%), FAB (56px ballpoint circle, white `+`, above tab bar), bottom sheet (drag handle, 16px top radius), toast (bottom, above tab bar, mono amounts).

### 11.5 Signature device — **Kırmızı Kalem**
One reusable `<RedPen>` SVG component with two variants, drawn with a slightly irregular hand-drawn path (2.5px stroke, `--redpen`, subtle rotation):
- `circle` — an imperfect ellipse around over-budget totals and negative safe-to-spend.
- `strike` — a rough strikethrough on `pisman` amounts in lists and review summaries.
Animate with `stroke-dashoffset` draw-in, 400ms ease-out, **once per mount**; static when `prefers-reduced-motion`. This is the app's one bold gesture — everything else stays quiet. Do not use red-pen marks anywhere not specified. Explicitly forbidden on: the lapse-recovery card (§9.15), Kumbara surfaces, and empty states.

### 11.6 Texture & motion
Faint squared-paper texture (CSS `repeating-linear-gradient`, both axes, `--grid` at ~35% alpha, 24px cells) **behind the dashboard hero only**. Motion: sheets slide up 240ms cubic-bezier(0.2, 0.8, 0.2, 1); hero number counts up once per load (600ms); milestone/goal-completion toasts get a highlighter sweep. Respect `prefers-reduced-motion` globally.

### 11.7 Voice
Dost ama dürüst. Sentence case, plain verbs, no exclamation-mark cheerleading, no guilt. Buttons say exactly what happens (`Kaydet`, `Ayı kapat`, `Vazgeç`, `Kumbaraya aktar`). Errors state the fix: `"Tutar boş olamaz."` Wry warmth reserved for empty states, achievements, and the lapse card. Regret and low grades always paired with one concrete, winnable observation (P6, §8.6).

## 12. UI copy — canonical strings (`src/i18n/tr.ts`)
Centralize all strings. Canonical set (extend in the same voice):
tabs `Özet · İşlemler · Bütçe · İçgörü`; quick-add `Gider / Gelir / Kaydet / Detay / Kısayollar`; envelope status `"… zarfında ₺X kaldı" / "Bu harcamayla zarf ₺X aşılır"`; bilinç `Gerekli / İstek / Boş` + `Yargı yok — sadece dürüstlük.`; dashboard `Kalan / Güne düşen / … gündür boş harcama yok / Seri duraklatıldı / Kumbarayı başlat / Bu ay +₺X`; review `Pazar Muhasebesi / Etiket doğru mu? / Buna değdi mi? / Değdi / Eh / Pişman / Sonra / En çok değen`; cooldown `Soğuma Listesi / Hâlâ istiyor musun? / Al / Vazgeç / Kumbaraya aktar / Şimdilik kalsın / Vazgeçerek kurtardın`; kumbara `Kumbara / Genel Kumbara / Para ekle / Para çek / Bu hızla: … / Hedef tamam 🎉`; budgets `Zarflar / devir / Zarfları hazırla`; recurring `Sabitler / Abonelikler / Onayla / Bu ay atla`; recovery `Boşluğu doldur / Bu gün harcama yoktu / Hatırlamıyorum / Boş ver, bugünden devam`; close `Ayı kapat / Cebinde kalan / Kumbaraya taşıyalım mı? / Bu ayı bir cümleyle anlat`; settings `Maaş günü / Aylık net gelir / Zaman maliyetini göster / Birikim hedefi oranı / Kısayollar`; inflation footnote `Not: Enflasyonu unutma — farkın bir kısmı fiyat artışı olabilir.`

## 13. PWA & offline
`vite-plugin-pwa`: precache app shell + self-hosted fonts; `display: standalone`; theme-color = `--paper` per scheme; maskable icons (simple: Fraunces lowercase "d" with a red-pen underline, ballpoint on paper). Everything works with zero network. If IndexedDB unavailable (private mode), show a blocking friendly notice — do not silently fall back to memory.

## 14. Export / import
- **Export JSON**: full dump `{ schemaVersion: 2, exportedAt, data: {…all stores} }` → file download `denge-yedek-YYYY-MM-DD.json`. (schemaVersion 2 = v1.1 model with savings/templates stores.)
- **Export CSV**: transactions only, `tr-TR` friendly (semicolon-separated, comma decimals), UTF-8 BOM for Excel.
- **Import JSON**: validate schemaVersion (accept 1 with an in-place migration that adds empty new stores); strategy = upsert by id (newer `createdAt`/`closedAt` wins); show a diff summary (`X yeni, Y güncellendi`) before committing; always offer auto-export backup first.

## 15. Quality bar
- **Performance:** cold load < 2s mid-range phone; list virtualization not required under 5k transactions but keep month-scoped queries.
- **Accessibility:** WCAG AA contrast (verify redpen/green tints on both themes), 44px touch targets, visible focus, charts get `aria-label` summaries + the data must also exist in an accessible list/table nearby, reduced motion honored.
- **Robustness:** all `lib/` functions unit-tested (fiscal boundaries, clamping, grade edge cases incl. improvement bonus and weight redistribution, recurrence idempotency, lapse detection windows, streak pausing, money parse/format round-trip).

## 16. Development plan — phases & gates

Each phase: implement → tests pass → `PHASE_NOTES.md` debrief → **WAIT for approval** (§0).

**P0 — Scaffold.** Vite/React/TS strict, Tailwind + tokens, fonts self-hosted, router + tab shell + FAB placeholder, theme switching, PWA plugin config. *AC: builds clean; tabs navigate; dark/light works; fonts render Turkish (ğüşiİıçö).*

**P1 — Data core.** Full Dexie schema (incl. `savingsGoals`, `savingsEntries`, `quickTemplates`) + repositories, settings singleton, default categories + Genel Kumbara seed, `lib/money`, `lib/fiscal` with tests, onboarding flow (4 screens incl. Kumbara starter). *AC: tests green; onboarding writes settings + default goal; fiscal month math correct for startDay 1, 15, 28 around month boundaries.*

**P2 — Transactions.** Quick-add sheet (numpad, chips, bilinç, detay), list with grouping/filters/search, detail edit/delete, categories manager, **Kısayollar**: template CRUD, quick-add row, one-tap save, "Kısayol yap" action. *AC: 5-second entry path works; template path is 1 tap; necessity enforced; `necessityOriginal` set once; edits live-update via useLiveQuery.*

**P3 — Budgets & recurring.** Envelopes + overrides + rollover, suggestion chips, **live envelope status in quick-add** (appears once budgets exist), recurring engine + tests, auto-post on open, subscriptions + Yıllık Şok, pending confirmations. *AC: idempotent posting (reopen app → no duplicates); clamped dates correct; over-budget shows red pen; envelope line updates live with typed digits.*

**P4 — Dashboard & recovery.** Safe-to-spend (savings-aware §8.3), pace bar, donut, 6-month trend with boş overlay, heatmap SVG (backfill opacity), streak card with pause state, pending cards, **lapse detection + Boşluk affı backfill flow**. *AC: numbers reconcile with list totals; a seeded 5-day gap triggers the card; backfill un-pauses streak days; "Boş ver" dismisses without breaking streak math.*

**P5 — Bilinç suite & Kumbara.** Pazar Muhasebesi flow (reclassify step + regret + celebration summary) + badge logic, Soğuma Listesi + **Kumbaraya aktar bridge**, Kumbara segment (goals, entries, projections, completion), time cost, mood polish. *AC: review only surfaces last completed week's unreviewed istek/boş; reclassify-to-gerekli skips regret; vazgeç→kumbara creates linked SavingsEntry; both counters correct; kumbara deposits reduce safe-to-spend; regret strikes appear.*

**P6 — İçgörüler & Ay Kapanışı.** All insight cards (incl. cumulative savings line, honesty card, inflation footnotes) with small-sample guards, 6-step close wizard incl. savings step, new grade (§8.6) + archive. *AC: grade matches §8.6 fixtures incl. improvement bonus and no-data redistribution; D/F reveal leads with actionable copy; insights hide gracefully without data.*

**P7 — Polish & ship.** Export/import (schemaVersion 2 + v1 migration), demo seed toggle, PWA offline verification, a11y pass, empty states, README (setup, architecture map, how to add a category color). *AC: full offline session works after install; import round-trips an export losslessly; v1-format import migrates cleanly.*

## 17. Edge cases (must handle)
Fiscal startDay near month ends (capped 28, still test 28 in February); recurring day 31 → clamp; app closed for 3 months → recurrence backfills all missed periods *and* lapse card covers the gap (backfill stepper capped at the last 14 days — older days offered only as "Hatırlamıyorum" bulk-skip); category archive with history (reassign flow) + dependent templates hidden; future-dated transactions (allowed, excluded from streaks & safe-to-spend "spent"); zero/negative amount blocked with inline error; necessity edit outside review clears regret; reclassify-to-`gerekli` inside review clears any prior regret and exits the flow for that item; kumbara withdrawal below zero blocked; deleting a goal forbidden — archive only (entries preserved); import into non-empty DB (merge per §14); Turkish input parsing (`1.250,75`); very long notes truncate with ellipsis in rows.

## 18. Demo seed data
Settings toggle `Demo verisi yükle` (and `Demoyu temizle`, which removes only seeded ids — tag them with a `demo-` id prefix): generates ~4 months of realistic Turkish data — salary income on day 15, market/yemek/ulaşım weekly patterns, 3 subscriptions (Spotify, Netflix, spor salonu), scattered `boş` purchases weighted to evenings/weekends with `stresli/sıkılmış` moods, a few reviewed regrets **including 2 istek→bos reclassifications**, one wishlist item of each status **with one vazgeçme transferred to kumbara**, a Kumbara goal (`🎸 Yeni gitar`, target ₺15.000, ~40% funded across sources), 3 Kısayollar (kahve, dolmuş, öğle yemeği), one 4-day lapse gap in the oldest month (partially backfilled), and one closed month with grade B (+improvement bonus). Purpose: every screen and every new v1.1 mechanic demonstrable instantly.

## 19. v2 backlog (do not build — parking lot)
Real inflation-adjusted comparisons (TÜİK CPI table shipped with app), CSV bank-statement import with mapping, PWA local notifications (Pazar Muhasebesi & cooldown reminders), shared budgets, price-per-use for subscriptions, yearly report ("Denge Wrapped"), savings goal auto-plans ("ayda ₺X koyarsan Mart'ta biter" reverse planner), local LLM insight summaries, home-screen widgets.

---
*End of spec v1.1 — Denge. Sıradaki adım: P0.*
