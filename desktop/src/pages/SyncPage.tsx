import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { confirmDestructiveAction } from '../lib/destructivePolicy';
import { useSynkServerStatus } from '../hooks/useSynkServerStatus';
import {
  selectActiveProfileState,
  selectAuthSessionForActiveProfile,
  selectSyncActivity,
  useCustodianStore,
} from '../store/useCustodianStore';

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

type SyncOp = 'pull' | 'push' | 'reset';

const OP_LABELS: Record<
  SyncOp,
  { idle: string; busy: string; progress: string }
> = {
  pull: { idle: 'Pull', busy: 'Pulling…', progress: 'Pulling from server…' },
  push: { idle: 'Push', busy: 'Pushing…', progress: 'Pushing to server…' },
  reset: {
    idle: 'Reset server repository and pull',
    busy: 'Resetting…',
    progress: 'Resetting server repository and pulling…',
  },
};

function BtnSpinner() {
  return <span className="btn-spinner" aria-hidden />;
}

export function SyncPage() {
  const activeProfile = useCustodianStore(selectActiveProfileState);
  const authSession = useCustodianStore(selectAuthSessionForActiveProfile);
  const syncActivity = useCustodianStore(selectSyncActivity);
  const {
    synkPull,
    synkPush,
    synkResetServerRepository,
    error,
    health,
    loadHealth,
  } = useCustodianStore();

  const serverUrl = (activeProfile?.serverUrl ?? '').trim();
  const profileLabel = (activeProfile?.label ?? '').trim() || 'Unnamed';
  const { status, displayVersion } = useSynkServerStatus(
    activeProfile?.serverUrl ?? '',
    profileLabel,
  );

  const [opLog, setOpLog] = useState<string[]>([]);
  const activeOp = syncActivity?.op ?? null;
  const isBusy = activeOp !== null;

  const appendLog = useCallback((line: string) => {
    const stamp = new Date().toLocaleString();
    setOpLog(prev => [`${stamp} — ${line}`, ...prev].slice(0, 12));
  }, []);

  useEffect(() => {
    void loadHealth();
  }, [loadHealth]);

  async function pull() {
    if (isBusy) return;
    try {
      const result = await synkPull({ baseUrl: serverUrl });
      appendLog(
        `Pull finished: ${result.imported} imported, ${result.conflicts} conflicts.`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      appendLog(`Pull failed: ${msg}`);
    }
  }

  async function push() {
    if (isBusy) return;
    if (
      !confirmDestructiveAction(
        activeProfile?.environment ?? 'production',
        'push',
        `Server: ${serverUrl || '(not set)'}`,
      )
    ) {
      return;
    }
    try {
      const n = await synkPush({ baseUrl: serverUrl });
      appendLog(
        typeof n === 'number' && n > 0
          ? `Push finished: ${n} observation(s) accepted.`
          : 'Push finished.',
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      appendLog(`Push failed: ${msg}`);
    }
  }

  async function resetServerAndPull() {
    if (isBusy) return;
    if (
      !confirmDestructiveAction(
        activeProfile?.environment ?? 'production',
        'server_reset',
        'Reset the server repository? This deletes all observations and attachment ' +
          'manifest data on Synkronus (app bundles are kept), creates a new server data ' +
          'generation, then pulls so this device archives its current workspace and ' +
          'starts fresh. Requires an admin-capable account.',
      )
    ) {
      return;
    }
    try {
      const result = await synkResetServerRepository({ baseUrl: serverUrl });
      appendLog(
        `Server reset + pull: ${result.imported} imported, ${result.conflicts} conflicts.`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      appendLog(`Server reset + pull failed: ${msg}`);
    }
  }

  const reachabilityLabel =
    status === 'live'
      ? `Reachable${displayVersion ? ` (${displayVersion})` : ''}`
      : status === 'unconfigured'
        ? 'Not configured'
        : 'Unreachable';
  const inFlightStatusText =
    syncActivity?.statusText ??
    (activeOp ? OP_LABELS[activeOp].progress : null);

  return (
    <section className="page">
      <header className="page-header">
        <h2>Sync</h2>
        <p>
          Pull remote changes into your local repository and push pending
          updates to Synkronus.{' '}
          <Link to="/data/profiles">Authenticate in Profiles</Link> for the
          active profile before syncing (your token is saved automatically).
        </p>
      </header>

      <div className="panel">
        <h3>Operational state</h3>
        <dl className="kv-grid">
          <dt>Server URL</dt>
          <dd>
            {serverUrl || (
              <span className="muted">Set in Profiles for this profile.</span>
            )}
          </dd>
          <dt>Reachability</dt>
          <dd>
            <span className={`server-status-inline ${status}`}>
              <span className={`server-status-dot ${status}`} aria-hidden />
              {reachabilityLabel}
            </span>
          </dd>
          <dt>Authentication</dt>
          <dd>
            {authSession ? (
              <span className="sync-auth-ok">
                Signed in for {authSession.baseUrl}
              </span>
            ) : (
              <span className="muted">
                Not authenticated —{' '}
                <Link to="/data/profiles">open Profiles</Link> to sign in.
              </span>
            )}
          </dd>
          <dt>Pending push</dt>
          <dd>
            <strong>{health?.dirtyCount ?? 0}</strong> observation(s) with local
            changes
          </dd>
          <dt>Attachments pending upload</dt>
          <dd>
            <strong>{health?.pendingAttachmentCount ?? 0}</strong> file(s) in
            the outbound queue
          </dd>
          <dt>Conflicts</dt>
          <dd>
            <strong>{health?.conflictCount ?? 0}</strong>
            {health && health.conflictCount > 0 ? (
              <>
                {' '}
                — review in <Link to="/data/observations">
                  Observations
                </Link>{' '}
                (Conflicts filter)
              </>
            ) : null}
          </dd>
          <dt>Last pull</dt>
          <dd>{formatDate(health?.lastPullAt)}</dd>
          <dt>Last push</dt>
          <dd>{formatDate(health?.lastPushAt)}</dd>
        </dl>
      </div>

      {isBusy ? (
        <div className="sync-status-bar" role="status" aria-live="polite">
          <span className="btn-spinner btn-spinner--lg" aria-hidden />
          <span>{inFlightStatusText}</span>
        </div>
      ) : null}

      <div className="panel">
        <h3>Pull and push</h3>
        <div className="button-row">
          <button
            type="button"
            className="secondary"
            disabled={isBusy}
            aria-busy={activeOp === 'pull'}
            onClick={() => void pull()}>
            {activeOp === 'pull' ? <BtnSpinner /> : null}
            {activeOp === 'pull' ? OP_LABELS.pull.busy : OP_LABELS.pull.idle}
          </button>
          <button
            type="button"
            disabled={isBusy}
            aria-busy={activeOp === 'push'}
            onClick={() => void push()}>
            {activeOp === 'push' ? <BtnSpinner /> : null}
            {activeOp === 'push' ? OP_LABELS.push.busy : OP_LABELS.push.idle}
          </button>
        </div>
      </div>

      <div className="panel">
        <h3>Server repository reset</h3>
        <p className="muted">
          Admin-only: wipe remote observation data and start a new repository
          generation on the server, then pull so this profile archives its
          current workspace and syncs against the empty server state.
        </p>
        <div className="button-row">
          <button
            type="button"
            className="secondary danger"
            disabled={isBusy}
            aria-busy={activeOp === 'reset'}
            onClick={() => void resetServerAndPull()}>
            {activeOp === 'reset' ? <BtnSpinner /> : null}
            {activeOp === 'reset' ? OP_LABELS.reset.busy : OP_LABELS.reset.idle}
          </button>
        </div>
      </div>

      {opLog.length > 0 ? (
        <div className="panel">
          <h3>Recent operations</h3>
          <ul className="op-log list-plain">
            {opLog.map((line, i) => (
              <li key={`${i}-${line.slice(0, 24)}`} className="op-log-line">
                {line}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? <p className="notice error">{error}</p> : null}
    </section>
  );
}
