import { useToastStore } from '../store/useToastStore';

export function ToastHost() {
  const toasts = useToastStore(s => s.toasts);
  const dismissToast = useToastStore(s => s.dismissToast);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="toast-host" aria-live="polite" aria-relevant="additions">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`toast toast-${t.variant}`}
          role="status">
          <span className="toast-message">{t.message}</span>
          <button
            type="button"
            className="toast-dismiss"
            aria-label="Dismiss"
            onClick={() => dismissToast(t.id)}>
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
