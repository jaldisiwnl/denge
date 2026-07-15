import { useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { tr } from '../../i18n/tr';
import { ti } from '../../i18n/interpolate';
import { useEphemeralStore } from '../../app/ui';
import { STREAK_MILESTONES } from '../../lib/streaks';
import { addDaysISO, todayISO } from '../../lib/dates';
import { getLapseState } from '../../db/repo/lapse';
import { hasFlag, setFlag } from '../../db/repo/uiFlags';

/** Streak card with pause state (§9.7.4) + milestone toast (§8.5). */
export function StreakCard() {
  const showToast = useEphemeralStore((s) => s.showToast);
  const state = useLiveQuery(() => getLapseState(todayISO()));

  const current = state?.currentStreak ?? 0;
  const paused = Boolean(state?.activeGap);

  // Milestone toast fires once per (milestone, streak-start) pair.
  useEffect(() => {
    if (!state || paused) return;
    if (!(STREAK_MILESTONES as readonly number[]).includes(current)) return;
    const streakStart = addDaysISO(todayISO(), -(current - 1));
    const key = `streakCelebrated:${current}@${streakStart}`;
    void hasFlag(key).then((seen) => {
      if (seen) return;
      void setFlag(key);
      showToast(ti(tr.dashboard.streakMilestone, { days: String(current) }), {
        highlight: true,
      });
    });
  }, [state, current, paused, showToast]);

  if (!state || !state.firstActivity) return null;

  const milestone = (STREAK_MILESTONES as readonly number[]).includes(current);

  return (
    <section
      className={`rounded-card border border-grid p-4 ${
        milestone && !paused ? 'toast-highlight' : 'bg-card'
      }`}
    >
      {paused ? (
        <p className="text-base text-ink">{tr.dashboard.streakPaused}</p>
      ) : (
        <p className="text-base text-ink">
          🔥 {ti(tr.dashboard.streak, { days: String(current) })}
        </p>
      )}
      <p className="mt-1 text-xs text-ink-soft">
        {ti(tr.dashboard.streakBest, { days: String(state.bestStreak) })}
      </p>
    </section>
  );
}
