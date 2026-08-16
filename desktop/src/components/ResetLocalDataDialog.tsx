import { useEffect, useState } from 'react';

export type ResetLocalDataChoice = {
  pendingOnly: boolean;
};

export function ResetLocalDataDialog({
  open,
  dirtyCount,
  conflictCount,
  onChoice,
}: {
  open: boolean;
  dirtyCount: number;
  conflictCount: number;
  onChoice: (choice: ResetLocalDataChoice | null) => void;
}) {
  const [pendingOnly, setPendingOnly] = useState(false);

  useEffect(() => {
    if (open) {
      setPendingOnly(false);
    }
  }, [open]);

  if (!open) {
    return null;
  }

  const pendingLabel =
    dirtyCount + conflictCount > 0
      ? ` (${dirtyCount} pending push · ${conflictCount} conflict${conflictCount === 1 ? '' : 's'})`
      : '';

  return (
    <div className="modal-overlay" role="presentation">
      <div
        className="card modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reset-local-data-title">
        <h3 id="reset-local-data-title">Reset local data</h3>
        <p className="muted">
          By default this removes <strong>all</strong> observations and
          attachment files from this device and resets sync offsets.
        </p>
        <label className="field-row-checkbox">
          <input
            type="checkbox"
            checked={pendingOnly}
            onChange={e => setPendingOnly(e.target.checked)}
          />
          <span>Reset only pending observations{pendingLabel}</span>
        </label>
        {pendingOnly ? (
          <p className="muted">
            Deletes pending-push and conflict rows only. Synced observations and
            sync offsets stay so the next pull can continue without
            re-downloading everything.
          </p>
        ) : (
          <p className="muted">
            Full reset: clears the local repository and attachment files. The
            next pull starts from empty offsets.
          </p>
        )}
        <div className="button-row">
          <button
            type="button"
            className="secondary"
            onClick={() => onChoice(null)}>
            Cancel
          </button>
          <button
            type="button"
            className="secondary danger"
            onClick={() => onChoice({ pendingOnly })}>
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
