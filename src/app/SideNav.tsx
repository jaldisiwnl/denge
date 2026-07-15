import { NavLink } from 'react-router-dom';
import { tr } from '../i18n/tr';
import { useEphemeralStore } from './ui';
import { IconAyarlar, IconButce, IconIcgoru, IconIslemler, IconOzet } from './navIcons';

const links = [
  { to: '/', label: tr.tabs.ozet, icon: IconOzet, end: true },
  { to: '/islemler', label: tr.tabs.islemler, icon: IconIslemler, end: false },
  { to: '/butce', label: tr.tabs.butce, icon: IconButce, end: false },
  { to: '/icgoru', label: tr.tabs.icgoru, icon: IconIcgoru, end: false },
  { to: '/ayarlar', label: tr.settings.title, icon: IconAyarlar, end: false },
];

/** Desktop-only sidebar; phones keep the bottom tab bar + FAB. */
export function SideNav() {
  const openQuickAdd = useEphemeralStore((s) => s.openQuickAdd);
  return (
    <aside className="fixed inset-y-0 left-0 z-10 hidden w-60 flex-col border-r border-grid bg-card px-4 py-6 lg:flex">
      <p className="font-display text-2xl font-bold text-ballpoint">
        {tr.app.name}
      </p>
      <p className="mt-0.5 text-xs text-ink-soft">{tr.app.tagline}</p>

      <button
        type="button"
        onClick={openQuickAdd}
        className="mt-6 min-h-11 rounded-full bg-ballpoint text-base font-medium text-white"
      >
        + {tr.common.addTransaction}
      </button>

      <nav className="mt-6 flex flex-col gap-1">
        {links.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex min-h-11 items-center gap-3 rounded-card px-3 text-base ${
                isActive
                  ? 'bg-ballpoint/10 font-medium text-ballpoint'
                  : 'text-ink-soft hover:bg-grid/40'
              }`
            }
          >
            <Icon />
            {label}
          </NavLink>
        ))}
      </nav>

      <p className="mt-auto text-xs text-ink-soft">{tr.settings.aboutLine}</p>
    </aside>
  );
}
