import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import { tr as trLocale } from 'date-fns/locale';
import { tr } from '../../i18n/tr';
import { formatMinor } from '../../lib/money';
import { parseLocalDate, todayISO } from '../../lib/dates';
import {
  confirmPending,
  listPendingConfirmations,
  skipPending,
} from '../../db/repo/recurring';

/** Non-auto rules awaiting confirmation — `Onayla | Bu ay atla` (§9.6). */
export function PendingRecurringCards(props: { className?: string }) {
  const pending = useLiveQuery(() => listPendingConfirmations(todayISO()));
  if (!pending?.length) return null;

  return (
    <section className={`space-y-2 ${props.className ?? ''}`}>
      <h2 className="text-xs font-medium uppercase tracking-wide text-ink-soft">
        {tr.recurring.pendingTitle}
      </h2>
      {pending.map(({ rule, dueDate }) => (
        <div
          key={`${rule.id}-${dueDate}`}
          className="rounded-card border border-grid bg-card p-4"
        >
          <div className="flex items-baseline justify-between gap-2">
            <span className="min-w-0 truncate text-base">{rule.name}</span>
            <span className="shrink-0 font-mono text-base">
              {formatMinor(rule.amountMinor)}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-ink-soft">
            {format(parseLocalDate(dueDate), 'd MMMM EEEE', { locale: trLocale })}
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => void confirmPending(rule, dueDate)}
              className="min-h-11 flex-1 rounded-full bg-ballpoint text-base font-medium text-white"
            >
              {tr.recurring.approve}
            </button>
            <button
              type="button"
              onClick={() => void skipPending(rule, dueDate)}
              className="min-h-11 flex-1 rounded-full border border-grid text-base text-ink-soft"
            >
              {tr.recurring.skipMonth}
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}
