import { create } from 'zustand';

export type ToastVariant = 'success' | 'info' | 'warn' | 'error';

export interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
  /** Optional secondary lines (e.g. per–form-type counts); shown in a scrollable list. */
  detailLines?: string[];
}

const MAX_TOASTS = 3;

let nextId = 0;

function autoDismissMs(variant: ToastVariant, hasDetails: boolean): number {
  if (hasDetails) {
    return 14000;
  }
  if (variant === 'error' || variant === 'warn') {
    return 8000;
  }
  return 5000;
}

export type PushToastInput = {
  message: string;
  variant?: ToastVariant;
  detailLines?: string[];
};

interface ToastState {
  toasts: ToastItem[];
  pushToast: (input: PushToastInput) => void;
  dismissToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  pushToast: ({ message, variant = 'info', detailLines }) => {
    const id = `toast-${++nextId}`;
    const lines = detailLines?.filter(l => l.trim().length > 0);
    const item: ToastItem = {
      id,
      message,
      variant,
      ...(lines && lines.length > 0 ? { detailLines: lines } : {}),
    };
    set(state => ({
      toasts: [item, ...state.toasts].slice(0, MAX_TOASTS),
    }));
    const ms = autoDismissMs(variant, Boolean(item.detailLines?.length));
    window.setTimeout(() => {
      if (get().toasts.some(t => t.id === id)) {
        get().dismissToast(id);
      }
    }, ms);
  },

  dismissToast: id =>
    set(state => ({ toasts: state.toasts.filter(t => t.id !== id) })),
}));
