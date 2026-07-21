import { Link } from 'react-router-dom';
import { tr } from '../../i18n/tr';
import { HeroCard } from './HeroCard';
import { WeeklyCard } from './WeeklyCard';
import { StreakCard } from './StreakCard';
import { DonutCard } from './DonutCard';
import { TrendCard } from './TrendCard';
import { HeatmapCard } from './HeatmapCard';
import { KumbaraCard } from './KumbaraCard';
import { ForgoneCard } from './ForgoneCard';
import { PendingRecurringCards } from './PendingRecurringCards';
import { UpcomingPaymentsCard } from './UpcomingPaymentsCard';
import { LapseCard } from '../recovery/LapseCard';
import { ReviewBadgeCard } from '../review/ReviewBadgeCard';
import { CooldownBadgeCard } from '../cooldown/CooldownBadgeCard';
import { CloseCard } from '../close/CloseCard';

// Card order per §9.7; desktop lays the same cards on a grid.
const WIDE = 'lg:col-span-2 xl:col-span-3';

export function DashboardScreen() {
  return (
    <div>
      <header className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold">{tr.tabs.ozet}</h1>
        <Link
          to="/ayarlar"
          aria-label={tr.common.settings}
          className="flex h-11 w-11 items-center justify-center rounded-full text-ink-soft lg:hidden"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
          </svg>
        </Link>
      </header>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start xl:grid-cols-3">
        <HeroCard className={WIDE} />
        {/* Pending cards (§9.7.2): lapse first, then review, cooldowns, fixed */}
        <LapseCard className={WIDE} />
        <ReviewBadgeCard className={WIDE} />
        <CooldownBadgeCard className={WIDE} />
        <PendingRecurringCards className={WIDE} />
        <UpcomingPaymentsCard className={WIDE} />
        <CloseCard className={WIDE} />
        <WeeklyCard />
        <KumbaraCard />
        <ForgoneCard />
        <StreakCard />
        <DonutCard />
        <TrendCard />
        <HeatmapCard />
      </div>
    </div>
  );
}
