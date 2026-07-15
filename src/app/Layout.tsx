import { Outlet } from 'react-router-dom';
import { TabBar } from './TabBar';

export function Layout() {
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
