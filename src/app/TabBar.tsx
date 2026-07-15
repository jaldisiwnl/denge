import { NavLink } from 'react-router-dom';
import { tr } from '../i18n/tr';
import { useEphemeralStore } from './ui';
import { IconButce, IconIcgoru, IconIslemler, IconOzet } from './navIcons';

const tabs = [
  { to: '/', label: tr.tabs.ozet, icon: IconOzet },
  { to: '/islemler', label: tr.tabs.islemler, icon: IconIslemler },
  { to: '/butce', label: tr.tabs.butce, icon: IconButce },
  { to: '/icgoru', label: tr.tabs.icgoru, icon: IconIcgoru },
];

function Tab({ to, label, icon: Icon }: (typeof tabs)[number]) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-card py-1.5 ${
          isActive ? 'text-ballpoint' : 'text-ink-soft'
        }`
      }
    >
      <Icon />
      <span className="text-xs font-medium">{label}</span>
    </NavLink>
  );
}

export function TabBar() {
  const openQuickAdd = useEphemeralStore((s) => s.openQuickAdd);
  return (
    <nav
      aria-label={tr.app.name}
      className="fixed inset-x-0 bottom-0 z-10 mx-auto max-w-md border-t border-grid bg-card pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <div className="flex items-stretch px-2 py-1">
        <Tab {...tabs[0]!} />
        <Tab {...tabs[1]!} />
        {/* Center slot: FAB opens the quick-add sheet (§9.1) */}
        <div className="relative flex-1">
          <button
            type="button"
            aria-label={tr.common.addTransaction}
            onClick={openQuickAdd}
            className="absolute -top-7 left-1/2 h-14 w-14 -translate-x-1/2 rounded-full bg-ballpoint text-card shadow-overlay"
          >
            <svg viewBox="0 0 24 24" className="mx-auto h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
        <Tab {...tabs[2]!} />
        <Tab {...tabs[3]!} />
      </div>
    </nav>
  );
}
