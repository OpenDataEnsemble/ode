import { useCallback, useId, useState } from 'react';
import { useCustodianStore } from '../store/useCustodianStore';

/**
 * Shown after developer-mode mirror refresh when app.config.json defines indexes
 * that are not yet present on this profile's SQLite database.
 */
export function ObservationIndexPrompt() {
  const titleId = useId();
  const prompt = useCustodianStore(s => s.observationIndexPrompt);
  const indexCreateBusy = useCustodianStore(s => s.indexCreateBusy);
  const indexCreateError = useCustodianStore(s => s.indexCreateError);
  const createPendingObservationIndexes = useCustodianStore(
    s => s.createPendingObservationIndexes,
  );
  const dismissObservationIndexPrompt = useCustodianStore(
    s => s.dismissObservationIndexPrompt,
  );
  const [showSql, setShowSql] = useState(false);

  const handleCreate = useCallback(() => {
    void createPendingObservationIndexes();
  }, [createPendingObservationIndexes]);

  const handleDismiss = useCallback(() => {
    if (indexCreateBusy) {
      return;
    }
    dismissObservationIndexPrompt();
    setShowSql(false);
  }, [dismissObservationIndexPrompt, indexCreateBusy]);

  if (!prompt) {
    return null;
  }

  const statementCount = prompt.pendingStatements.length;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(6, 14, 32, 0.72)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 2100,
        padding: '1rem',
      }}>
      <div
        className="card"
        style={{ maxWidth: '32rem', width: '100%', padding: '1.25rem' }}>
        <h3 id={titleId} style={{ marginTop: 0 }}>
          Create observation indexes?
        </h3>
        <p className="muted" style={{ fontSize: '0.9rem' }}>
          The mirrored <code>app.config.json</code> defines{' '}
          <strong>{prompt.indexDefsLoaded}</strong> observation index
          {prompt.indexDefsLoaded === 1 ? '' : 'es'}, and{' '}
          <strong>{statementCount}</strong> SQLite index
          {statementCount === 1 ? '' : 'es'} are not present on this profile
          yet. Creating them speeds up custom app queries.
        </p>
        <p
          className="notice warn"
          style={{ fontSize: '0.85rem', margin: '1rem 0 0.5rem' }}>
          Indexes are created in this profile&apos;s local database (the same
          store used for sync and observations). This is not limited to
          developer mode or the dev mirror folder.
        </p>
        <button
          type="button"
          className="secondary"
          style={{ marginTop: '0.5rem' }}
          disabled={indexCreateBusy}
          onClick={() => setShowSql(v => !v)}>
          {showSql ? 'Hide SQL' : 'Show SQL'}
        </button>
        {showSql ? (
          <pre
            style={{
              marginTop: '0.75rem',
              maxHeight: '12rem',
              overflow: 'auto',
              fontSize: '0.75rem',
              padding: '0.75rem',
              background: 'var(--surface,rgb(59, 58, 58))',
              borderRadius: '4px',
            }}>
            {prompt.pendingStatements.join('\n')}
          </pre>
        ) : null}
        {indexCreateError ? (
          <p className="notice error" style={{ margin: '0.75rem 0 0' }}>
            {indexCreateError}
          </p>
        ) : null}
        <div className="button-row" style={{ marginTop: '1rem' }}>
          <button
            type="button"
            disabled={indexCreateBusy}
            onClick={handleCreate}>
            {indexCreateBusy ? 'Creating indexes…' : 'Create indexes'}
          </button>
          <button
            type="button"
            className="secondary"
            disabled={indexCreateBusy}
            onClick={handleDismiss}>
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
