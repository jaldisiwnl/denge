import { create } from 'zustand';
import type { ReactNode } from 'react';
import type { Transaction } from '../db/types';

// Ephemeral UI state (open sheets, toast) — Zustand per §5, never persisted.
// Persistent data lives in Dexie only.

interface EphemeralState {
  quickAddOpen: boolean;
  /** When set, the quick-add sheet acts as the detail editor (§9.3). */
  editTransaction?: Transaction;
  toast?: ReactNode;
  openQuickAdd: () => void;
  openEdit: (txn: Transaction) => void;
  closeQuickAdd: () => void;
  showToast: (content: ReactNode) => void;
}

let toastTimer: number | undefined;

export const useEphemeralStore = create<EphemeralState>()((set) => ({
  quickAddOpen: false,
  editTransaction: undefined,
  toast: undefined,
  openQuickAdd: () => set({ quickAddOpen: true, editTransaction: undefined }),
  openEdit: (txn) => set({ quickAddOpen: true, editTransaction: txn }),
  closeQuickAdd: () => set({ quickAddOpen: false, editTransaction: undefined }),
  showToast: (content) => {
    window.clearTimeout(toastTimer);
    set({ toast: content });
    toastTimer = window.setTimeout(() => set({ toast: undefined }), 2500);
  },
}));
