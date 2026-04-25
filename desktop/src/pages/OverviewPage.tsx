import { useEffect } from 'react';
import { confirmDestructiveAction } from '../lib/destructivePolicy';
import { useSynkServerStatus } from '../hooks/useSynkServerStatus';
import {
  selectActiveProfileState,
  useCustodianStore,
} from '../store/useCustodianStore';

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function OverviewPage() {
  const activeProfile = useCustodianStore(selectActiveProfileState);
  const {
    health,
    error,
    loadHealth,
    loadWorkspace,
    loadObservations,
    resetLocalWorkspaceData,
  } = useCustodianStore();

  const serverUrl = activeProfile?.serverUrl ?? '';
  const profileLabel = (activeProfile?.label ?? '').trim() || 'Unnamed';
  const { status, displayVersion, statusLabel } = useSynkServerStatus(
    serverUrl,
    profileLabel,
  );

  useEffect(() => {
    void loadWorkspace();
    void loadHealth();
    void loadObservations();
  }, [loadHealth, loadObservations, loadWorkspace]);

  async function resetLocalData() {
    if (
      !confirmDestructiveAction(
        activeProfile?.environment ?? 'production',
        'local_reset',
        'Remove all observations and attachment files from this device, clear local backup history, ' +
          'and reset sync offsets (as if this profile were recreated). ' +
          'The app bundle under this workspace and your sign-in are not changed.',
      )
    ) {
      return;
    }
    await resetLocalWorkspaceData();
  }

  return (
    <section className="page">
      <header className="page-header page-header-inline">
        <div>
          <h2>Overview</h2>
          <p>
            Repository state, diagnostics, and maintenance for the active
            profile.
          </p>
        </div>
        <button type="button" onClick={() => void resetLocalData()}>
          Reset local data
        </button>
      </header>

      <div className="panel active-config-banner">
        <h3>Active profile</h3>
        <p className="muted">
          <strong>{activeProfile?.label?.trim() || '—'}</strong>
          {activeProfile?.serverUrl?.trim() ? (
            <>
              {' '}
              ·{' '}
              <span className="active-config-url">
                {activeProfile.serverUrl.trim()}
              </span>
            </>
          ) : (
            <span> · No server URL (set in Profiles)</span>
          )}
        </p>
      </div>

      <div className="panel">
        <h3>Server status</h3>
        <dl className="kv-grid">
          <dt>Reachability</dt>
          <dd>
            <span className={`server-status-inline ${status}`}>
              <span className={`server-status-dot ${status}`} aria-hidden />
              {status === 'live'
                ? `Live${displayVersion ? ` (${displayVersion})` : ''}`
                : status === 'unconfigured'
                  ? 'Not configured (add server URL in Profiles)'
                  : 'Unreachable'}
            </span>
          </dd>
          <dt>Details</dt>
          <dd className="muted">{statusLabel}</dd>
        </dl>
      </div>

      <div className="cards">
        <article className="card">
          <h3>Observations</h3>
          <p className="metric">{health?.totalObservations ?? 0}</p>
          <span>Total observations in local repository</span>
          <p className="metric metric-secondary">
            {health?.totalAttachmentCount ?? 0}
          </p>
          <span>Local attachment files</span>
        </article>
        <article className="card">
          <h3>Pending changes</h3>
          <p className="metric warn">{health?.dirtyCount ?? 0}</p>
          <span>Observations saved locally, not yet pushed</span>
          <p className="metric metric-secondary warn">
            {health?.pendingAttachmentCount ?? 0}
          </p>
          <span>Attachments awaiting upload</span>
        </article>
        <article className="card">
          <h3>Conflicts</h3>
          <p className="metric danger">{health?.conflictCount ?? 0}</p>
          <span>Need review before push</span>
        </article>
      </div>

      <div className="panel">
        <h3>Repository snapshot</h3>
        <dl className="kv-grid">
          <dt>Workspace</dt>
          <dd>{health?.workspacePath ?? 'Not set'}</dd>
          <dt>Repository file</dt>
          <dd>{health?.dbPath ?? 'Unavailable'}</dd>
          <dt>Last save</dt>
          <dd>{formatDate(health?.lastSaveAt)}</dd>
          <dt>Last pull</dt>
          <dd>{formatDate(health?.lastPullAt)}</dd>
          <dt>Last push</dt>
          <dd>{formatDate(health?.lastPushAt)}</dd>
        </dl>
      </div>

      {error ? <p className="notice error">{error}</p> : null}
    </section>
  );
}
