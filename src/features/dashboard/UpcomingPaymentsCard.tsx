import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import { tr as trLocale } from 'date-fns/locale';
import { tr } from '../../i18n/tr';
import { ti } from '../../i18n/interpolate';
import { useEphemeralStore } from '../../app/ui';
import { formatMinor } from '../../lib/money';
import { parseLocalDate, todayISO } from '../../lib/dates';
import { db } from '../../db/db';
import { listUpcomingObligations, payObligation } from '../../db/repo/obligations';

const KIND_EMOJI: Record<string, string> = { kart: '💳', borc: '🤝', planli: '📅' };

/** "Yaklaşan ödemeler" reminder (v1.3): obligations due within ~7 days. */
export function UpcomingPaymentsCard(props: { className?: string }) {
  const showToast = useEphemeralStore((s) => s.showToast);
  const items = useLiveQuery(() => listUpcomingObligations(todayISO(), 7));
  if (!items?.length) return null;

  function whenText(date: string): string {
    const today = todayISO();
    if (date < today) return tr.payments.overdue;
    if (date === today) return tr.payments.dueToday;
    const days = Math.round(
      (parseLocalDate(date).getTime() - parseLocalDate(today).getTime()) / 86_400_000,
    );
    return ti(tr.payments.dueInDays, { n: String(days) });
  }

  async function pay(sourceId: string, date: string) {
    const ob = await db.obligations.get(sourceId);
    if (!ob) return;
    await payObligation(ob, { dueDate: ob.kind === 'planli' ? ob.dueDate : date });
    showToast(
      <span>
        {tr.payments.pay}: <span className="font-mono">{formatMinor(ob.amountMinor)}</span>
        {' · '}
        {ob.title}
      </span>,
    );
  }

  return (
    <section
      className={`rounded-card border border-grid bg-card p-4 ${props.className ?? ''}`}
    >
      <h2 className="text-xs font-medium uppercase tracking-wide text-ink-soft">
        {tr.payments.upcomingTitle}
      </h2>
      <div className="mt-2 space-y-2">
        {items.map((item) => {
          const overdue = item.date < todayISO();
          return (
            <div key={`${item.sourceId}-${item.date}`} className="flex items-center gap-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base">
                  {KIND_EMOJI[item.kind] ?? '•'} {item.title}
                </span>
                <span className={`block text-xs ${overdue ? 'text-redpen' : 'text-ink-soft'}`}>
                  {format(parseLocalDate(item.date), 'd MMM', { locale: trLocale })} ·{' '}
                  {whenText(item.date)}
                </span>
              </span>
              <span className="shrink-0 font-mono text-base">
                {formatMinor(item.amountMinor)}
              </span>
              <button
                type="button"
                onClick={() => void pay(item.sourceId, item.date)}
                className="shrink-0 rounded-full bg-ballpoint px-4 py-1.5 text-base font-medium text-white"
              >
                {item.kind === 'planli' ? tr.payments.markPaid : tr.payments.pay}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
