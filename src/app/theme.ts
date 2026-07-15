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
    document.documentElement.dataset.theme = resolve(
      useUiStore.getState().theme,
    );
  };

  apply();
  useUiStore.subscribe(apply);
  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', apply);
}
