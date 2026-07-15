import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { TabBar } from './TabBar';
import { Toast } from '../components/Toast';
import { getSettings } from '../db/repo/settings';
import { postDueRecurring } from '../db/repo/recurring';
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
    const run = () => void postDueRecurring(todayISO());
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
    <div className="mx-auto min-h-dvh max-w-md bg-paper">
      {/* pb reserves space for the fixed tab bar + FAB overhang */}
      <main className="px-4 pb-28 pt-4">
        <Outlet />
      </main>
      <TabBar />
      {quickAddOpen && <QuickAddSheet key={editingId ?? wishlistId ?? 'new'} />}
      <Toast />
    </div>
  );
}
