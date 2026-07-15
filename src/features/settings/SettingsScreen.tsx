import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { tr } from '../../i18n/tr';
import { useUiStore, type ThemePreference } from '../../app/theme';
import { useEphemeralStore } from '../../app/ui';
import { getSettings, updateSettings } from '../../db/repo/settings';
import { formatMinor, minorToInput, parseAmountMinor } from '../../lib/money';

const themeOptions: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: tr.settings.themeSystem },
  { value: 'light', label: tr.settings.themeLight },
  { value: 'dark', label: tr.settings.themeDark },
];

export function SettingsScreen() {
  const theme = useUiStore((s) => s.theme);
  const setThemeUi = useUiStore((s) => s.setTheme);
  const showToast = useEphemeralStore((s) => s.showToast);
  const settings = useLiveQuery(getSettings);

  const [income, setIncome] = useState<string>();
  const [incomeError, setIncomeError] = useState(false);

  if (!settings) return null;

  function setTheme(next: ThemePreference) {
    setThemeUi(next); // live source of truth (§5: theme is UI state)
    void updateSettings({ theme: next }); // mirrored so exports carry it (§7)
  }

  const incomeValue =
    income ??
    (settings.monthlyNetIncomeMinor
      ? minorToInput(settings.monthlyNetIncomeMinor)
      : '');

  function commitIncome() {
    if (income === undefined) return;
    if (!income.trim()) {
      void updateSettings({ monthlyNetIncomeMinor: undefined });
      showToast(tr.settings.saved);
      return;
    }
    const minor = parseAmountMinor(income);
    if (minor === null || minor <= 0) {
      setIncomeError(true);
      return;
    }
    void updateSettings({ monthlyNetIncomeMinor: minor });
    showToast(
      <span>
        {tr.settings.monthlyIncome}: <span className="font-mono">{formatMinor(minor)}</span>
      </span>,
    );
  }

  const fieldCls =
    'mt-1 w-full rounded-card border border-grid bg-card px-3 py-2.5 text-base outline-none';

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
          {themeOptions.map((opt) => (
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

      <section className="rounded-card border border-grid bg-card p-4">
        <label className="block text-base font-medium">
          {tr.settings.salaryDay}
          <select
            value={settings.monthStartDay}
            onChange={(e) =>
              void updateSettings({ monthStartDay: Number(e.target.value) })
            }
            className={`${fieldCls} min-h-11 font-mono`}
          >
            {Array.from({ length: 28 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {i + 1}
              </option>
            ))}
          </select>
        </label>

        <label className="mt-3 block text-base font-medium">
          {tr.settings.reviewDay}
          <select
            value={settings.reviewDay}
            onChange={(e) =>
              void updateSettings({ reviewDay: Number(e.target.value) })
            }
            className={`${fieldCls} min-h-11`}
          >
            {tr.recurring.weekdaysShort.map((label, i) => (
              <option key={label} value={i + 1}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </section>

      {/* Time cost inputs (§9.10) */}
      <section className="rounded-card border border-grid bg-card p-4">
        <label className="block text-base font-medium">
          {tr.settings.monthlyIncome}
          <input
            inputMode="decimal"
            value={incomeValue}
            onChange={(e) => {
              setIncome(e.target.value);
              setIncomeError(false);
            }}
            onBlur={commitIncome}
            className={`${fieldCls} font-mono`}
          />
        </label>
        {incomeError && (
          <p className="mt-1 text-base text-redpen">{tr.budgets.invalidAmount}</p>
        )}

        <label className="mt-3 block text-base font-medium">
          {tr.settings.weeklyWorkHours}
          <select
            value={settings.weeklyWorkHours ?? 45}
            onChange={(e) =>
              void updateSettings({ weeklyWorkHours: Number(e.target.value) })
            }
            className={`${fieldCls} min-h-11 font-mono`}
          >
            {Array.from({ length: 61 }, (_, i) => i + 10).map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={() => void updateSettings({ showTimeCost: !settings.showTimeCost })}
          aria-pressed={settings.showTimeCost}
          className={`mt-3 flex min-h-11 w-full items-center justify-between rounded-card border px-3 text-base ${
            settings.showTimeCost
              ? 'border-ballpoint bg-ballpoint/10 text-ballpoint'
              : 'border-grid text-ink'
          }`}
        >
          <span className="text-left">
            {tr.settings.showTimeCost}
            <span className="block text-xs text-ink-soft">
              {tr.settings.showTimeCostHint}
            </span>
          </span>
          <span aria-hidden>{settings.showTimeCost ? '✓' : ''}</span>
        </button>
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
