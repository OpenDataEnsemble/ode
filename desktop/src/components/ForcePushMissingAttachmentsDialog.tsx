import { useEffect, useState } from 'react';
import type { MissingAttachmentIssue } from '../lib/pushAttachmentAudit';
import { formatMissingAttachmentSummary } from '../lib/pushAttachmentAudit';

export function ForcePushMissingAttachmentsDialog({
  open,
  issues,
  onChoice,
}: {
  open: boolean;
  issues: MissingAttachmentIssue[];
  onChoice: (force: boolean | null) => void;
}) {
  const [force, setForce] = useState(false);

  useEffect(() => {
    if (open) {
      setForce(false);
    }
  }, [open, issues]);

  if (!open) {
    return null;
  }

  return (
    <div className="modal-overlay" role="presentation">
      <div
        className="card modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="force-push-title">
        <h3 id="force-push-title">Missing attachment files</h3>
        <p className="muted">
          {issues.length} observation(s) reference attachment files that are not
          on disk. They will be skipped unless you force push.
        </p>
        <pre className="force-push-issue-list">
          {formatMissingAttachmentSummary(issues)}
        </pre>
        <label className="field-row-checkbox force-push-checkbox">
          <input
            type="checkbox"
            checked={force}
            onChange={e => setForce(e.target.checked)}
          />
          <span>Force push observations with missing attachments</span>
        </label>
        <div className="button-row">
          <button
            type="button"
            className="secondary"
            onClick={() => onChoice(null)}>
            Cancel
          </button>
          <button type="button" onClick={() => onChoice(force)}>
            Push
          </button>
        </div>
      </div>
    </div>
  );
}
