type Props = {
  open: boolean;
  paramsJson: string;
  savedJson: string;
  parseError: string | null;
  disabled: boolean;
  onParamsChange: (value: string) => void;
  onSavedChange: (value: string) => void;
  onApply: () => void;
  onCancel: () => void;
};

export function FormPreviewAdvancedParamsDialog({
  open,
  paramsJson,
  savedJson,
  parseError,
  disabled,
  onParamsChange,
  onSavedChange,
  onApply,
  onCancel,
}: Props) {
  if (!open) {
    return null;
  }

  return (
    <div className="modal-overlay" role="presentation">
      <div
        className="card modal-card form-preview-advanced-dialog"
        role="dialog"
        aria-labelledby="form-preview-advanced-title"
        aria-modal="true">
        <h3 id="form-preview-advanced-title">Advanced params</h3>
        <div className="form-preview-advanced-dialog-fields">
          <label className="custom-app-device-toolbar-label form-preview-advanced-field">
            <span>params</span>
            <textarea
              className="form-preview-json"
              spellCheck={false}
              disabled={disabled}
              value={paramsJson}
              onChange={e => onParamsChange(e.target.value)}
              rows={6}
            />
          </label>
          <label className="custom-app-device-toolbar-label form-preview-advanced-field">
            <span>savedData</span>
            <textarea
              className="form-preview-json"
              spellCheck={false}
              disabled={disabled}
              value={savedJson}
              onChange={e => onSavedChange(e.target.value)}
              rows={6}
            />
          </label>
        </div>
        {parseError ? <p className="notice error">{parseError}</p> : null}
        <div className="button-row">
          <button type="button" disabled={disabled} onClick={onApply}>
            Apply
          </button>
          <button type="button" className="secondary" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
