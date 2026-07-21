import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { tr } from '../../i18n/tr';
import { ti } from '../../i18n/interpolate';
import { formatMinor } from '../../lib/money';
import { getMonthKey } from '../../lib/fiscal';
import { todayISO } from '../../lib/dates';
import { getSettings } from '../../db/repo/settings';
import { getForgoneStats } from '../../db/repo/wishlist';

/**
 * "Vazgeçtiklerin" (v1.4) — money not spent has value too. Celebrates
 * cooldown resistance; leads with this month, all-time supports. Hidden
 * until the first vazgeç ever. Tap → Soğuma segment.
 */
export function ForgoneCard(props: { className?: string }) {
  const navigate = useNavigate();
  const stats = useLiveQuery(async () => {
    const settings = await getSettings();
    if (!settings) return null;
    return getForgoneStats(getMonthKey(todayISO(), settings.monthStartDay), settings.monthStartDay);
  });
  if (!stats || stats.allTimeMinor === 0) return null;

  const leadThisMonth = stats.thisMonthMinor > 0;
  const heroMinor = leadThisMonth ? stats.thisMonthMinor : stats.allTimeMinor;
  const heroLabel = leadThisMonth
    ? tr.forgone.thisMonthLabel
    : tr.forgone.allTimeLabel;

  return (
    <button
      type="button"
      onClick={() => navigate('/islemler', { state: { segment: 'soguma' } })}
      className={`w-full rounded-card border border-grid bg-card p-4 text-left ${props.className ?? ''}`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">
        💪 {tr.forgone.title}
      </p>
      <p className="mt-1 text-base text-ink-soft">{heroLabel}</p>
      <p className="mt-0.5 font-mono text-2xl font-medium text-green">
        <span className="bg-highlight/50 box-decoration-clone px-1">
          {formatMinor(heroMinor)}
        </span>
      </p>
      <p className="mt-2 text-xs text-ink-soft">
        {leadThisMonth && (
          <>{ti(tr.forgone.supportAllTime, { amount: formatMinor(stats.allTimeMinor) })} · </>
        )}
        {ti(tr.forgone.inKumbara, { amount: formatMinor(stats.inKumbaraMinor) })}
      </p>
      <p className="mt-1 text-xs text-ink-soft">{tr.forgone.celebrate}</p>
    </button>
  );
}
