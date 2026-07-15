import { useEffect, type ReactNode } from 'react';

/**
 * Bottom sheet (§11.3/§11.4): 16px top radius, drag-handle bar, shadow only
 * here (overlay), 240ms slide-up (§11.6 — reduced-motion handled globally).
 * `full` stretches near the top for the quick-add sheet (§9.1).
 */
export function Sheet(props: {
  onClose: () => void;
  children: ReactNode;
  full?: boolean;
}) {
  const { onClose } = props;

  useEffect(() => {
    // Lock background scroll while any sheet is open.
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        className={`absolute inset-x-0 bottom-0 mx-auto flex max-w-md flex-col rounded-t-sheet bg-card shadow-overlay animate-sheet-up ${
          props.full ? 'top-4' : 'max-h-[90dvh]'
        }`}
      >
        <div className="flex justify-center pb-1 pt-2">
          <div className="h-1 w-10 rounded-full bg-grid" aria-hidden />
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-4">
          {props.children}
        </div>
      </div>
    </div>
  );
}
