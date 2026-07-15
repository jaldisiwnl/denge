import { Outlet } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { TabBar } from './TabBar';
import { getSettings } from '../db/repo/settings';
import { OnboardingScreen } from '../features/onboarding/OnboardingScreen';

export function Layout() {
  const settings = useLiveQuery(getSettings);

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
    </div>
  );
}
