import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import { tr as trLocale } from 'date-fns/locale';
import {
  Bar,
  BarChart,
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
} from 'recharts';
import { Sheet } from '../../components/Sheet';
import { RedPen } from '../../components/RedPen';
import { tr } from '../../i18n/tr';
import { ti } from '../../i18n/interpolate';
import { formatMinor } from '../../lib/money';
import { getMonthKey, shiftMonthKey } from '../../lib/fiscal';
import { parseLocalDate, todayISO } from '../../lib/dates';
import { durtuBand } from '../../lib/stats';
import { getSettings } from '../../db/repo/settings';
import { listAllCategories } from '../../db/repo/categories';
import { listCloses } from '../../db/repo/close';
import {
  getBosTrend,
  getDurtuSeries,
  getHonesty,
  getMonthDeltas,
  getMoodImpact,
  getRegretChampions,
  getReviewHistory,
  getSavingsLine,
  getTopMerchants,
  getWeekdaySpend,
} from '../../db/repo/insights';
import type { Category } from '../../db/types';

function label(monthKey: string, pattern = 'LLL'): string {
  return format(parseLocalDate(`${monthKey}-01`), pattern, { locale: trLocale });
}

export function InsightsScreen() {
  const settings = useLiveQuery(getSettings);
  const startDay = settings?.monthStartDay ?? 1;
  const currentKey = getMonthKey(todayISO(), startDay);
  const [monthOverride, setMonthOverride] = useState<string>();
  const monthKey = monthOverride ?? currentKey;
  const [historyOpen, setHistoryOpen] = useState(false);

  const categories = useLiveQuery(listAllCategories);
  const categoryById = useMemo(
    () => new Map((categories ?? []).map((c) => [c.id, c])),
    [categories],
  );

  const data = useLiveQuery(async () => {
    const [durtu, savings, bosTrend, honesty, mood, weekday, champions, merchants, deltas, closes] =
      await Promise.all([
        getDurtuSeries(monthKey, startDay, 6),
        getSavingsLine(monthKey, startDay, 12),
        getBosTrend(monthKey, startDay, 6),
        getHonesty(monthKey, startDay),
        getMoodImpact(),
        getWeekdaySpend(monthKey, startDay),
        getRegretChampions(monthKey, startDay),
        getTopMerchants(monthKey, startDay),
        getMonthDeltas(monthKey, startDay),
        listCloses(),
      ]);
    return { durtu, savings, bosTrend, honesty, mood, weekday, champions, merchants, deltas, closes };
  }, [monthKey, startDay]);

  if (!data) return null;

  const currentIndex = data.durtu[data.durtu.length - 1]?.index ?? null;
  const anyCard =
    currentIndex !== null ||
    data.savings ||
    data.honesty ||
    data.mood ||
    data.weekday ||
    data.champions.length > 0 ||
    data.merchants.length > 0 ||
    data.deltas.length > 0;

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-semibold">{tr.tabs.icgoru}</h1>

      {/* month selector */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label={tr.list.prevMonth}
          onClick={() => setMonthOverride(shiftMonthKey(monthKey, -1))}
          className="flex h-11 w-11 items-center justify-center rounded-full text-ink-soft"
        >
          ‹
        </button>
        <span className="text-md font-medium">{label(monthKey, 'LLLL yyyy')}</span>
        <button
          type="button"
          aria-label={tr.list.nextMonth}
          onClick={() => setMonthOverride(shiftMonthKey(monthKey, 1))}
          className="flex h-11 w-11 items-center justify-center rounded-full text-ink-soft"
        >
          ›
        </button>
      </div>

      {!anyCard && <p className="text-base text-ink-soft">{tr.insights.empty}</p>}

      {/* 1 — Dürtü Endeksi dial + sparkline */}
      {currentIndex !== null && <DurtuCard index={currentIndex} series={data.durtu} />}

      {/* 2 — Birikim çizgisi (12-month cumulative) */}
      {data.savings && data.savings.points.some((p) => p.cumulativeMinor > 0) && (
        <section className="rounded-card border border-grid bg-card p-4" aria-label={tr.insights.savingsLineTitle}>
          <h2 className="text-xs font-medium uppercase tracking-wide text-ink-soft">
            {tr.insights.savingsLineTitle}
          </h2>
          <div className="mt-2 h-32">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data.savings.points.map((p) => ({
                  name: label(p.monthKey),
                  value: p.cumulativeMinor / 100,
                  completed: data.savings!.completionMonths.has(p.monthKey),
                }))}
                margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
              >
                <XAxis dataKey="name" axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="var(--green)"
                  strokeWidth={2}
                  isAnimationActive={false}
                  dot={(p: { cx?: number; cy?: number; payload?: { completed?: boolean }; index?: number }) =>
                    p.payload?.completed ? (
                      <circle key={p.index} cx={p.cx} cy={p.cy} r={5} fill="var(--highlight)" stroke="var(--ink)" />
                    ) : (
                      <circle key={p.index} cx={p.cx} cy={p.cy} r={0} fill="none" />
                    )
                  }
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-1 text-right font-mono text-base">
            {formatMinor(data.savings.points[data.savings.points.length - 1]!.cumulativeMinor)}
          </p>
        </section>
      )}

      {/* 3 — Boş oranı trendi */}
      {data.bosTrend.some((m) => m.bosRate !== null && m.bosRate > 0) && (
        <section className="rounded-card border border-grid bg-card p-4" aria-label={tr.insights.bosTrendTitle}>
          <h2 className="text-xs font-medium uppercase tracking-wide text-ink-soft">
            {tr.insights.bosTrendTitle}
          </h2>
          <div className="mt-2 h-28">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data.bosTrend.map((m) => ({
                  name: label(m.monthKey),
                  value: m.bosRate !== null ? Math.round(m.bosRate * 100) : null,
                }))}
                margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
              >
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="var(--redpen)"
                  strokeWidth={2}
                  isAnimationActive={false}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-xs text-ink-soft">{tr.insights.inflationNote}</p>
        </section>
      )}

      {/* 4 — Dürüstlük */}
      {data.honesty && (
        <Card title={tr.insights.honestyTitle}>
          <p className="text-base">
            {data.honesty.istekToBosCount > 0
              ? ti(tr.insights.honestyLine, {
                  pct: String(
                    Math.round(
                      (data.honesty.istekToBosCount / data.honesty.originalIstekCount) * 100,
                    ),
                  ),
                })
              : tr.insights.honestyNone}
          </p>
        </Card>
      )}

      {/* 5 — Ruh hali etkisi (all-time) */}
      {data.mood && (
        <Card title={tr.insights.moodTitle}>
          {(() => {
            const worst = data.mood!.rows[0]!;
            const overall = data.mood!.overallBadShare;
            const diff =
              overall > 0 ? Math.round(((worst.badShare - overall) / overall) * 100) : 0;
            return diff > 0 ? (
              <p className="text-base">
                {ti(tr.insights.moodHigher, {
                  mood: tr.moods[worst.mood],
                  diff: String(diff),
                })}
              </p>
            ) : null;
          })()}
          <ul className="mt-2 space-y-1">
            {data.mood.rows.map((r) => (
              <li key={r.mood} className="flex items-baseline justify-between text-xs">
                <span>
                  {ti(tr.insights.moodRow, {
                    mood: tr.moods[r.mood],
                    pct: String(Math.round(r.badShare * 100)),
                    overall: String(Math.round(data.mood!.overallBadShare * 100)),
                  })}
                </span>
                <span className="font-mono text-ink-soft">
                  {ti(tr.insights.sampleSize, { n: String(r.n) })}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* 6 — Haftanın günleri */}
      {data.weekday && (
        <section className="rounded-card border border-grid bg-card p-4" aria-label={tr.insights.weekdayTitle}>
          <h2 className="text-xs font-medium uppercase tracking-wide text-ink-soft">
            {tr.insights.weekdayTitle}
          </h2>
          <div className="mt-2 h-28">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.weekday.map((d) => ({
                  name: tr.recurring.weekdaysShort[d.weekday - 1],
                  value: d.avgMinor / 100,
                }))}
                margin={{ top: 4, right: 0, left: 0, bottom: 0 }}
              >
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <Bar dataKey="value" className="chart-bar-rest" radius={[3, 3, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {(() => {
            const worst = [...data.weekday!].sort((a, b) => b.avgMinor - a.avgMinor)[0]!;
            return worst.avgMinor > 0 ? (
              <p className="mt-1 text-xs text-ink-soft">
                {ti(tr.insights.weekdayWorst, {
                  day: tr.insights.weekdaysLong[worst.weekday - 1]!,
                })}
              </p>
            ) : null;
          })()}
        </section>
      )}

      {/* 7 — Pişmanlık şampiyonları */}
      {data.champions.length > 0 && (
        <Card title={tr.insights.regretChampionsTitle}>
          <ul className="space-y-1.5">
            {data.champions.map((c) => (
              <li key={c.categoryId} className="flex items-baseline justify-between text-base">
                <span className="min-w-0 truncate">
                  {categoryById.get(c.categoryId)?.emoji}{' '}
                  {categoryById.get(c.categoryId)?.name}
                </span>
                <span className="font-mono text-redpen">
                  {ti(tr.insights.championRow, {
                    pct: String(Math.round(c.regretRate * 100)),
                  })}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* 8 — Sık mekânlar */}
      {data.merchants.length > 0 && (
        <Card title={tr.insights.merchantsTitle}>
          <ul className="space-y-1.5">
            {data.merchants.map((m) => (
              <li key={m.merchant} className="flex items-baseline justify-between text-base">
                <span className="min-w-0 truncate">{m.merchant}</span>
                <span className="font-mono">{formatMinor(m.totalMinor)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* 9 — Ay farkları + inflation footnote */}
      {data.deltas.length > 0 && (
        <Card title={tr.insights.deltasTitle}>
          <ul className="space-y-1.5">
            {data.deltas.map((d) => (
              <li key={d.categoryId} className="flex items-baseline justify-between text-base">
                <span className="min-w-0 truncate">
                  {categoryById.get(d.categoryId)?.emoji}{' '}
                  {categoryById.get(d.categoryId)?.name}
                </span>
                <span
                  className={`font-mono ${d.deltaMinor > 0 ? 'text-redpen' : 'text-green'}`}
                >
                  {d.deltaMinor > 0 ? '+' : ''}
                  {formatMinor(d.deltaMinor)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-ink-soft">{tr.insights.inflationNote}</p>
        </Card>
      )}

      {/* Arşiv (§9.11): closed months with grade strip */}
      {data.closes.length > 0 && (
        <Card title={tr.insights.archiveTitle}>
          <div className="divide-y divide-grid">
            {data.closes.map((c) => (
              <div key={c.id} className="flex items-center gap-3 py-2">
                <span
                  className={`font-display text-xl font-bold ${
                    c.grade === 'A' || c.grade === 'B'
                      ? 'text-green'
                      : c.grade === 'C'
                        ? 'text-ballpoint'
                        : 'text-redpen'
                  }`}
                >
                  {c.grade}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-base">{label(c.monthKey, 'LLLL yyyy')}</span>
                  {c.note && (
                    <span className="block truncate text-xs text-ink-soft">“{c.note}”</span>
                  )}
                </span>
                <span className="font-mono text-xs text-ink-soft">{c.score}/100</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <button
        type="button"
        onClick={() => setHistoryOpen(true)}
        className="text-base font-medium text-ballpoint"
      >
        {tr.insights.reviewHistoryTitle} ›
      </button>

      {historyOpen && (
        <ReviewHistorySheet
          categoryById={categoryById}
          onClose={() => setHistoryOpen(false)}
        />
      )}
    </div>
  );
}

function Card(props: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-card border border-grid bg-card p-4" aria-label={props.title}>
      <h2 className="text-xs font-medium uppercase tracking-wide text-ink-soft">
        {props.title}
      </h2>
      <div className="mt-2">{props.children}</div>
    </section>
  );
}

/** Semicircle gauge for the Dürtü Endeksi (§9.11.1). */
function DurtuCard(props: {
  index: number;
  series: { monthKey: string; index: number | null }[];
}) {
  const band = durtuBand(props.index);
  const bandColor =
    band === 'sakin' ? 'var(--green)' : band === 'dalgali' ? 'var(--ballpoint)' : 'var(--redpen)';

  return (
    <section className="rounded-card border border-grid bg-card p-4" aria-label={tr.insights.durtuTitle}>
      <h2 className="text-xs font-medium uppercase tracking-wide text-ink-soft">
        {tr.insights.durtuTitle}
      </h2>
      <div className="mx-auto mt-2 w-40">
        <svg viewBox="0 0 100 58" aria-hidden>
          <path
            d="M 8 52 A 42 42 0 0 1 92 52"
            fill="none"
            stroke="var(--grid)"
            strokeWidth="8"
            strokeLinecap="round"
          />
          <path
            d="M 8 52 A 42 42 0 0 1 92 52"
            fill="none"
            stroke={bandColor}
            strokeWidth="8"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray={`${props.index} 100`}
          />
          <text
            x="50"
            y="46"
            textAnchor="middle"
            className="font-mono"
            fontSize="20"
            fontWeight="600"
            fill="var(--ink)"
          >
            {props.index}
          </text>
        </svg>
        <p className="text-center text-base font-medium" style={{ color: bandColor }}>
          {tr.insights.bands[band]}
        </p>
      </div>
      {/* 6-month mini bars */}
      <div className="mt-2 flex items-end justify-center gap-1.5" aria-hidden>
        {props.series.map((m) => (
          <div
            key={m.monthKey}
            className="w-4 rounded-t bg-ballpoint/60"
            style={{ height: `${4 + ((m.index ?? 0) / 100) * 28}px` }}
            title={`${label(m.monthKey)}: ${m.index ?? '—'}`}
          />
        ))}
      </div>
    </section>
  );
}

function ReviewHistorySheet(props: {
  categoryById: Map<string, Category>;
  onClose: () => void;
}) {
  const items = useLiveQuery(() => getReviewHistory());
  return (
    <Sheet onClose={props.onClose} full>
      <h2 className="text-md font-semibold">{tr.insights.reviewHistoryTitle}</h2>
      <div className="mt-3 divide-y divide-grid rounded-card border border-grid bg-card">
        {(items ?? []).map((t) => (
          <div key={t.id} className="flex min-h-11 items-center gap-2 px-3 py-2">
            <span aria-hidden>{props.categoryById.get(t.categoryId)?.emoji}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-base">
                {t.merchant || t.note || props.categoryById.get(t.categoryId)?.name}
              </span>
              <span className="block text-xs text-ink-soft">
                {format(parseLocalDate(t.date), 'd MMM yyyy', { locale: trLocale })}
              </span>
            </span>
            {t.regret === 'pisman' ? (
              <RedPen variant="strike">
                <span className="font-mono text-base">{formatMinor(t.amountMinor)}</span>
              </RedPen>
            ) : (
              <span className="font-mono text-base">{formatMinor(t.amountMinor)}</span>
            )}
            <span className="text-base" aria-label={t.regret}>
              {t.regret === 'degdi' ? '👍' : t.regret === 'eh' ? '😐' : '👎'}
            </span>
          </div>
        ))}
      </div>
    </Sheet>
  );
}
