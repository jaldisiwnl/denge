import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import { tr as trLocale } from 'date-fns/locale';
import { tr } from '../../i18n/tr';
import { ti } from '../../i18n/interpolate';
import { formatMinor } from '../../lib/money';
import { parseLocalDate, todayISO } from '../../lib/dates';
import { getWeeklyStatus } from '../../db/repo/dashboard';

/**
 * "Bu hafta" — the weekly money view. Built for an irregular weekly
 * allowance world: money in, money out, honest split, last-week compare.
 */
export function WeeklyCard(props: { className?: string }) {
  const week = useLiveQuery(() => getWeeklyStatus(todayISO()));
  if (!week) return null;

  const delta =
    week.prevSpentMinor > 0
      ? Math.round(
          ((week.spentMinor - week.prevSpentMinor) / week.prevSpentMinor) * 100,
        )
      : null;
  const total = week.gerekliMinor + week.istekMinor + week.bosMinor;

  return (
    <section
      className={`rounded-card border border-grid bg-card p-4 ${props.className ?? ''}`}
      aria-label={tr.dashboard.weeklyTitle}
    >
      <div className="flex items-baseline justify-between">
        <h2 className="text-xs font-medium uppercase tracking-wide text-ink-soft">
          {tr.dashboard.weeklyTitle}
        </h2>
        <span className="font-mono text-xs text-ink-soft">
          {format(parseLocalDate(week.weekStart), 'd MMM', { locale: trLocale })} –{' '}
          {format(parseLocalDate(todayISO()), 'd MMM', { locale: trLocale })}
        </span>
      </div>

      <div className="mt-2 flex items-baseline justify-between">
        <span className="text-base text-ink-soft">{tr.dashboard.weeklySpent}</span>
        <span className="font-mono text-xl font-medium">
          {formatMinor(week.spentMinor)}
        </span>
      </div>
      {week.incomeMinor > 0 && (
        <div className="mt-1 flex items-baseline justify-between">
          <span className="text-base text-ink-soft">{tr.dashboard.weeklyIncome}</span>
          <span className="font-mono text-base text-green">
            +{formatMinor(week.incomeMinor)}
          </span>
        </div>
      )}

      {/* bilinç split of the week */}
      {total > 0 && (
        <>
          <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-grid" aria-hidden>
            <div className="bg-green" style={{ width: `${(week.gerekliMinor / total) * 100}%` }} />
            <div className="bg-ballpoint" style={{ width: `${(week.istekMinor / total) * 100}%` }} />
            <div className="bg-redpen" style={{ width: `${(week.bosMinor / total) * 100}%` }} />
          </div>
          <div className="mt-1.5 flex justify-between text-xs">
            <span className="text-green">
              {tr.necessity.gerekli}{' '}
              <span className="font-mono">{formatMinor(week.gerekliMinor)}</span>
            </span>
            <span className="text-ballpoint">
              {tr.necessity.istek}{' '}
              <span className="font-mono">{formatMinor(week.istekMinor)}</span>
            </span>
            <span className="text-redpen">
              {tr.necessity.bos}{' '}
              <span className="font-mono">{formatMinor(week.bosMinor)}</span>
            </span>
          </div>
        </>
      )}

      <p className="mt-3 text-xs text-ink-soft">
        {ti(tr.dashboard.weeklyVsPrev, { amount: formatMinor(week.prevSpentMinor) })}
        {delta !== null && delta !== 0 && (
          <span className={delta > 0 ? 'text-redpen' : 'text-green'}>
            {' · '}
            {ti(delta > 0 ? tr.dashboard.weeklyMore : tr.dashboard.weeklyLess, {
              pct: String(Math.abs(delta)),
            })}
          </span>
        )}
      </p>
      <p className="mt-0.5 text-xs text-ink-soft">
        {ti(tr.dashboard.weeklyDailyAvg, { amount: formatMinor(week.dailyAvgMinor) })}
      </p>
    </section>
  );
}
