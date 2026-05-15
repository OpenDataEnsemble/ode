import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { tauriClient } from '../lib/tauriClient';
import { confirmDestructiveAction } from '../lib/destructivePolicy';
import { productionPushConfirmDetail } from '../lib/syncUiCopy';
import { useSynkServerStatus } from '../hooks/useSynkServerStatus';
import {
  selectActiveProfileState,
  selectAuthSessionForActiveProfile,
  selectPausedSyncJob,
  selectSyncActivity,
  useCustodianStore,
} from '../store/useCustodianStore';

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function SyncPage() {
  const activeProfile = useCustodianStore(selectActiveProfileState);
  const authSession = useCustodianStore(selectAuthSessionForActiveProfile);
  const syncActivity = useCustodianStore(selectSyncActivity);
  const syncPausedJob = useCustodianStore(selectPausedSyncJob);
  const {
    synkPull,
    synkPush,
    synkResetServerRepository,
    refreshPausedSyncJob,
    resumePausedSyncEngineJob,
    syncPauseInFlight,
    syncContinueInFlight,
    syncCancelJob,
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
  const [forcePushMissingAttachments, setForcePushMissingAttachments] =
    useState(false);
  const [indexStatus, setIndexStatus] = useState<{
    activeGeneration: number;
    lastRebuildAt?: string | null;
  } | null>(null);
  const [indexRebuildBusy, setIndexRebuildBusy] = useState(false);
  const [indexRebuildMessage, setIndexRebuildMessage] = useState<string | null>(
    null,
  );

  const appendLog = useCallback((line: string) => {
    const stamp = new Date().toLocaleString();
    setOpLog(prev => [`${stamp} — ${line}`, ...prev].slice(0, 40));
  }, []);

  const activeInFlight = syncActivity !== null;
  const enginePaused =
    !activeInFlight &&
    syncPausedJob !== null &&
    (syncPausedJob.status === 'paused' || syncPausedJob.status === 'failed');

  useEffect(() => {
    void loadHealth();
    void refreshPausedSyncJob();
    void tauriClient
      .getObservationIndexStatus()
      .then(setIndexStatus)
      .catch(() => setIndexStatus(null));
  }, [loadHealth, refreshPausedSyncJob]);

  async function recreateObservationIndexes() {
    setIndexRebuildBusy(true);
    setIndexRebuildMessage(null);
    try {
      const result = await tauriClient.rebuildObservationIndexes();
      setIndexStatus({
        activeGeneration: result.generation,
        lastRebuildAt: result.lastRebuildAt ?? null,
      });
      setIndexRebuildMessage(
        `Indexes rebuilt (generation ${result.generation}).`,
      );
      appendLog(`Observation indexes rebuilt (generation ${result.generation}).`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setIndexRebuildMessage(`Rebuild failed: ${msg}`);
      appendLog(`Index rebuild failed: ${msg}`);
    } finally {
      setIndexRebuildBusy(false);
    }
  }

  useEffect(() => {
    if (!syncActivity) {
      return;
    }
    const t = window.setInterval(() => void loadHealth(), 2000);
    return () => window.clearInterval(t);
  }, [syncActivity, loadHealth]);

  async function pull() {
    if (activeInFlight || enginePaused) return;
    try {
      await synkPull({ baseUrl: serverUrl });
      appendLog(useCustodianStore.getState().syncMessage ?? 'Pull finished.');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      appendLog(`Pull failed: ${msg}`);
    }
  }

  async function push() {
    if (activeInFlight || enginePaused) return;
    const tier = activeProfile?.environment ?? 'production';
    if (tier === 'production') {
      await loadHealth();
      const dirtyCount = useCustodianStore.getState().health?.dirtyCount ?? 0;
      if (
        !(await confirmDestructiveAction(
          tier,
          'push',
          productionPushConfirmDetail(dirtyCount),
        ))
      ) {
        return;
      }
    }
    try {
      await synkPush({
        baseUrl: serverUrl,
        forcePushMissingAttachments,
        onMissingAttachmentReport: lines => {
          for (const line of lines) {
            appendLog(line);
          }
        },
      });
      appendLog(useCustodianStore.getState().syncMessage ?? 'Push finished.');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      appendLog(`Push failed: ${msg}`);
    }
  }

  async function resetServerAndPull() {
    if (activeInFlight || enginePaused) return;
    if (
      !(await confirmDestructiveAction(
        activeProfile?.environment ?? 'production',
        'server_reset',
        'Reset the server repository? This deletes all observations and attachment ' +
          'manifest data on Synkronus (app bundles are kept), creates a new server data ' +
          'generation, then pulls so this device archives its current workspace and ' +
          'starts fresh. Requires an admin-capable account.',
      ))
    ) {
      return;
    }
    try {
      await synkResetServerRepository({ baseUrl: serverUrl });
      appendLog(
        useCustodianStore.getState().syncMessage ??
          'Server reset + pull finished.',
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

  const blockedStart = activeInFlight || enginePaused;

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
            <strong>{health?.dirtyCount ?? 0}</strong> observation(s){' '}
            <span className="muted">
              Rows with <code>sync_status: dirty</code> (conflicts excluded —
              see below). Skipped runs stay here until attachments or validation
              issues are fixed.
            </span>
          </dd>
          <dt>Outbound queue</dt>
          <dd>
            <strong>{health?.pendingAttachmentCount ?? 0}</strong> file(s){' '}
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

      {activeInFlight ? (
        <div className="panel">
          <h3>Sync controls</h3>
          <p className="muted">
            Progress appears in the banner above. Pause waits between steps;
            resume continues this session. Cancel stops the job.
          </p>
          <div className="button-row">
            <button
              type="button"
              className="secondary"
              onClick={() => void syncPauseInFlight()}>
              Pause
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => void syncContinueInFlight()}>
              Resume
            </button>
            <button
              type="button"
              className="secondary danger"
              onClick={() => void syncCancelJob(undefined)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {enginePaused && syncPausedJob ? (
        <div className="panel">
          <h3>Paused sync job</h3>
          <p className="muted">
            A sync job stopped (<strong>{syncPausedJob.op}</strong>,{' '}
            {syncPausedJob.phase}).{' '}
            {syncPausedJob.errorMessage ?? syncPausedJob.progressMessage ?? ''}
          </p>
          <div className="button-row">
            <button
              type="button"
              className="secondary"
              onClick={() => void resumePausedSyncEngineJob()}>
              Resume job
            </button>
            <button
              type="button"
              className="secondary danger"
              onClick={() => void syncCancelJob(syncPausedJob.id)}>
              Discard job
            </button>
          </div>
        </div>
      ) : null}

      <div className="panel">
        <h3>Observation indexes</h3>
        <p className="muted">
          Local-only indexes for fast custom app queries (from{' '}
          <code>app.config.json</code> <code>observationIndexes</code>). Use after
          changing index config or bulk imports.
        </p>
        <dl className="meta-dl">
          <dt>Active generation</dt>
          <dd>
            <strong>{indexStatus?.activeGeneration ?? '—'}</strong>
          </dd>
          <dt>Last rebuild</dt>
          <dd>{formatDate(indexStatus?.lastRebuildAt)}</dd>
        </dl>
        <div className="button-row">
          <button
            type="button"
            className="secondary"
            disabled={indexRebuildBusy}
            onClick={() => void recreateObservationIndexes()}>
            {indexRebuildBusy ? 'Rebuilding indexes…' : 'Re-create index'}
          </button>
        </div>
        {indexRebuildMessage ? (
          <p className="muted">{indexRebuildMessage}</p>
        ) : null}
      </div>

      <div className="panel">
        <h3>Pull and push</h3>
        <div className="field-row-checkbox">
          <label className="sync-force-missing-label">
            <input
              type="checkbox"
              width="inherit"
              checked={forcePushMissingAttachments}
              disabled={blockedStart}
              onChange={e => setForcePushMissingAttachments(e.target.checked)}
            />
            Force push observations w/missing attachments
          </label>
        </div>
        <p className="muted sync-force-missing-hint">
          When checked, observations whose attachment files are not on disk are
          still pushed; form type, observation id, and missing basenames are
          logged below and appended to the sync status message. Server
          validation may still reject rows.
        </p>
        <div className="button-row">
          <button
            type="button"
            className="secondary"
            disabled={blockedStart}
            onClick={() => void pull()}>
            Pull
          </button>
          <button
            type="button"
            disabled={blockedStart}
            onClick={() => void push()}>
            Push
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
            disabled={blockedStart}
            onClick={() => void resetServerAndPull()}>
            Reset server repository and pull
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
