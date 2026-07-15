import { Link } from 'react-router-dom';
import { tr } from '../../i18n/tr';
import { HeroCard } from './HeroCard';
import { StreakCard } from './StreakCard';
import { DonutCard } from './DonutCard';
import { TrendCard } from './TrendCard';
import { HeatmapCard } from './HeatmapCard';
import { PendingRecurringCards } from './PendingRecurringCards';
import { LapseCard } from '../recovery/LapseCard';

// Card order per §9.7. Kumbara card joins in P5.
export function DashboardScreen() {
  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold">{tr.tabs.ozet}</h1>
        <Link
          to="/ayarlar"
          aria-label={tr.common.settings}
          className="flex h-11 w-11 items-center justify-center rounded-full text-ink-soft"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
          </svg>
        </Link>
      </header>

      <HeroCard />
      {/* Pending cards (§9.7.2): lapse recovery always first */}
      <LapseCard />
      <PendingRecurringCards />
      <StreakCard />
      <DonutCard />
      <TrendCard />
      <HeatmapCard />
    </div>
  );
}
