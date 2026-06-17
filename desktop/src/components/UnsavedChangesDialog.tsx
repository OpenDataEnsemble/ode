export type UnsavedCloseChoice = 'save' | 'discard' | 'cancel';

type Props = {
  open: boolean;
  onChoice: (choice: UnsavedCloseChoice) => void;
};

export function UnsavedChangesDialog({ open, onChoice }: Props) {
  if (!open) {
    return null;
  }
  return (
    <div className="modal-overlay" role="presentation">
      <div
        className="card modal-card"
        role="dialog"
        aria-labelledby="unsaved-title"
        aria-modal="true">
        <h3 id="unsaved-title">Unsaved changes</h3>
        <p className="muted">Save changes before closing this tab?</p>
        <div className="button-row">
          <button type="button" onClick={() => onChoice('save')}>
            Save
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => onChoice('discard')}>
            Don&apos;t save
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => onChoice('cancel')}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
