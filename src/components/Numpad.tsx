import { tr } from '../i18n/tr';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', '⌫'] as const;
export type NumpadKey = (typeof KEYS)[number];

/** Custom numpad (§9.1) — the OS keyboard never opens for amounts. */
export function Numpad(props: { onKey: (key: NumpadKey) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {KEYS.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => props.onKey(k)}
          aria-label={k === '⌫' ? tr.quickAdd.backspace : k}
          className="h-12 rounded-card border border-grid bg-card font-mono text-xl text-ink active:bg-grid"
        >
          {k}
        </button>
      ))}
    </div>
  );
}
