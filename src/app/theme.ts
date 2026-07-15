import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Theme is UI-only state, so it lives in Zustand, not Dexie (spec §5).
// The persisted key 'denge-ui' is also read by the pre-paint inline script
// in index.html — keep the two in sync if either changes.

export type ThemePreference = 'light' | 'dark' | 'system';

interface UiState {
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      theme: 'system',
      setTheme: (theme) => set({ theme }),
    }),
    { name: 'denge-ui' },
  ),
);

function resolve(theme: ThemePreference): 'light' | 'dark' {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }
  return theme;
}

/** Applies the current preference to <html data-theme> and keeps it in
 *  sync with OS changes while preference is 'system'. Call once at startup. */
export function initTheme(): void {
  const apply = () => {
    const resolved = resolve(useUiStore.getState().theme);
    document.documentElement.dataset.theme = resolved;
    // Browser chrome follows the app theme even when it overrides the OS
    // scheme (§13: theme-color = --paper per scheme).
    document
      .querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
      .forEach((meta) => {
        meta.content = resolved === 'dark' ? '#0F1524' : '#FAF9F4';
      });
  };

  apply();
  useUiStore.subscribe(apply);
  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', apply);
}
