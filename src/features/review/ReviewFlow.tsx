import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import { tr as trLocale } from 'date-fns/locale';
import { Sheet } from '../../components/Sheet';
import { tr } from '../../i18n/tr';
import { ti } from '../../i18n/interpolate';
import { formatMinor } from '../../lib/money';
import { parseLocalDate } from '../../lib/dates';
import { listAllCategories } from '../../db/repo/categories';
import { reviewTransaction } from '../../db/repo/transactions';
import type { Category, Necessity, Regret, Transaction } from '../../db/types';

interface ReviewedItem {
  txn: Transaction;
  regret?: Regret;
  reclassifiedTo?: Necessity;
}

const NECESSITY_STYLE: Record<Necessity, string> = {
  gerekli: 'border-green bg-green/15 text-green',
  istek: 'border-ballpoint bg-ballpoint/15 text-ballpoint',
  bos: 'border-redpen bg-redpen/15 text-redpen',
};

/**
 * Pazar Muhasebesi (§9.8): one card per item — optional reclassify (Step A),
 * then "Buna değdi mi?" (Step B). Reclassify-to-gerekli thanks & skips.
 * Ends with the carrot-before-stick summary (P6).
 */
export function ReviewFlow(props: { items: Transaction[]; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<ReviewedItem[]>([]);
  const [thanks, setThanks] = useState(false);

  const categories = useLiveQuery(listAllCategories);
  const categoryById = useMemo(
    () => new Map((categories ?? []).map((c) => [c.id, c])),
    [categories],
  );

  const item = props.items[index];
  const finished = index >= props.items.length;

  async function reclassify(next: Necessity) {
    if (!item || next === item.necessity) return;
    await reviewTransaction(item.id, { necessity: next });
    if (next === 'gerekli') {
      // §9.8: gerekli items aren't regret-reviewed — thank & move on.
      setResults((r) => [...r, { txn: item, reclassifiedTo: next }]);
      setThanks(true);
      window.setTimeout(() => {
        setThanks(false);
        setIndex((i) => i + 1);
      }, 900);
    } else {
      // keep the card, remember the reclassification for the summary
      item.necessity = next;
      setResults((r) => [
        ...r.filter((x) => x.txn.id !== item.id),
        { txn: item, reclassifiedTo: next },
      ]);
      setIndex((i) => i); // re-render
    }
  }

  async function answer(regret: Regret) {
    if (!item) return;
    await reviewTransaction(item.id, { regret });
    setResults((r) => {
      const prior = r.find((x) => x.txn.id === item.id);
      return [
        ...r.filter((x) => x.txn.id !== item.id),
        { txn: item, regret, reclassifiedTo: prior?.reclassifiedTo },
      ];
    });
    setIndex((i) => i + 1);
  }

  return (
    <Sheet onClose={props.onClose} full>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-md font-semibold">{tr.review.title}</h2>
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

      {/* progress dots */}
      <div className="mt-1 flex justify-center gap-1.5" aria-hidden>
        {props.items.map((t, i) => (
          <span
            key={t.id}
            className={`h-1.5 w-1.5 rounded-full ${
              i < index ? 'bg-ballpoint' : i === index ? 'bg-ink' : 'bg-grid'
            }`}
          />
        ))}
      </div>

      {!finished && item && (
        <div className="mt-6 flex flex-1 flex-col">
          <div className="rounded-card border border-grid bg-paper p-5 text-center">
            <p className="font-mono text-2xl font-medium">
              {formatMinor(item.amountMinor)}
            </p>
            <p className="mt-1 text-base text-ink">
              {categoryById.get(item.categoryId)?.emoji}{' '}
              {item.merchant || item.note || categoryById.get(item.categoryId)?.name}
            </p>
            <p className="mt-0.5 text-xs text-ink-soft">
              {format(parseLocalDate(item.date), 'd MMMM EEEE', { locale: trLocale })}
              {item.mood ? ` · ${tr.moods[item.mood]}` : ''}
            </p>

            {thanks ? (
              <p className="mt-5 text-base font-medium text-green">
                {tr.review.reclassifiedGerekli}
              </p>
            ) : (
              <>
                {/* Step A — reclassify (§9.8) */}
                <p className="mt-5 text-xs text-ink-soft">{tr.review.tagQuestion}</p>
                <div className="mt-1.5 flex justify-center gap-2">
                  {(['gerekli', 'istek', 'bos'] as Necessity[]).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => void reclassify(n)}
                      aria-pressed={item.necessity === n}
                      className={`min-h-10 rounded-full border px-4 text-xs font-medium ${
                        item.necessity === n
                          ? NECESSITY_STYLE[n]
                          : 'border-grid text-ink-soft'
                      }`}
                    >
                      {tr.necessity[n]}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Step B — the question (§9.8) */}
          {!thanks && (
            <>
              <p className="mt-6 text-center font-display text-xl font-semibold">
                {tr.review.question}
              </p>
              <div className="mt-3 flex gap-2">
                {(['degdi', 'eh', 'pisman'] as Regret[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => void answer(r)}
                    className={`min-h-12 flex-1 rounded-full border text-base font-medium ${
                      r === 'pisman'
                        ? 'border-redpen text-redpen'
                        : r === 'degdi'
                          ? 'border-green text-green'
                          : 'border-grid text-ink'
                    }`}
                  >
                    {r === 'degdi'
                      ? tr.review.degdi
                      : r === 'eh'
                        ? tr.review.eh
                        : tr.review.pisman}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setIndex((i) => i + 1)}
                className="mt-3 min-h-11 w-full rounded-full text-base text-ink-soft"
              >
                {tr.review.later}
              </button>
            </>
          )}
        </div>
      )}

      {finished && (
        <ReviewSummary
          results={results}
          categoryById={categoryById}
          onClose={props.onClose}
        />
      )}
    </Sheet>
  );
}

/** Carrot before stick (P6): celebrate first, then the honest recap. */
function ReviewSummary(props: {
  results: ReviewedItem[];
  categoryById: Map<string, Category>;
  onClose: () => void;
}) {
  const answered = props.results.filter((r) => r.regret);
  const best = answered
    .filter((r) => r.regret === 'degdi')
    .sort((a, b) => b.txn.amountMinor - a.txn.amountMinor)[0];
  const totalMinor = answered.reduce((s, r) => s + r.txn.amountMinor, 0);
  const regretMinor = answered
    .filter((r) => r.regret === 'pisman')
    .reduce((s, r) => s + r.txn.amountMinor, 0);

  const regretByCategory = new Map<string, number>();
  for (const r of answered) {
    if (r.regret !== 'pisman') continue;
    regretByCategory.set(
      r.txn.categoryId,
      (regretByCategory.get(r.txn.categoryId) ?? 0) + r.txn.amountMinor,
    );
  }
  const worstCategory = [...regretByCategory.entries()].sort((a, b) => b[1] - a[1])[0];
  const istekToBos = props.results.filter(
    (r) => r.reclassifiedTo === 'bos' && r.txn.necessityOriginal === 'istek',
  ).length;

  return (
    <div className="mt-6 flex flex-1 flex-col space-y-3">
      {best && (
        <div className="rounded-card border border-grid bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">
            {tr.review.bestTitle}
          </p>
          <p className="mt-1 text-base">
            {ti(tr.review.bestLine, {
              amount: formatMinor(best.txn.amountMinor),
              label:
                best.txn.merchant ||
                best.txn.note ||
                props.categoryById.get(best.txn.categoryId)?.name ||
                '—',
            })}
          </p>
        </div>
      )}

      {regretMinor > 0 ? (
        <div className="rounded-card border border-grid bg-card p-4">
          <p className="text-base">
            {ti(tr.review.recap, {
              total: formatMinor(totalMinor),
              regret: formatMinor(regretMinor),
            })}
          </p>
          {worstCategory && (
            <p className="mt-1 text-xs text-ink-soft">
              {ti(tr.review.mostRegretCategory, {
                category: props.categoryById.get(worstCategory[0])?.name ?? '—',
              })}
            </p>
          )}
          <p className="mt-2 text-xs text-ink-soft">
            {ti(tr.review.kindLine, { amount: formatMinor(regretMinor) })}
          </p>
        </div>
      ) : (
        answered.length > 0 && (
          <div className="rounded-card border border-grid bg-card p-4">
            <p className="text-base">{tr.review.allWorthIt}</p>
          </div>
        )
      )}

      {istekToBos > 0 && (
        <div className="rounded-card border border-grid bg-card p-4">
          <p className="text-base">
            {ti(tr.review.honestyLine, { count: String(istekToBos) })}
          </p>
        </div>
      )}

      <div className="mt-auto pt-2">
        <button
          type="button"
          onClick={props.onClose}
          className="min-h-12 w-full rounded-full bg-ballpoint text-md font-medium text-white"
        >
          {tr.review.finish}
        </button>
      </div>
    </div>
  );
}
