import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { TabBar } from './TabBar';
import { SideNav } from './SideNav';
import { Toast } from '../components/Toast';
import { getSettings } from '../db/repo/settings';
import { postDueRecurring } from '../db/repo/recurring';
import { postDueObligations } from '../db/repo/obligations';
import { todayISO } from '../lib/dates';
import { OnboardingScreen } from '../features/onboarding/OnboardingScreen';
import { QuickAddSheet } from '../features/transactions/QuickAddSheet';
import { useEphemeralStore } from './ui';

export function Layout() {
  const settings = useLiveQuery(getSettings);
  const quickAddOpen = useEphemeralStore((s) => s.quickAddOpen);
  // Keying by session identity remounts the sheet with fresh state.
  const editingId = useEphemeralStore((s) => s.editTransaction?.id);
  const wishlistId = useEphemeralStore((s) => s.wishlistPurchase?.id);

  // On app open and window focus (§6): post due recurring transactions.
  // Idempotent by design (§8.7), so firing often is harmless.
  useEffect(() => {
    const run = () => {
      void postDueRecurring(todayISO());
      void postDueObligations(todayISO()); // auto-post 'kart' obligations
    };
    run();
    const onVisible = () => {
      if (document.visibilityState === 'visible') run();
    };
    window.addEventListener('focus', run);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', run);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  // undefined = query still resolving (a few ms on first paint); rendering
  // nothing avoids a tab-bar flash before onboarding takes over.
  if (!settings) return null;
  if (!settings.onboardingDone) return <OnboardingScreen />;

  return (
    <div className="min-h-dvh bg-paper">
      {/* Desktop: fixed sidebar + wide content; mobile: tab bar + FAB. */}
      <SideNav />
      <div className="lg:pl-60">
        {/* pb reserves space for the fixed tab bar + FAB overhang (mobile) */}
        <main className="mx-auto max-w-md px-4 pb-28 pt-4 lg:max-w-5xl lg:px-8 lg:pb-12 lg:pt-8">
          <Outlet />
        </main>
      </div>
      <TabBar />
      {quickAddOpen && <QuickAddSheet key={editingId ?? wishlistId ?? 'new'} />}
      <Toast />
    </div>
  );
}
