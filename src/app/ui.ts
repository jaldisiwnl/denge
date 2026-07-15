import { create } from 'zustand';
import type { ReactNode } from 'react';
import type { Transaction } from '../db/types';

// Ephemeral UI state (open sheets, toast) — Zustand per §5, never persisted.
// Persistent data lives in Dexie only.

export interface ToastState {
  content: ReactNode;
  /** Milestone/goal toasts get the highlighter treatment (§11.6). */
  highlight?: boolean;
}

interface EphemeralState {
  quickAddOpen: boolean;
  /** When set, the quick-add sheet acts as the detail editor (§9.3). */
  editTransaction?: Transaction;
  toast?: ToastState;
  openQuickAdd: () => void;
  openEdit: (txn: Transaction) => void;
  closeQuickAdd: () => void;
  showToast: (content: ReactNode, opts?: { highlight?: boolean }) => void;
}

let toastTimer: number | undefined;

export const useEphemeralStore = create<EphemeralState>()((set) => ({
  quickAddOpen: false,
  editTransaction: undefined,
  toast: undefined,
  openQuickAdd: () => set({ quickAddOpen: true, editTransaction: undefined }),
  openEdit: (txn) => set({ quickAddOpen: true, editTransaction: txn }),
  closeQuickAdd: () => set({ quickAddOpen: false, editTransaction: undefined }),
  showToast: (content, opts) => {
    window.clearTimeout(toastTimer);
    set({ toast: { content, highlight: opts?.highlight } });
    toastTimer = window.setTimeout(() => set({ toast: undefined }), 2500);
  },
}));
