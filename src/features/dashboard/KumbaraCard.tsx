import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { tr } from '../../i18n/tr';
import { ti } from '../../i18n/interpolate';
import { formatMinor } from '../../lib/money';
import { getMonthKey } from '../../lib/fiscal';
import { todayISO } from '../../lib/dates';
import { getSettings } from '../../db/repo/settings';
import {
  cumulativeByMonth,
  savedInMonthMinor,
  totalSavedMinor,
} from '../../db/repo/savings';

/**
 * Dashboard Kumbara card (§9.7.3): hidden until the first SavingsEntry —
 * before that a slim "Kumbarayı başlat" CTA. Tap → /butce Kumbara segment.
 */
export function KumbaraCard() {
  const navigate = useNavigate();

  const data = useLiveQuery(async () => {
    const settings = await getSettings();
    if (!settings) return null;
    const monthKey = getMonthKey(todayISO(), settings.monthStartDay);
    const [total, thisMonth, series] = await Promise.all([
      totalSavedMinor(),
      savedInMonthMinor(monthKey, settings.monthStartDay),
      cumulativeByMonth(monthKey, settings.monthStartDay, 6),
    ]);
    return { total, thisMonth, series };
  });
  if (!data) return null;

  const goKumbara = () =>
    navigate('/butce', { state: { segment: 'kumbara' } });

  const hasEntries = data.series.some((p) => p.cumulativeMinor !== 0) || data.total !== 0;
  if (!hasEntries) {
    return (
      <button
        type="button"
        onClick={goKumbara}
        className="w-full rounded-card border border-dashed border-grid bg-card px-4 py-3 text-left text-base text-ink-soft"
      >
        🏦 {tr.kumbara.startCta}
      </button>
    );
  }

  // Sparkline: 6-month cumulative savings (the growing number).
  const max = Math.max(...data.series.map((p) => p.cumulativeMinor), 1);
  const points = data.series
    .map((p, i) => {
      const x = (i / (data.series.length - 1)) * 100;
      const y = 28 - (p.cumulativeMinor / max) * 24;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <button
      type="button"
      onClick={goKumbara}
      className="w-full rounded-card border border-grid bg-card p-4 text-left"
    >
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">
            🏦 {tr.kumbara.totalSaved}
          </p>
          <p className="mt-1 font-mono text-2xl font-medium text-ink">
            {formatMinor(data.total)}
          </p>
          {data.thisMonth > 0 && (
            <p className="mt-0.5 text-xs text-green">
              {ti(tr.kumbara.thisMonth, { amount: formatMinor(data.thisMonth) })}
            </p>
          )}
        </div>
        <svg viewBox="0 0 100 32" className="h-10 w-28 shrink-0" aria-hidden>
          <polyline
            points={points}
            fill="none"
            stroke="var(--green)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
    </button>
  );
}
