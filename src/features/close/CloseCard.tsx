import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { tr } from '../../i18n/tr';
import { ti } from '../../i18n/interpolate';
import { todayISO } from '../../lib/dates';
import { getSettings } from '../../db/repo/settings';
import { closableMonth } from '../../db/repo/close';
import { CloseWizard, monthLabel } from './CloseWizard';

/** "Ayı kapat" dashboard card (§9.12). */
export function CloseCard() {
  const [open, setOpen] = useState(false);
  const monthKey = useLiveQuery(async () => {
    const settings = await getSettings();
    if (!settings) return null;
    return closableMonth(todayISO(), settings.monthStartDay);
  });
  if (!monthKey) return null;

  return (
    <section className="rounded-card border border-grid bg-card p-4">
      <p className="text-base text-ink">
        📕 {ti(tr.close.cardLine, { month: monthLabel(monthKey) })}
      </p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 min-h-11 w-full rounded-full bg-ballpoint text-base font-medium text-white"
      >
        {tr.close.cardCta}
      </button>
      {open && <CloseWizard monthKey={monthKey} onClose={() => setOpen(false)} />}
    </section>
  );
}
