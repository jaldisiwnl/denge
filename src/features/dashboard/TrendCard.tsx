import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import { tr as trLocale } from 'date-fns/locale';
import { Bar, BarChart, ResponsiveContainer, XAxis } from 'recharts';
import { tr } from '../../i18n/tr';
import { formatMinor } from '../../lib/money';
import { parseLocalDate, todayISO } from '../../lib/dates';
import { getTrendData } from '../../db/repo/dashboard';

/** 6 aylık eğilim (§9.7.6): total bars with the boş share stacked in red. */
export function TrendCard(props: { className?: string }) {
  const months = useLiveQuery(() => getTrendData(todayISO()));
  if (!months || months.every((m) => m.totalMinor === 0)) return null;

  const data = months.map((m) => ({
    label: format(parseLocalDate(`${m.monthKey}-01`), 'LLL', { locale: trLocale }),
    bos: m.bosMinor / 100,
    rest: (m.totalMinor - m.bosMinor) / 100,
    totalMinor: m.totalMinor,
    bosMinor: m.bosMinor,
  }));

  return (
    <section
      className={`rounded-card border border-grid bg-card p-4 ${props.className ?? ''}`}
      aria-label={tr.dashboard.trendTitle}
    >
      <div className="flex items-baseline justify-between">
        <h2 className="text-xs font-medium uppercase tracking-wide text-ink-soft">
          {tr.dashboard.trendTitle}
        </h2>
        <span className="flex items-center gap-2 text-xs text-ink-soft">
          <span className="h-2 w-2 rounded-sm bg-ballpoint/80" aria-hidden />
          {tr.dashboard.trendTotal}
          <span className="h-2 w-2 rounded-sm bg-redpen" aria-hidden />
          {tr.dashboard.trendBos}
        </span>
      </div>
      <div className="mt-2 h-36">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
            <XAxis dataKey="label" axisLine={false} tickLine={false} />
            <Bar dataKey="bos" stackId="m" className="chart-bar-bos" isAnimationActive={false} />
            <Bar
              dataKey="rest"
              stackId="m"
              className="chart-bar-rest"
              radius={[3, 3, 0, 0]}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {/* Every MoM comparison carries the inflation caveat (§9.11.9) */}
      <p className="mt-2 text-xs text-ink-soft">{tr.dashboard.inflationNote}</p>
      {/* Accessible companion table (§15) */}
      <ul className="sr-only">
        {data.map((m) => (
          <li key={m.label}>
            {m.label}: {tr.dashboard.trendTotal} {formatMinor(m.totalMinor)},{' '}
            {tr.dashboard.trendBos} {formatMinor(m.bosMinor)}
          </li>
        ))}
      </ul>
    </section>
  );
}
