import { create } from 'zustand';

export type ToastVariant = 'success' | 'info' | 'warn' | 'error';

export interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
}

const MAX_TOASTS = 3;

let nextId = 0;

function autoDismissMs(variant: ToastVariant): number {
  if (variant === 'error' || variant === 'warn') {
    return 8000;
  }
  return 5000;
}

interface ToastState {
  toasts: ToastItem[];
  pushToast: (input: { message: string; variant?: ToastVariant }) => void;
  dismissToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  pushToast: ({ message, variant = 'info' }) => {
    const id = `toast-${++nextId}`;
    const item: ToastItem = { id, message, variant };
    set(state => ({
      toasts: [item, ...state.toasts].slice(0, MAX_TOASTS),
    }));
    const ms = autoDismissMs(variant);
    window.setTimeout(() => {
      if (get().toasts.some(t => t.id === id)) {
        get().dismissToast(id);
      }
    }, ms);
  },

  dismissToast: id =>
    set(state => ({ toasts: state.toasts.filter(t => t.id !== id) })),
}));
