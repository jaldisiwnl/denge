import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Sheet } from '../../components/Sheet';
import { RedPen } from '../../components/RedPen';
import { tr } from '../../i18n/tr';
import { ti } from '../../i18n/interpolate';
import { useEphemeralStore } from '../../app/ui';
import { formatMinor, minorToInput, parseAmountMinor } from '../../lib/money';
import { getDaysRemaining, getMonthKey } from '../../lib/fiscal';
import { todayISO } from '../../lib/dates';
import { getSettings } from '../../db/repo/settings';
import { listCategories } from '../../db/repo/categories';
import {
  deleteBudget,
  getBudget,
  getOverride,
  listEnvelopeStatuses,
  setOverride,
  suggestForCategory,
  upsertBudget,
  type EnvelopeStatus,
} from '../../db/repo/budgets';
import type { Category } from '../../db/types';

export function EnvelopesSegment() {
  const [editCategory, setEditCategory] = useState<Category>();
  const showToast = useEphemeralStore((s) => s.showToast);

  const data = useLiveQuery(async () => {
    const settings = await getSettings();
    if (!settings) return null;
    const startDay = settings.monthStartDay;
    const monthKey = getMonthKey(todayISO(), startDay);
    const [statuses, categories] = await Promise.all([
      listEnvelopeStatuses(monthKey, startDay),
      listCategories('expense'),
    ]);
    return {
      startDay,
      monthKey,
      statuses,
      categories,
      daysRemaining: getDaysRemaining(todayISO(), monthKey, startDay),
    };
  });

  if (!data) return null;
  const { statuses, categories, monthKey, startDay, daysRemaining } = data;

  const byCategory = new Map(statuses.map((s) => [s.categoryId, s]));
  const budgeted = categories.filter((c) => byCategory.has(c.id));
  const unbudgeted = categories.filter((c) => !byCategory.has(c.id));

  const totalBudget = statuses.reduce((s, e) => s + e.totalMinor, 0);
  const totalSpent = statuses.reduce((s, e) => s + e.spentMinor, 0);
  const perDay = Math.max(
    0,
    Math.floor((totalBudget - totalSpent) / Math.max(1, daysRemaining)),
  );

  async function bulkSetup() {
    let count = 0;
    for (const c of unbudgeted) {
      const suggestion = await suggestForCategory(c.id, monthKey, startDay);
      if (suggestion) {
        await upsertBudget(c.id, suggestion, false);
        count++;
      }
    }
    showToast(
      count > 0
        ? ti(tr.budgets.setupDone, { count: String(count) })
        : tr.budgets.setupNoHistory,
    );
  }

  return (
    <div className="space-y-4">
      {budgeted.length > 0 && (
        <section className="rounded-card border border-grid bg-card p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-base text-ink-soft">{tr.budgets.totalBudget}</span>
            <span className="font-mono text-base">{formatMinor(totalBudget)}</span>
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-base text-ink-soft">{tr.budgets.spent}</span>
            <span className="font-mono text-base">{formatMinor(totalSpent)}</span>
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-base text-ink-soft">
              {tr.budgets.perDay} · {ti(tr.budgets.daysLeft, { days: String(daysRemaining) })}
            </span>
            <span className="font-mono text-md font-medium">{formatMinor(perDay)}</span>
          </div>
        </section>
      )}

      {budgeted.length === 0 && (
        <section className="rounded-card border border-grid bg-card p-4 text-center">
          <p className="text-base text-ink-soft">{tr.budgets.setupHint}</p>
          <button
            type="button"
            onClick={() => void bulkSetup()}
            className="mt-3 min-h-11 rounded-full bg-ballpoint px-6 text-base font-medium text-white"
          >
            {tr.budgets.setupCta}
          </button>
        </section>
      )}

      <div className="space-y-2">
        {budgeted.map((c) => (
          <EnvelopeCard
            key={c.id}
            category={c}
            status={byCategory.get(c.id)!}
            onEdit={() => setEditCategory(c)}
          />
        ))}
      </div>

      {unbudgeted.length > 0 && (
        <section>
          <h2 className="text-xs font-medium uppercase tracking-wide text-ink-soft">
            {tr.budgets.addEnvelope}
          </h2>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {unbudgeted.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setEditCategory(c)}
                className="flex min-h-11 items-center gap-1.5 rounded-full border border-dashed border-grid px-3 text-base text-ink-soft"
              >
                <span aria-hidden>{c.emoji}</span>
                {c.name}
                <span aria-hidden>+</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {editCategory && (
        <EnvelopeSheet
          key={editCategory.id}
          category={editCategory}
          monthKey={monthKey}
          startDay={startDay}
          onClose={() => setEditCategory(undefined)}
        />
      )}
    </div>
  );
}

function EnvelopeCard(props: {
  category: Category;
  status: EnvelopeStatus;
  onEdit: () => void;
}) {
  const { status } = props;
  const over = status.spentMinor > status.totalMinor;
  const ratio =
    status.totalMinor > 0 ? status.spentMinor / status.totalMinor : 1;
  const remaining = status.totalMinor - status.spentMinor;

  return (
    <button
      type="button"
      onClick={props.onEdit}
      className="w-full rounded-card border border-grid bg-card p-4 text-left"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 text-base">
          <span aria-hidden>{props.category.emoji}</span>
          <span className="truncate">{props.category.name}</span>
          {status.rolloverMinor > 0 && (
            <span className="shrink-0 rounded-full bg-green/15 px-2 py-0.5 text-xs text-green">
              {ti(tr.budgets.rolloverChip, { amount: formatMinor(status.rolloverMinor) })}
            </span>
          )}
        </span>
        <span className="shrink-0 font-mono text-base">
          {formatMinor(status.spentMinor)}
          <span className="text-ink-soft">
            {' / '}
            {/* Over budget → red-pen circle around the total (§9.5, §11.5) */}
            {over ? (
              <RedPen variant="circle">{formatMinor(status.totalMinor)}</RedPen>
            ) : (
              formatMinor(status.totalMinor)
            )}
          </span>
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-grid">
        <div
          className={`h-full rounded-full ${over ? 'bg-redpen' : 'bg-ballpoint'}`}
          style={{ width: `${Math.min(100, ratio * 100)}%` }}
        />
      </div>
      <p className={`mt-1.5 text-xs ${over ? 'text-redpen' : 'text-ink-soft'}`}>
        {over
          ? ti(tr.budgets.exceeded, { amount: formatMinor(-remaining) })
          : ti(tr.budgets.left, { amount: formatMinor(remaining) })}
      </p>
    </button>
  );
}

function EnvelopeSheet(props: {
  category: Category;
  monthKey: string;
  startDay: number;
  onClose: () => void;
}) {
  const { category, monthKey, startDay } = props;
  const [amount, setAmount] = useState<string>();
  const [override, setOverrideStr] = useState<string>();
  const [rollover, setRollover] = useState<boolean>();
  const [error, setError] = useState(false);

  const existing = useLiveQuery(async () => {
    const [budget, monthOverride, suggestion] = await Promise.all([
      getBudget(category.id),
      getOverride(category.id, monthKey),
      suggestForCategory(category.id, monthKey, startDay),
    ]);
    return { budget, monthOverride, suggestion };
  }, [category.id, monthKey, startDay]);

  if (!existing) return null;
  const { budget, monthOverride, suggestion } = existing;

  // Local edits win; otherwise show stored values.
  const amountValue =
    amount ?? (budget ? minorToInput(budget.amountMinor) : '');
  const overrideValue =
    override ?? (monthOverride ? minorToInput(monthOverride.amountMinor) : '');
  const rolloverValue = rollover ?? budget?.rollover ?? false;

  async function save() {
    const amountMinor = parseAmountMinor(amountValue);
    if (!amountMinor || amountMinor <= 0) {
      setError(true);
      return;
    }
    const overrideMinor = overrideValue.trim()
      ? parseAmountMinor(overrideValue)
      : null;
    if (overrideValue.trim() && (overrideMinor === null || overrideMinor <= 0)) {
      setError(true);
      return;
    }
    await upsertBudget(category.id, amountMinor, rolloverValue);
    await setOverride(category.id, monthKey, overrideMinor);
    props.onClose();
  }

  return (
    <Sheet onClose={props.onClose}>
      <h2 className="text-md font-semibold">
        {category.emoji} {category.name}
      </h2>

      <label className="mt-4 block text-base font-medium">
        {tr.budgets.defaultAmount}
        <input
          inputMode="decimal"
          value={amountValue}
          onChange={(e) => {
            setAmount(e.target.value);
            setError(false);
          }}
          className="mt-1 w-full rounded-card border border-grid bg-card px-3 py-2.5 font-mono text-base outline-none"
        />
      </label>
      {suggestion && (
        <button
          type="button"
          onClick={() => setAmount(minorToInput(suggestion))}
          className="mt-2 rounded-full border border-grid px-3 py-1.5 text-xs text-ink-soft"
        >
          {ti(tr.budgets.suggestion, { amount: formatMinor(suggestion) })}
        </button>
      )}

      <label className="mt-3 block text-base font-medium">
        {tr.budgets.overrideLabel}
        <input
          inputMode="decimal"
          value={overrideValue}
          onChange={(e) => {
            setOverrideStr(e.target.value);
            setError(false);
          }}
          placeholder={tr.budgets.overrideHint}
          className="mt-1 w-full rounded-card border border-grid bg-card px-3 py-2.5 font-mono text-base outline-none placeholder:font-sans placeholder:text-xs placeholder:text-ink-soft/60"
        />
      </label>

      <button
        type="button"
        onClick={() => setRollover(!rolloverValue)}
        aria-pressed={rolloverValue}
        className={`mt-4 flex min-h-11 w-full items-center justify-between rounded-card border px-3 text-base ${
          rolloverValue ? 'border-green bg-green/10 text-green' : 'border-grid text-ink'
        }`}
      >
        <span>
          {tr.budgets.rollover}
          <span className="block text-xs text-ink-soft">{tr.budgets.rolloverHint}</span>
        </span>
        <span aria-hidden>{rolloverValue ? '✓' : ''}</span>
      </button>

      {error && <p className="mt-2 text-base text-redpen">{tr.budgets.invalidAmount}</p>}

      {budget && (
        <button
          type="button"
          onClick={() => void deleteBudget(category.id).then(props.onClose)}
          className="mt-4 min-h-11 w-full rounded-full border border-redpen text-base font-medium text-redpen"
        >
          {tr.budgets.removeEnvelope}
        </button>
      )}

      <button
        type="button"
        onClick={() => void save()}
        className="mt-4 min-h-12 w-full rounded-full bg-ballpoint text-md font-medium text-white"
      >
        {tr.common.save}
      </button>
    </Sheet>
  );
}
