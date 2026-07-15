import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { tr } from '../../i18n/tr';
import { formatCompactMinor, formatMinor } from '../../lib/money';
import { todayISO } from '../../lib/dates';
import { getDonutData } from '../../db/repo/dashboard';

/** Kategori dağılımı (§9.7.5): top 6 + Diğer; tap slice → filtered list. */
export function DonutCard(props: { className?: string }) {
  const navigate = useNavigate();
  const data = useLiveQuery(() => getDonutData(todayISO(), tr.dashboard.donutOther));
  if (!data || data.totalMinor === 0) return null;

  const chartData = data.slices.map((s) => ({ ...s, value: s.amountMinor }));

  return (
    <section
      className={`rounded-card border border-grid bg-card p-4 ${props.className ?? ''}`}
      aria-label={tr.dashboard.donutTitle}
    >
      <h2 className="text-xs font-medium uppercase tracking-wide text-ink-soft">
        {tr.dashboard.donutTitle}
      </h2>
      <div className="relative mx-auto mt-2 h-44 w-44">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              innerRadius="62%"
              outerRadius="100%"
              strokeWidth={0}
              isAnimationActive={false}
            >
              {chartData.map((s) => (
                <Cell
                  key={s.name}
                  fill={s.color}
                  className="cursor-pointer"
                  onClick={() =>
                    s.categoryId &&
                    navigate('/islemler', { state: { categoryId: s.categoryId } })
                  }
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="font-mono text-md font-medium text-ink">
            {formatCompactMinor(data.totalMinor)}
          </span>
        </div>
      </div>
      {/* Accessible companion list (§15) */}
      <ul className="mt-3 space-y-1">
        {data.slices.map((s) => (
          <li key={s.name} className="flex items-center gap-2 text-xs">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: s.color }}
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate text-ink">
              {s.emoji} {s.name}
            </span>
            <span className="font-mono text-ink-soft">
              {formatMinor(s.amountMinor)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
