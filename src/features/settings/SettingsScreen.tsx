import { Link } from 'react-router-dom';
import { tr } from '../../i18n/tr';
import { useUiStore, type ThemePreference } from '../../app/theme';
import { updateSettings } from '../../db/repo/settings';

const options: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: tr.settings.themeSystem },
  { value: 'light', label: tr.settings.themeLight },
  { value: 'dark', label: tr.settings.themeDark },
];

export function SettingsScreen() {
  const theme = useUiStore((s) => s.theme);
  const setThemeUi = useUiStore((s) => s.setTheme);

  function setTheme(next: ThemePreference) {
    setThemeUi(next); // live source of truth (§5: theme is UI state)
    void updateSettings({ theme: next }); // mirrored so exports carry it (§7)
  }

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-semibold">
        {tr.settings.title}
      </h1>

      <section className="rounded-card border border-grid bg-card p-4">
        <h2 className="text-base font-medium">{tr.settings.theme}</h2>
        <div
          role="radiogroup"
          aria-label={tr.settings.theme}
          className="mt-3 flex gap-2"
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={theme === opt.value}
              onClick={() => setTheme(opt.value)}
              className={`min-h-11 flex-1 rounded-full border px-3 text-base ${
                theme === opt.value
                  ? 'border-ballpoint bg-ballpoint/15 font-medium text-ballpoint'
                  : 'border-grid text-ink-soft'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      <section className="divide-y divide-grid rounded-card border border-grid bg-card">
        <Link
          to="/ayarlar/kategoriler"
          className="flex min-h-11 items-center justify-between px-4 py-3 text-base"
        >
          {tr.settings.categories}
          <span className="text-ink-soft" aria-hidden>
            ›
          </span>
        </Link>
        <Link
          to="/ayarlar/kisayollar"
          className="flex min-h-11 items-center justify-between px-4 py-3 text-base"
        >
          {tr.settings.templates}
          <span className="text-ink-soft" aria-hidden>
            ›
          </span>
        </Link>
      </section>
    </div>
  );
}
