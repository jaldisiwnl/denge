import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { tr } from '../../i18n/tr';
import { ti } from '../../i18n/interpolate';
import { useEphemeralStore } from '../../app/ui';
import { todayISO } from '../../lib/dates';
import { dismissGap, getLapseState } from '../../db/repo/lapse';
import { BackfillStepper } from './BackfillStepper';

/**
 * Boşluk affı card (§9.15): warm, guilt-free, always above other pending
 * cards. No red anywhere here — a door, not a wall (P2, §11.5).
 */
export function LapseCard(props: { className?: string }) {
  const openQuickAdd = useEphemeralStore((s) => s.openQuickAdd);
  const [filling, setFilling] = useState(false);
  const state = useLiveQuery(() => getLapseState(todayISO()));

  const gap = state?.activeGap;
  if (!gap) return null;

  async function dismiss() {
    await dismissGap(gap!);
    openQuickAdd(); // straight into today's entry — no lecture (§9.15)
  }

  return (
    <section
      className={`rounded-card border border-grid bg-card p-4 ${props.className ?? ''}`}
    >
      <p className="text-base text-ink">
        {ti(tr.recovery.lapseTitle, { days: String(gap.dayCount) })}
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => setFilling(true)}
          className="min-h-11 flex-1 rounded-full bg-ballpoint text-base font-medium text-white"
        >
          {tr.recovery.fill}
        </button>
        <button
          type="button"
          onClick={() => void dismiss()}
          className="min-h-11 flex-1 rounded-full border border-grid text-base text-ink-soft"
        >
          {tr.recovery.dismiss}
        </button>
      </div>
      {filling && <BackfillStepper gap={gap} onClose={() => setFilling(false)} />}
    </section>
  );
}
