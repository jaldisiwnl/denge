import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { tr as trLocale } from 'date-fns/locale';
import { tr } from '../../i18n/tr';
import { ti } from '../../i18n/interpolate';
import { formatMinor } from '../../lib/money';
import { parseLocalDate, todayISO } from '../../lib/dates';
import { getHeatmapData, type HeatmapDay } from '../../db/repo/dashboard';

const CELL = 16;
const GAP = 4;
const STEP = CELL + GAP;

function isoWeekday(date: string): number {
  return ((parseLocalDate(date).getDay() + 6) % 7) + 1; // 1 Mon – 7 Sun
}

/** 5 intensity steps of ballpoint (§9.7.7): 0 = empty, then 4 quartiles. */
function intensity(spent: number, max: number): number {
  if (spent === 0 || max === 0) return 0;
  return Math.min(4, Math.ceil((spent / max) * 4));
}

const OPACITY = [0, 0.2, 0.45, 0.7, 1] as const;

/** Harcama takvimi (§9.7.7) — custom SVG heatmap of the fiscal month. */
export function HeatmapCard() {
  const navigate = useNavigate();
  const data = useLiveQuery(() => getHeatmapData(todayISO()));
  if (!data || data.days.length === 0) return null;

  // Grid layout: columns = ISO weekdays, a new row after each Sunday.
  let row = 0;
  const cells: (HeatmapDay & { col: number; row: number })[] = data.days.map(
    (d, i) => {
      const col = isoWeekday(d.date) - 1;
      if (i > 0 && col === 0) row++;
      return { ...d, col, row };
    },
  );
  const rows = row + 1;
  const width = 7 * STEP - GAP;
  const height = rows * STEP - GAP;

  return (
    <section
      className="rounded-card border border-grid bg-card p-4"
      aria-label={tr.dashboard.heatmapTitle}
    >
      <h2 className="text-xs font-medium uppercase tracking-wide text-ink-soft">
        {tr.dashboard.heatmapTitle}
      </h2>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="mt-2 w-full"
        role="img"
        aria-label={tr.dashboard.heatmapTitle}
      >
        {cells.map((d) => {
          const x = d.col * STEP;
          const y = d.row * STEP;
          const step = intensity(d.spentMinor, data.maxSpentMinor);
          const open = () =>
            !d.isFuture && navigate('/islemler', { state: { date: d.date } });
          return (
            <g
              key={d.date}
              // Backfilled-lapse days render at 60% opacity (§9.7.7)
              opacity={d.isFuture ? 0.35 : d.isBackfilled ? 0.6 : 1}
              onClick={open}
              // keyboard access (P7 a11y): Enter/Space opens the day
              role={d.isFuture ? undefined : 'button'}
              tabIndex={d.isFuture ? undefined : 0}
              aria-label={ti(tr.dashboard.heatmapDayAria, {
                date: d.date,
                amount: formatMinor(d.spentMinor),
              })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  open();
                }
              }}
              className={d.isFuture ? '' : 'heatmap-cell cursor-pointer'}
            >
              <rect
                x={x}
                y={y}
                width={CELL}
                height={CELL}
                rx={3}
                fill={step === 0 ? 'var(--grid)' : 'var(--ballpoint)'}
                fillOpacity={step === 0 ? 0.6 : OPACITY[step]}
              >
                <title>
                  {ti(tr.dashboard.heatmapDayAria, {
                    date: format(parseLocalDate(d.date), 'd MMMM', { locale: trLocale }),
                    amount: formatMinor(d.spentMinor),
                  })}
                </title>
              </rect>
              {/* tiny red corner tick on days containing bos spending */}
              {d.hasBos && (
                <path
                  d={`M ${x + CELL - 5} ${y} L ${x + CELL} ${y} L ${x + CELL} ${y + 5} Z`}
                  fill="var(--redpen)"
                />
              )}
            </g>
          );
        })}
      </svg>
      {/* Accessible companion list (§15) — days with spending only */}
      <ul className="sr-only">
        {cells
          .filter((d) => d.spentMinor > 0)
          .map((d) => (
            <li key={d.date}>
              {ti(tr.dashboard.heatmapDayAria, {
                date: d.date,
                amount: formatMinor(d.spentMinor),
              })}
            </li>
          ))}
      </ul>
    </section>
  );
}
