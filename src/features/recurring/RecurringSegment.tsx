import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import { tr as trLocale } from 'date-fns/locale';
import { Sheet } from '../../components/Sheet';
import { tr } from '../../i18n/tr';
import { ti } from '../../i18n/interpolate';
import { formatMinor, minorToInput, parseAmountMinor } from '../../lib/money';
import { annualizedMinor, monthlyizedMinor, nextDueDate } from '../../lib/recurrence';
import { addDaysISO, parseLocalDate, todayISO } from '../../lib/dates';
import { listCategories } from '../../db/repo/categories';
import {
  addRule,
  deleteRule,
  listRules,
  postDueRecurring,
  updateRule,
  type RuleDraft,
} from '../../db/repo/recurring';
import type { Category, Necessity, RecurringRule } from '../../db/types';

function formatDue(rule: RecurringRule): string {
  const after = rule.lastPostedDate ?? addDaysISO(todayISO(), -1);
  const next = nextDueDate(rule, after);
  if (!next) return '';
  return ti(tr.recurring.nextDue, {
    date: format(parseLocalDate(next), 'd MMMM', { locale: trLocale }),
  });
}

export function RecurringSegment() {
  const [sheet, setSheet] = useState<{ open: boolean; rule?: RecurringRule }>({
    open: false,
  });

  const data = useLiveQuery(async () => {
    const [rules, categories] = await Promise.all([listRules(), listCategories()]);
    return { rules, categories: new Map(categories.map((c) => [c.id, c])) };
  });
  if (!data) return null;

  const fixed = data.rules.filter((r) => !r.isSubscription);
  const subs = data.rules.filter((r) => r.isSubscription);
  const activeSubs = subs.filter((r) => r.isActive);
  const monthlyTotal = activeSubs.reduce(
    (sum, r) => sum + monthlyizedMinor(r.cadence, r.amountMinor),
    0,
  );
  const annualTotal = activeSubs.reduce(
    (sum, r) => sum + annualizedMinor(r.cadence, r.amountMinor),
    0,
  );

  return (
    <div className="space-y-4">
      {data.rules.length === 0 && (
        <p className="text-base text-ink-soft">{tr.recurring.empty}</p>
      )}

      {fixed.length > 0 && (
        <div className="divide-y divide-grid rounded-card border border-grid bg-card">
          {fixed.map((r) => (
            <RuleRow
              key={r.id}
              rule={r}
              category={data.categories.get(r.categoryId)}
              onEdit={() => setSheet({ open: true, rule: r })}
            />
          ))}
        </div>
      )}

      {subs.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between">
            <h2 className="text-xs font-medium uppercase tracking-wide text-ink-soft">
              {tr.recurring.subscriptions}
            </h2>
            <span className="font-mono text-xs text-ink-soft">
              {tr.recurring.monthlyTotal}: {formatMinor(monthlyTotal)}
            </span>
          </div>
          <div className="mt-1.5 divide-y divide-grid rounded-card border border-grid bg-card">
            {subs.map((r) => (
              <RuleRow
                key={r.id}
                rule={r}
                category={data.categories.get(r.categoryId)}
                onEdit={() => setSheet({ open: true, rule: r })}
                showAnnual
              />
            ))}
          </div>
          {/* Yıllık Şok (§9.6) */}
          <p className="mt-2 text-base font-medium text-ink">
            {ti(tr.recurring.annualShock, { amount: formatMinor(annualTotal) })}
          </p>
        </section>
      )}

      <button
        type="button"
        onClick={() => setSheet({ open: true })}
        className="text-base font-medium text-ballpoint"
      >
        + {tr.recurring.add}
      </button>

      {sheet.open && (
        <RuleSheet
          key={sheet.rule?.id ?? 'new'}
          editing={sheet.rule}
          onClose={() => setSheet({ open: false })}
        />
      )}
    </div>
  );
}

function RuleRow(props: {
  rule: RecurringRule;
  category?: Category;
  onEdit: () => void;
  showAnnual?: boolean;
}) {
  const { rule } = props;
  return (
    <button
      type="button"
      onClick={props.onEdit}
      className={`flex min-h-11 w-full items-center gap-3 px-3 py-2.5 text-left ${
        rule.isActive ? '' : 'opacity-50'
      }`}
    >
      <span aria-hidden>{props.category?.emoji ?? '📌'}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base">{rule.name}</span>
        <span className="block text-xs text-ink-soft">
          {rule.isActive ? formatDue(rule) : tr.recurring.paused}
        </span>
      </span>
      <span className="text-right">
        <span
          className={`block font-mono text-base ${
            rule.type === 'income' ? 'text-green' : 'text-ink'
          }`}
        >
          {rule.type === 'income' ? '+' : ''}
          {formatMinor(rule.amountMinor)}
        </span>
        {props.showAnnual && (
          <span className="block font-mono text-xs text-ink-soft">
            {ti(tr.recurring.annualCost, {
              amount: formatMinor(annualizedMinor(rule.cadence, rule.amountMinor)),
            })}
          </span>
        )}
      </span>
    </button>
  );
}

function RuleSheet(props: { editing?: RecurringRule; onClose: () => void }) {
  const { editing } = props;
  const [name, setName] = useState(editing?.name ?? '');
  const [amount, setAmount] = useState(
    editing ? minorToInput(editing.amountMinor) : '',
  );
  const [type, setType] = useState<'expense' | 'income'>(editing?.type ?? 'expense');
  const [categoryId, setCategoryId] = useState(editing?.categoryId ?? '');
  const [cadence, setCadence] = useState<RuleDraft['cadence']>(
    editing?.cadence ?? 'monthly',
  );
  const [dayOfMonth, setDayOfMonth] = useState(editing?.dayOfMonth ?? 1);
  const [weekday, setWeekday] = useState(editing?.weekday ?? 1);
  const [month, setMonth] = useState(editing?.month ?? 1);
  const [isSubscription, setIsSubscription] = useState(
    editing?.isSubscription ?? false,
  );
  const [autoPost, setAutoPost] = useState(editing?.autoPost ?? true);
  const [necessity, setNecessity] = useState<Necessity>(
    editing?.necessity ?? 'gerekli',
  );
  const [isActive, setIsActive] = useState(editing?.isActive ?? true);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string>();

  const categories = useLiveQuery(() => listCategories(type), [type]);

  async function save() {
    if (!name.trim()) {
      setError(tr.recurring.nameRequired);
      return;
    }
    const amountMinor = parseAmountMinor(amount);
    if (!amountMinor || amountMinor <= 0) {
      setError(tr.recurring.invalidAmount);
      return;
    }
    const catId = categoryId || categories?.[0]?.id;
    if (!catId) return;
    const draft: RuleDraft = {
      name: name.trim(),
      amountMinor,
      categoryId: catId,
      type,
      cadence,
      dayOfMonth: cadence !== 'weekly' ? dayOfMonth : undefined,
      weekday: cadence === 'weekly' ? weekday : undefined,
      month: cadence === 'yearly' ? month : undefined,
      isSubscription,
      autoPost,
      necessity: type === 'expense' ? necessity : undefined,
    };
    if (editing) await updateRule(editing.id, { ...draft, isActive });
    else await addRule(draft);
    // Post anything already due (e.g. a rule whose day is today).
    await postDueRecurring(todayISO());
    props.onClose();
  }

  const fieldCls =
    'mt-1 w-full rounded-card border border-grid bg-card px-3 py-2.5 text-base outline-none';

  return (
    <Sheet onClose={props.onClose}>
      <h2 className="text-md font-semibold">
        {editing ? tr.common.edit : tr.recurring.add}
      </h2>

      {!editing && (
        <div className="mt-3 flex gap-1 self-start rounded-full border border-grid p-1">
          {(['expense', 'income'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setType(t);
                setCategoryId('');
              }}
              aria-pressed={type === t}
              className={`rounded-full px-4 py-1.5 text-base ${
                type === t ? 'bg-ballpoint font-medium text-white' : 'text-ink-soft'
              }`}
            >
              {t === 'expense' ? tr.quickAdd.expense : tr.quickAdd.income}
            </button>
          ))}
        </div>
      )}

      <label className="mt-3 block text-base font-medium">
        {tr.recurring.name}
        <input value={name} onChange={(e) => setName(e.target.value)} className={fieldCls} />
      </label>

      <label className="mt-3 block text-base font-medium">
        {tr.recurring.amount}
        <input
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className={`${fieldCls} font-mono`}
        />
      </label>

      <label className="mt-3 block text-base font-medium">
        {tr.recurring.category}
        <select
          value={categoryId || categories?.[0]?.id || ''}
          onChange={(e) => setCategoryId(e.target.value)}
          className={`${fieldCls} min-h-11`}
        >
          {(categories ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.emoji} {c.name}
            </option>
          ))}
        </select>
      </label>

      <p className="mt-3 text-base font-medium">{tr.recurring.cadence}</p>
      <div className="mt-1 flex gap-2">
        {(['monthly', 'weekly', 'yearly'] as const).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCadence(c)}
            aria-pressed={cadence === c}
            className={`min-h-11 flex-1 rounded-full border text-base ${
              cadence === c
                ? 'border-ballpoint bg-ballpoint/15 font-medium text-ballpoint'
                : 'border-grid text-ink-soft'
            }`}
          >
            {tr.recurring[c]}
          </button>
        ))}
      </div>

      {cadence === 'weekly' ? (
        <div className="mt-3 flex gap-1.5">
          {tr.recurring.weekdaysShort.map((label, i) => (
            <button
              key={label}
              type="button"
              onClick={() => setWeekday(i + 1)}
              aria-pressed={weekday === i + 1}
              className={`min-h-11 flex-1 rounded-card border text-xs ${
                weekday === i + 1
                  ? 'border-ballpoint bg-ballpoint/15 font-medium text-ballpoint'
                  : 'border-grid text-ink-soft'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          {cadence === 'yearly' && (
            <label className="block flex-1 text-base font-medium">
              {tr.recurring.month}
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className={`${fieldCls} min-h-11`}
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {format(new Date(2026, i, 1), 'LLLL', { locale: trLocale })}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="block flex-1 text-base font-medium">
            {tr.recurring.dayOfMonth}
            <select
              value={dayOfMonth}
              onChange={(e) => setDayOfMonth(Number(e.target.value))}
              className={`${fieldCls} min-h-11 font-mono`}
            >
              {Array.from({ length: 31 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {type === 'expense' && (
        <div className="mt-3 flex gap-2">
          {(['gerekli', 'istek', 'bos'] as const).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setNecessity(n)}
              aria-pressed={necessity === n}
              className={`min-h-11 flex-1 rounded-full border text-base font-medium ${
                necessity === n
                  ? n === 'gerekli'
                    ? 'border-green bg-green/15 text-green'
                    : n === 'istek'
                      ? 'border-ballpoint bg-ballpoint/15 text-ballpoint'
                      : 'border-redpen bg-redpen/15 text-redpen'
                  : 'border-grid text-ink-soft'
              }`}
            >
              {tr.necessity[n]}
            </button>
          ))}
        </div>
      )}

      <ToggleRow
        label={tr.recurring.subscription}
        value={isSubscription}
        onToggle={() => setIsSubscription((v) => !v)}
      />
      <ToggleRow
        label={tr.recurring.autoPost}
        hint={tr.recurring.autoPostHint}
        value={autoPost}
        onToggle={() => setAutoPost((v) => !v)}
      />
      {editing && (
        <ToggleRow
          label={tr.recurring.active}
          value={isActive}
          onToggle={() => setIsActive((v) => !v)}
        />
      )}

      {error && <p className="mt-2 text-base text-redpen">{error}</p>}

      {editing && (
        <button
          type="button"
          onClick={() => {
            if (confirmingDelete) void deleteRule(editing.id).then(props.onClose);
            else setConfirmingDelete(true);
          }}
          className={`mt-4 min-h-11 w-full rounded-full border text-base font-medium ${
            confirmingDelete
              ? 'border-redpen bg-redpen text-white'
              : 'border-redpen text-redpen'
          }`}
        >
          {confirmingDelete ? tr.recurring.deleteConfirm : tr.categories.delete}
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

function ToggleRow(props: {
  label: string;
  hint?: string;
  value: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={props.onToggle}
      aria-pressed={props.value}
      className={`mt-3 flex min-h-11 w-full items-center justify-between rounded-card border px-3 text-base ${
        props.value ? 'border-ballpoint bg-ballpoint/10 text-ballpoint' : 'border-grid text-ink'
      }`}
    >
      <span className="text-left">
        {props.label}
        {props.hint && (
          <span className="block text-xs text-ink-soft">{props.hint}</span>
        )}
      </span>
      <span aria-hidden>{props.value ? '✓' : ''}</span>
    </button>
  );
}
