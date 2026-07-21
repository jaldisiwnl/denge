import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import { tr as trLocale } from 'date-fns/locale';
import { Sheet } from '../../components/Sheet';
import { tr } from '../../i18n/tr';
import { ti } from '../../i18n/interpolate';
import { useEphemeralStore } from '../../app/ui';
import { formatMinor, minorToInput, parseAmountMinor } from '../../lib/money';
import { installmentsLeft } from '../../lib/payments';
import { parseLocalDate, todayISO } from '../../lib/dates';
import { getSettings } from '../../db/repo/settings';
import { listCategories } from '../../db/repo/categories';
import {
  addObligation,
  deleteObligation,
  getForecastMonths,
  listObligations,
  payObligation,
  updateObligation,
  type ObligationDraft,
} from '../../db/repo/obligations';
import { RecurringSegment } from '../recurring/RecurringSegment';
import type { Category, Obligation, ObligationKind } from '../../db/types';

const KIND_EMOJI: Record<string, string> = {
  abonelik: '🔁',
  sabit: '📌',
  kart: '💳',
  borc: '🤝',
  planli: '📅',
};

/** Ödemeler (v1.3): forecast calendar + subscriptions + debts + planned. */
export function PaymentsSegment() {
  const [sheet, setSheet] = useState<
    { open: false } | { open: true; kind: ObligationKind; ob?: Obligation }
  >({ open: false });

  const categories = useLiveQuery(() => listCategories('expense'));
  const obligations = useLiveQuery(() => listObligations());
  const debts = (obligations ?? []).filter((o) => o.kind !== 'planli');
  const planned = (obligations ?? []).filter((o) => o.kind === 'planli');

  return (
    <div className="space-y-5">
      <ForecastCard />

      {/* Subscriptions & fixed — the existing recurring engine, unchanged */}
      <section>
        <h2 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-soft">
          {tr.payments.subscriptionsSection}
        </h2>
        <RecurringSegment />
      </section>

      {/* Borçlar: credit cards + person debts */}
      <section>
        <h2 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-soft">
          {tr.payments.debtsSection}
        </h2>
        {debts.length === 0 ? (
          <p className="text-base text-ink-soft">{tr.payments.debtsEmpty}</p>
        ) : (
          <div className="space-y-2">
            {debts.map((o) => (
              <ObligationRow
                key={o.id}
                obligation={o}
                onEdit={() => setSheet({ open: true, kind: o.kind, ob: o })}
              />
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => setSheet({ open: true, kind: 'kart' })}
          className="mt-2 text-base font-medium text-ballpoint"
        >
          + {tr.payments.addDebt}
        </button>
      </section>

      {/* Planlı ödemeler: one-off important payments */}
      <section>
        <h2 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-soft">
          {tr.payments.plannedSection}
        </h2>
        {planned.length === 0 ? (
          <p className="text-base text-ink-soft">{tr.payments.plannedEmpty}</p>
        ) : (
          <div className="space-y-2">
            {planned.map((o) => (
              <ObligationRow
                key={o.id}
                obligation={o}
                onEdit={() => setSheet({ open: true, kind: 'planli', ob: o })}
              />
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => setSheet({ open: true, kind: 'planli' })}
          className="mt-2 text-base font-medium text-ballpoint"
        >
          + {tr.payments.addPlanned}
        </button>
      </section>

      {sheet.open && (
        <ObligationSheet
          key={sheet.ob?.id ?? sheet.kind}
          kind={sheet.kind}
          editing={sheet.ob}
          categories={categories ?? []}
          onClose={() => setSheet({ open: false })}
        />
      )}
    </div>
  );
}

function ForecastCard() {
  const [which, setWhich] = useState<0 | 1>(0);
  const data = useLiveQuery(async () => {
    const settings = await getSettings();
    if (!settings) return null;
    return getForecastMonths(todayISO(), settings.monthStartDay);
  });
  if (!data) return null;
  const month = data[which];

  return (
    <section className="rounded-card border border-grid bg-card p-4">
      <div className="flex gap-1 rounded-full border border-grid p-1">
        {([0, 1] as const).map((i) => (
          <button
            key={i}
            type="button"
            onClick={() => setWhich(i)}
            aria-pressed={which === i}
            className={`min-h-9 flex-1 rounded-full text-base ${
              which === i ? 'bg-ballpoint font-medium text-white' : 'text-ink-soft'
            }`}
          >
            {i === 0 ? tr.payments.forecastThisMonth : tr.payments.forecastNextMonth}
          </button>
        ))}
      </div>

      <div className="mt-3 flex items-baseline justify-between">
        <span className="text-base text-ink-soft">{tr.payments.forecastTotal}</span>
        <span className="font-mono text-xl font-medium text-redpen">
          {formatMinor(month.totalMinor)}
        </span>
      </div>

      {month.entries.length === 0 ? (
        <p className="mt-2 text-base text-ink-soft">{tr.payments.forecastEmpty}</p>
      ) : (
        <div className="mt-2 divide-y divide-grid">
          {month.entries.map((e) => (
            <div key={`${e.sourceId}-${e.date}`} className="flex items-center gap-3 py-2">
              <span className="w-10 shrink-0 text-center">
                <span className="block font-mono text-md font-medium">
                  {format(parseLocalDate(e.date), 'd')}
                </span>
                <span className="block text-xs text-ink-soft">
                  {format(parseLocalDate(e.date), 'MMM', { locale: trLocale })}
                </span>
              </span>
              <span className="min-w-0 flex-1 truncate text-base">
                {KIND_EMOJI[e.kind]} {e.title}
              </span>
              <span className="shrink-0 font-mono text-base">
                {formatMinor(e.amountMinor)}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ObligationRow(props: { obligation: Obligation; onEdit: () => void }) {
  const showToast = useEphemeralStore((s) => s.showToast);
  const [paying, setPaying] = useState(false);
  const o = props.obligation;

  async function quickPay() {
    await payObligation(o, { dueDate: todayISO() });
    showToast(
      <span>
        {tr.payments.pay}: <span className="font-mono">{formatMinor(o.amountMinor)}</span>
        {' · '}
        {o.title}
      </span>,
    );
  }

  const scheduleText =
    o.kind === 'planli' && o.dueDate
      ? format(parseLocalDate(o.dueDate), 'd MMMM yyyy', { locale: trLocale })
      : o.dayOfMonth
        ? ti(tr.payments.on, { day: String(o.dayOfMonth) })
        : '';

  return (
    <div className="rounded-card border border-grid bg-card p-3">
      <div className="flex items-center gap-2">
        <span aria-hidden>{KIND_EMOJI[o.kind]}</span>
        <button
          type="button"
          onClick={props.onEdit}
          className="min-w-0 flex-1 text-left"
        >
          <span className="block truncate text-base">{o.title}</span>
          <span className="block text-xs text-ink-soft">
            {scheduleText}
            {o.remainingMinor !== undefined && (
              <>
                {scheduleText ? ' · ' : ''}
                {ti(tr.payments.remaining, { amount: formatMinor(o.remainingMinor) })}
                {o.amountMinor > 0 &&
                  ` · ${ti(tr.payments.installmentsLeft, {
                    n: String(installmentsLeft(o.remainingMinor, o.amountMinor)),
                  })}`}
              </>
            )}
          </span>
        </button>
        <span className="shrink-0 font-mono text-base">
          {formatMinor(o.amountMinor)}
        </span>
      </div>

      {!o.autoPost &&
        (paying ? (
          <PayInline
            obligation={o}
            onDone={() => setPaying(false)}
            onToast={showToast}
          />
        ) : (
          <button
            type="button"
            onClick={() =>
              o.kind === 'planli' ? void quickPay() : setPaying(true)
            }
            className="mt-2 min-h-9 w-full rounded-full border border-ballpoint text-base font-medium text-ballpoint"
          >
            {o.kind === 'planli' ? tr.payments.markPaid : tr.payments.pay}
          </button>
        ))}
    </div>
  );
}

function PayInline(props: {
  obligation: Obligation;
  onDone: () => void;
  onToast: (n: React.ReactNode) => void;
}) {
  const o = props.obligation;
  const [amount, setAmount] = useState(minorToInput(o.amountMinor));
  const [error, setError] = useState(false);

  async function confirm() {
    const amountMinor = parseAmountMinor(amount);
    if (!amountMinor || amountMinor <= 0) {
      setError(true);
      return;
    }
    await payObligation(o, { dueDate: todayISO(), amountMinor });
    props.onToast(
      <span>
        {tr.payments.pay}: <span className="font-mono">{formatMinor(amountMinor)}</span>
        {' · '}
        {o.title}
      </span>,
    );
    props.onDone();
  }

  return (
    <div className="mt-2 flex gap-2">
      <input
        inputMode="decimal"
        value={amount}
        onChange={(e) => {
          setAmount(e.target.value);
          setError(false);
        }}
        aria-label={tr.payments.payAmount}
        className={`min-w-0 flex-1 rounded-card border bg-card px-3 py-2 font-mono text-base outline-none ${
          error ? 'border-redpen' : 'border-grid'
        }`}
      />
      <button
        type="button"
        onClick={() => void confirm()}
        className="min-h-10 rounded-full bg-ballpoint px-5 text-base font-medium text-white"
      >
        {tr.payments.pay}
      </button>
    </div>
  );
}

function ObligationSheet(props: {
  kind: ObligationKind;
  editing?: Obligation;
  categories: Category[];
  onClose: () => void;
}) {
  const { editing } = props;
  const [kind, setKind] = useState<ObligationKind>(props.kind);
  const [title, setTitle] = useState(editing?.title ?? '');
  const [amount, setAmount] = useState(
    editing ? minorToInput(editing.amountMinor) : '',
  );
  const [categoryId, setCategoryId] = useState(editing?.categoryId ?? '');
  const [dayOfMonth, setDayOfMonth] = useState(editing?.dayOfMonth ?? 1);
  const [dueDate, setDueDate] = useState(editing?.dueDate ?? todayISO());
  const [total, setTotal] = useState(
    editing?.remainingMinor !== undefined ? minorToInput(editing.remainingMinor) : '',
  );
  const [autoPost, setAutoPost] = useState(editing?.autoPost ?? false);
  const [error, setError] = useState<string>();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const fieldCls =
    'mt-1 w-full rounded-card border border-grid bg-card px-3 py-2.5 text-base outline-none';

  async function save() {
    if (!title.trim()) {
      setError(tr.payments.titleRequired);
      return;
    }
    const amountMinor = parseAmountMinor(amount);
    if (!amountMinor || amountMinor <= 0) {
      setError(tr.payments.invalidAmount);
      return;
    }
    let remainingMinor: number | undefined;
    if (kind === 'borc' && total.trim()) {
      const parsed = parseAmountMinor(total);
      if (parsed === null || parsed <= 0) {
        setError(tr.payments.invalidAmount);
        return;
      }
      remainingMinor = parsed;
    }
    const draft: ObligationDraft = {
      kind,
      title: title.trim(),
      amountMinor,
      categoryId: categoryId || undefined,
      dayOfMonth: kind !== 'planli' ? dayOfMonth : undefined,
      dueDate: kind === 'planli' ? dueDate : undefined,
      remainingMinor,
      autoPost: kind === 'kart' ? autoPost : false,
    };
    if (editing) await updateObligation(editing.id, draft);
    else await addObligation(draft);
    props.onClose();
  }

  return (
    <Sheet onClose={props.onClose}>
      <h2 className="text-md font-semibold">
        {editing ? tr.payments.edit : `+ ${tr.payments[kind === 'kart' ? 'kindKart' : kind === 'borc' ? 'kindBorc' : 'kindPlanli']}`}
      </h2>

      {/* kind switch (new only) */}
      {!editing && (
        <div className="mt-3 flex gap-1 rounded-full border border-grid p-1">
          {(['kart', 'borc', 'planli'] as ObligationKind[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              aria-pressed={kind === k}
              className={`min-h-9 flex-1 rounded-full text-sm ${
                kind === k ? 'bg-ballpoint font-medium text-white' : 'text-ink-soft'
              }`}
            >
              {k === 'kart'
                ? tr.payments.kindKart
                : k === 'borc'
                  ? tr.payments.kindBorc
                  : tr.payments.kindPlanli}
            </button>
          ))}
        </div>
      )}

      <label className="mt-3 block text-base font-medium">
        {tr.payments.title}
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setError(undefined);
          }}
          className={fieldCls}
        />
      </label>

      <label className="mt-3 block text-base font-medium">
        {kind === 'planli' ? tr.payments.amount : tr.payments.monthlyAmount}
        <input
          inputMode="decimal"
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value);
            setError(undefined);
          }}
          className={`${fieldCls} font-mono`}
        />
      </label>

      {kind === 'borc' && (
        <label className="mt-3 block text-base font-medium">
          {tr.payments.totalDebt}
          <input
            inputMode="decimal"
            value={total}
            onChange={(e) => setTotal(e.target.value)}
            className={`${fieldCls} font-mono`}
          />
        </label>
      )}

      {kind === 'planli' ? (
        <label className="mt-3 block text-base font-medium">
          {tr.payments.dueDate}
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className={`${fieldCls} font-mono`}
          />
        </label>
      ) : (
        <label className="mt-3 block text-base font-medium">
          {tr.payments.dueDay}
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
      )}

      <label className="mt-3 block text-base font-medium">
        {tr.payments.category}
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className={`${fieldCls} min-h-11`}
        >
          <option value="">{tr.payments.noCategory}</option>
          {props.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.emoji} {c.name}
            </option>
          ))}
        </select>
      </label>

      {kind === 'kart' && (
        <button
          type="button"
          onClick={() => setAutoPost((v) => !v)}
          aria-pressed={autoPost}
          className={`mt-3 flex min-h-11 w-full items-center justify-between rounded-card border px-3 text-base ${
            autoPost ? 'border-ballpoint bg-ballpoint/10 text-ballpoint' : 'border-grid text-ink'
          }`}
        >
          <span className="text-left">
            {tr.payments.autoPost}
            <span className="block text-xs text-ink-soft">{tr.payments.autoPostHint}</span>
          </span>
          <span aria-hidden>{autoPost ? '✓' : ''}</span>
        </button>
      )}

      {error && <p className="mt-2 text-base text-redpen">{error}</p>}

      {editing && (
        <button
          type="button"
          onClick={() => {
            if (confirmingDelete) void deleteObligation(editing.id).then(props.onClose);
            else setConfirmingDelete(true);
          }}
          className={`mt-4 min-h-11 w-full rounded-full border text-base font-medium ${
            confirmingDelete ? 'border-redpen bg-redpen text-white' : 'border-redpen text-redpen'
          }`}
        >
          {confirmingDelete ? tr.payments.deleteConfirm : tr.payments.delete}
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
