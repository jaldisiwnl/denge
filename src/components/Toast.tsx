import { useEphemeralStore } from '../app/ui';

/** Bottom toast above the tab bar (§11.4); content carries mono amounts. */
export function Toast() {
  const toast = useEphemeralStore((s) => s.toast);
  if (!toast) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-24 z-50 flex justify-center px-4"
    >
      <div
        className={`max-w-md rounded-card px-4 py-2.5 text-base shadow-overlay ${
          toast.highlight
            ? 'toast-highlight text-ink'
            : 'bg-ink text-paper'
        }`}
      >
        {toast.content}
      </div>
    </div>
  );
}
