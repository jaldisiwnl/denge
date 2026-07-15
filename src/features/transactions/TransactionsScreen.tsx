import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import { tr as trLocale } from 'date-fns/locale';
import { tr } from '../../i18n/tr';
import { useEphemeralStore } from '../../app/ui';
import { RedPen } from '../../components/RedPen';
import { formatMinor } from '../../lib/money';
import { getMonthKey, shiftMonthKey } from '../../lib/fiscal';
import { parseLocalDate, todayISO, daysAgoISO } from '../../lib/dates';
import { getSettings } from '../../db/repo/settings';
import { listAllCategories } from '../../db/repo/categories';
import { listMonthTransactions } from '../../db/repo/transactions';
import { CooldownSegment } from '../cooldown/CooldownSegment';
import type { Category, Necessity, Transaction } from '../../db/types';

const NECESSITY_DOT: Record<Necessity, string> = {
  gerekli: 'bg-green',
  istek: 'bg-ballpoint',
  bos: 'bg-redpen',
};

function dayHeader(date: string): string {
  if (date === todayISO()) return tr.list.today;
  if (date === daysAgoISO(1)) return tr.list.yesterday;
  return format(parseLocalDate(date), 'd MMMM EEEE', { locale: trLocale });
}

export function TransactionsScreen() {
  const settings = useLiveQuery(getSettings);
  const startDay = settings?.monthStartDay ?? 1;
  const currentKey = getMonthKey(todayISO(), startDay);

  // Dashboard tap-throughs (§9.7): donut slice → category, heatmap → day,
  // cooldown badge → Soğuma segment.
  const navState = useLocation().state as
    | { categoryId?: string; date?: string; segment?: string }
    | null;

  const [segment, setSegment] = useState<'islemler' | 'soguma'>(
    navState?.segment === 'soguma' ? 'soguma' : 'islemler',
  );
  const [monthOverride, setMonthOverride] = useState<string>();
  const [categoryFilter, setCategoryFilter] = useState(
    navState?.categoryId ?? 'all',
  );
  const [dateFilter, setDateFilter] = useState(navState?.date);
  const monthKey =
    monthOverride ??
    (dateFilter ? getMonthKey(dateFilter, startDay) : currentKey);
  const [necessityFilter, setNecessityFilter] = useState<'all' | Necessity>('all');
  const [search, setSearch] = useState('');

  const categories = useLiveQuery(listAllCategories);
  const transactions = useLiveQuery(
    () => listMonthTransactions(monthKey, startDay),
    [monthKey, startDay],
  );

  const categoryById = useMemo(
    () => new Map((categories ?? []).map((c) => [c.id, c])),
    [categories],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr');
    return (transactions ?? [])
      .filter((t) => categoryFilter === 'all' || t.categoryId === categoryFilter)
      .filter((t) => !dateFilter || t.date === dateFilter)
      .filter((t) => necessityFilter === 'all' || t.necessity === necessityFilter)
      .filter(
        (t) =>
          !q ||
          (t.note ?? '').toLocaleLowerCase('tr').includes(q) ||
          (t.merchant ?? '').toLocaleLowerCase('tr').includes(q),
      )
      .sort(
        (a, b) =>
          b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
      );
  }, [transactions, categoryFilter, dateFilter, necessityFilter, search]);

  // Group by day, preserving the date-desc order.
  const groups = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const t of filtered) {
      const list = map.get(t.date);
      if (list) list.push(t);
      else map.set(t.date, [t]);
    }
    return [...map.entries()];
  }, [filtered]);

  const monthLabel = format(parseLocalDate(`${monthKey}-01`), 'LLLL yyyy', {
    locale: trLocale,
  });
  const hasAnyThisMonth = (transactions?.length ?? 0) > 0;
  const filtersActive =
    categoryFilter !== 'all' ||
    necessityFilter !== 'all' ||
    search.trim() !== '' ||
    Boolean(dateFilter);

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold">{tr.tabs.islemler}</h1>

      {/* /islemler segments (§10): İşlemler | Soğuma */}
      <div className="mt-2 flex gap-1 rounded-full border border-grid bg-card p-1">
        {(
          [
            ['islemler', tr.tabs.islemler],
            ['soguma', tr.cooldown.title],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setSegment(key)}
            aria-pressed={segment === key}
            className={`min-h-10 flex-1 rounded-full text-base ${
              segment === key ? 'bg-ballpoint font-medium text-white' : 'text-ink-soft'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {segment === 'soguma' ? (
        <div className="mt-4">
          <CooldownSegment />
        </div>
      ) : (
        <>
      {/* Sticky filter bar (§9.3): fiscal month, category, necessity, search */}
      <div className="sticky top-0 z-10 -mx-4 mt-2 space-y-2 bg-paper px-4 py-2">
        <div className="flex items-center justify-between">
          <button
            type="button"
            aria-label={tr.list.prevMonth}
            onClick={() => {
              // A single-day filter would empty any other month — drop it.
              setDateFilter(undefined);
              setMonthOverride(shiftMonthKey(monthKey, -1));
            }}
            className="flex h-11 w-11 items-center justify-center rounded-full text-ink-soft"
          >
            ‹
          </button>
          <span className="text-md font-medium">{monthLabel}</span>
          <button
            type="button"
            aria-label={tr.list.nextMonth}
            onClick={() => {
              setDateFilter(undefined);
              setMonthOverride(shiftMonthKey(monthKey, 1));
            }}
            className="flex h-11 w-11 items-center justify-center rounded-full text-ink-soft"
          >
            ›
          </button>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={tr.list.searchPlaceholder}
          className="w-full rounded-full border border-grid bg-card px-4 py-2 text-base outline-none placeholder:text-ink-soft/50"
        />
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {dateFilter && (
            <button
              type="button"
              onClick={() => setDateFilter(undefined)}
              className="flex shrink-0 items-center gap-1 rounded-full border border-ballpoint bg-ballpoint/15 px-3 py-1.5 font-mono text-base text-ballpoint"
            >
              {format(parseLocalDate(dateFilter), 'd MMM', { locale: trLocale })}
              <span aria-hidden>✕</span>
            </button>
          )}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label={tr.list.categoryFilter}
            className="shrink-0 rounded-full border border-grid bg-card px-3 py-1.5 text-base text-ink outline-none"
          >
            <option value="all">{tr.common.all}</option>
            {(categories ?? [])
              .filter((c) => !c.isArchived)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emoji} {c.name}
                </option>
              ))}
          </select>
          {(['all', 'gerekli', 'istek', 'bos'] as const).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setNecessityFilter(n)}
              aria-pressed={necessityFilter === n}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-base ${
                necessityFilter === n
                  ? 'border-ballpoint bg-ballpoint/15 font-medium text-ballpoint'
                  : 'border-grid text-ink-soft'
              }`}
            >
              {n === 'all' ? tr.common.all : tr.necessity[n]}
            </button>
          ))}
        </div>
      </div>

      {groups.length === 0 && (
        <p className="mt-8 text-center text-base text-ink-soft">
          {hasAnyThisMonth && filtersActive ? tr.list.noResults : tr.list.empty}
        </p>
      )}

      <div className="mt-2 space-y-4">
        {groups.map(([date, txns]) => (
          <DayGroup
            key={date}
            date={date}
            transactions={txns}
            categoryById={categoryById}
          />
        ))}
      </div>
        </>
      )}
    </div>
  );
}

function DayGroup(props: {
  date: string;
  transactions: Transaction[];
  categoryById: Map<string, Category>;
}) {
  // Day subtotal = income − expenses of the day (right-aligned mono, §9.3).
  const net = props.transactions.reduce(
    (sum, t) => sum + (t.type === 'income' ? t.amountMinor : -t.amountMinor),
    0,
  );
  return (
    <section>
      <div className="flex items-baseline justify-between">
        <h2 className="text-xs font-medium uppercase tracking-wide text-ink-soft">
          {dayHeader(props.date)}
        </h2>
        <span className="font-mono text-xs text-ink-soft">{formatMinor(net)}</span>
      </div>
      <div className="mt-1.5 divide-y divide-grid rounded-card border border-grid bg-card">
        {props.transactions.map((t) => (
          <TransactionRow
            key={t.id}
            transaction={t}
            category={props.categoryById.get(t.categoryId)}
          />
        ))}
      </div>
    </section>
  );
}

function TransactionRow(props: {
  transaction: Transaction;
  category?: Category;
}) {
  const openEdit = useEphemeralStore((s) => s.openEdit);
  const t = props.transaction;
  const label = t.merchant || t.note || props.category?.name || '—';
  return (
    <button
      type="button"
      onClick={() => openEdit(t)}
      className="flex min-h-11 w-full items-center gap-3 px-3 py-2.5 text-left"
    >
      <span className="text-md" aria-hidden>
        {props.category?.emoji ?? '❔'}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-base text-ink">{label}</span>
          {t.necessity && (
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${NECESSITY_DOT[t.necessity]}`}
              role="img"
              aria-label={tr.necessity[t.necessity]}
            />
          )}
        </span>
        {t.note && t.merchant && (
          <span className="block truncate text-xs text-ink-soft">{t.note}</span>
        )}
      </span>
      {/* pisman amounts get the hand-drawn strike (§11.5) */}
      {t.regret === 'pisman' ? (
        <RedPen variant="strike">
          <span className="font-mono text-base text-ink">
            {formatMinor(t.amountMinor)}
          </span>
        </RedPen>
      ) : (
        <span
          className={`font-mono text-base ${
            t.type === 'income' ? 'text-green' : 'text-ink'
          }`}
        >
          {t.type === 'income' ? '+' : ''}
          {formatMinor(t.amountMinor)}
        </span>
      )}
    </button>
  );
}
