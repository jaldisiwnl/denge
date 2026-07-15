import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import { tr as trLocale } from 'date-fns/locale';
import { tr } from '../../i18n/tr';
import { RedPen } from '../../components/RedPen';
import { useCountUp } from '../../components/useCountUp';
import { formatMinor } from '../../lib/money';
import { parseLocalDate, todayISO } from '../../lib/dates';
import { getHeroData } from '../../db/repo/dashboard';

/** Dashboard hero (§9.7.1): Kalan, Güne düşen, pace bar, grid texture. */
export function HeroCard(props: { className?: string }) {
  const hero = useLiveQuery(() => getHeroData(todayISO()));
  if (!hero) return null;

  const monthLabel = format(parseLocalDate(`${hero.monthKey}-01`), 'LLLL', {
    locale: trLocale,
  });
  const negative = hero.availableMinor < 0;
  const spentRatio =
    hero.budgetTotalMinor > 0
      ? Math.min(1, hero.spentTotalMinor / hero.budgetTotalMinor)
      : 0;
  const paceRatio =
    hero.monthLength > 0 ? hero.elapsedDays / hero.monthLength : 0;

  return (
    <section
      className={`paper-grid rounded-card border border-grid bg-card p-4 ${props.className ?? ''}`}
    >
      <div className="flex items-baseline justify-between">
        <span className="font-display text-md font-semibold">{monthLabel}</span>
        <span className="text-xs text-ink-soft">{tr.dashboard.kalan}</span>
      </div>
      <p className="mt-1 text-center">
        {negative ? (
          <RedPen variant="circle">
            <AmountCountUp minor={hero.availableMinor} />
          </RedPen>
        ) : (
          <AmountCountUp minor={hero.availableMinor} />
        )}
      </p>
      <p className="mt-1 text-center text-base text-ink-soft">
        {tr.dashboard.perDay}{' '}
        <span className="font-mono">{formatMinor(hero.perDayMinor)}</span>
      </p>
      {/* Pace bar: fill = spent ratio; tick = elapsed-time ratio (§9.7.1) */}
      {hero.budgetTotalMinor > 0 && (
        <div className="relative mt-3 h-1.5 overflow-visible rounded-full bg-grid">
          <div
            className={`h-full rounded-full ${
              spentRatio > paceRatio ? 'bg-redpen' : 'bg-ballpoint'
            }`}
            style={{ width: `${spentRatio * 100}%` }}
          />
          <div
            className="absolute -top-0.5 h-2.5 w-0.5 rounded bg-ink"
            style={{ left: `${paceRatio * 100}%` }}
            aria-hidden
          />
        </div>
      )}
    </section>
  );
}

function AmountCountUp(props: { minor: number }) {
  const value = useCountUp(props.minor);
  return (
    <span className="font-mono text-hero font-medium text-ink">
      {formatMinor(value)}
    </span>
  );
}
