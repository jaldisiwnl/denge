import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import { tr as trLocale } from 'date-fns/locale';
import { Sheet } from '../../components/Sheet';
import { tr } from '../../i18n/tr';
import { ti } from '../../i18n/interpolate';
import { useEphemeralStore } from '../../app/ui';
import { formatMinor, parseAmountMinor } from '../../lib/money';
import { addDaysISO, parseLocalDate } from '../../lib/dates';
import type { Gap } from '../../lib/lapse';
import { listCategories } from '../../db/repo/categories';
import { listTemplates, applyTemplate } from '../../db/repo/templates';
import { addTransaction } from '../../db/repo/transactions';
import { dismissGap, markCleanDay } from '../../db/repo/lapse';
import type { Necessity, QuickTemplate, Transaction } from '../../db/types';

const MAX_STEP_DAYS = 14; // older days are bulk "Hatırlamıyorum" (§17)

/**
 * Boşluğu doldur (§9.15): one compact screen per gap day. Designed to clear
 * a 5-day gap in under a minute — template taps + a mini add form.
 */
export function BackfillStepper(props: { gap: Gap; onClose: () => void }) {
  const showToast = useEphemeralStore((s) => s.showToast);

  const allDays: string[] = [];
  for (let d = props.gap.from; d <= props.gap.to; d = addDaysISO(d, 1)) {
    allDays.push(d);
  }
  const days = allDays.slice(-MAX_STEP_DAYS);
  const skippedCount = allDays.length - days.length;

  const [index, setIndex] = useState(0);
  const [added, setAdded] = useState<Transaction[]>([]);
  const day = days[index]!;

  const data = useLiveQuery(async () => {
    const [templates, categories] = await Promise.all([
      listTemplates(),
      listCategories('expense'),
    ]);
    const active = new Set(categories.map((c) => c.id));
    return { templates: templates.filter((t) => active.has(t.categoryId)), categories };
  });

  async function next() {
    if (index + 1 < days.length) {
      setIndex(index + 1);
      setAdded([]);
      return;
    }
    // Flow complete: card resolved; un-backfilled days stay paused (§8.8).
    await dismissGap(props.gap);
    showToast(tr.recovery.done);
    props.onClose();
  }

  async function noSpend() {
    await markCleanDay(day);
    await next();
  }

  async function useTemplate(t: QuickTemplate) {
    const txn = await applyTemplate(t, { date: day, isBackfilled: true });
    setAdded((prev) => [...prev, txn]);
  }

  return (
    <Sheet onClose={props.onClose} full>
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-ink-soft">
          {ti(tr.recovery.progress, {
            current: String(index + 1),
            total: String(days.length),
          })}
        </span>
        <button
          type="button"
          onClick={props.onClose}
          aria-label={tr.common.close}
          className="flex h-11 w-11 items-center justify-center rounded-full text-ink-soft"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      {skippedCount > 0 && index === 0 && (
        <p className="mt-1 text-xs text-ink-soft">
          {ti(tr.recovery.olderSkipped, { days: String(skippedCount) })}
        </p>
      )}

      <h2 className="mt-2 font-display text-2xl font-semibold">
        {format(parseLocalDate(day), 'd MMMM EEEE', { locale: trLocale })}
      </h2>

      {(data?.templates.length ?? 0) > 0 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {data!.templates.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => void useTemplate(t)}
              className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-grid px-3 text-base text-ink"
            >
              {t.emoji && <span aria-hidden>{t.emoji}</span>}
              {t.name}
              <span className="font-mono text-xs text-ink-soft">
                {formatMinor(t.amountMinor)}
              </span>
            </button>
          ))}
        </div>
      )}

      <MiniAddForm
        day={day}
        categories={data?.categories ?? []}
        onAdded={(txn) => setAdded((prev) => [...prev, txn])}
      />

      {added.length > 0 && (
        <ul className="mt-3 space-y-1">
          {added.map((t) => (
            <li key={t.id} className="flex justify-between text-base text-ink-soft">
              <span>✓</span>
              <span className="font-mono">{formatMinor(t.amountMinor)}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto space-y-2 pt-4">
        {added.length > 0 ? (
          <button
            type="button"
            onClick={() => void next()}
            className="min-h-12 w-full rounded-full bg-ballpoint text-md font-medium text-white"
          >
            {tr.recovery.next}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void noSpend()}
            className="min-h-12 w-full rounded-full bg-ballpoint text-md font-medium text-white"
          >
            {tr.recovery.noSpend}
          </button>
        )}
        <button
          type="button"
          onClick={() => void next()}
          className="min-h-11 w-full rounded-full text-base text-ink-soft"
        >
          {tr.recovery.dontRemember}
        </button>
      </div>
    </Sheet>
  );
}

function MiniAddForm(props: {
  day: string;
  categories: { id: string; name: string; emoji: string }[];
  onAdded: (txn: Transaction) => void;
}) {
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [necessity, setNecessity] = useState<Necessity>();
  const [error, setError] = useState(false);

  async function add() {
    const amountMinor = parseAmountMinor(amount);
    const catId = categoryId || props.categories[0]?.id;
    if (!amountMinor || amountMinor <= 0 || !catId || !necessity) {
      setError(true);
      return;
    }
    const txn = await addTransaction({
      type: 'expense',
      amountMinor,
      categoryId: catId,
      date: props.day,
      necessity,
      isBackfilled: true,
    });
    props.onAdded(txn);
    setAmount('');
    setNecessity(undefined);
    setError(false);
  }

  return (
    <div className="mt-3 rounded-card border border-grid p-3">
      <div className="flex gap-2">
        <input
          inputMode="decimal"
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value);
            setError(false);
          }}
          placeholder="0,00"
          aria-label={tr.templates.amount}
          className="min-w-0 flex-1 rounded-card border border-grid bg-card px-3 py-2 font-mono text-base outline-none placeholder:text-ink-soft/50"
        />
        <select
          value={categoryId || props.categories[0]?.id || ''}
          onChange={(e) => setCategoryId(e.target.value)}
          aria-label={tr.templates.category}
          className="min-h-11 max-w-[40%] rounded-card border border-grid bg-card px-2 text-base outline-none"
        >
          {props.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.emoji} {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-2 flex gap-2">
        {(['gerekli', 'istek', 'bos'] as const).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setNecessity(n)}
            aria-pressed={necessity === n}
            className={`min-h-10 flex-1 rounded-full border text-xs font-medium ${
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
        <button
          type="button"
          onClick={() => void add()}
          className="min-h-10 rounded-full border border-ink px-4 text-xs font-medium text-ink"
        >
          {tr.recovery.addExpense}
        </button>
      </div>
      {error && (
        <p className="mt-1.5 text-xs text-redpen">{tr.quickAdd.amountEmpty}</p>
      )}
    </div>
  );
}
