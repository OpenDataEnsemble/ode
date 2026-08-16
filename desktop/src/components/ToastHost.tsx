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
          className={`toast toast-${t.variant}${t.detailLines?.length ? ' toast-rich' : ''}`}
          role="status">
          <div className="toast-body">
            <span className="toast-message">{t.message}</span>
            {t.detailLines && t.detailLines.length > 0 ? (
              <ul className="toast-detail-list">
                {t.detailLines.map(line => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : null}
          </div>
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
