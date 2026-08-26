import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ForcePushMissingAttachmentsDialog } from '../components/ForcePushMissingAttachmentsDialog';
import { ResetLocalDataDialog } from '../components/ResetLocalDataDialog';
import { useProfileAutoSynkAuth } from '../hooks/useProfileAutoSynkAuth';
import { tauriClient } from '../lib/tauriClient';
import { confirmDestructiveAction } from '../lib/destructivePolicy';
import {
  auditPendingPushMissingAttachments,
  type MissingAttachmentIssue,
} from '../lib/pushAttachmentAudit';
import { pushConfirmMessage } from '../lib/syncUiCopy';
import { useSynkServerStatus } from '../hooks/useSynkServerStatus';
import {
  selectActiveProfileState,
  selectBundleActivity,
  selectPausedSyncJob,
  selectSyncActivity,
  useCustodianStore,
} from '../store/useCustodianStore';
import { ensureBundleApplyEventPipeline } from '../lib/bundleTauriEvents';

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function SyncPage() {
  const activeProfile = useCustodianStore(selectActiveProfileState);
  const { authBlocked, ensureAuth } = useProfileAutoSynkAuth(activeProfile?.id);
  const syncActivity = useCustodianStore(selectSyncActivity);
  const syncPausedJob = useCustodianStore(selectPausedSyncJob);
  const bundleActivity = useCustodianStore(selectBundleActivity);
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
    resetLocalWorkspaceData,
  } = useCustodianStore();

  const serverUrl = (activeProfile?.serverUrl ?? '').trim();
  const profileLabel = (activeProfile?.label ?? '').trim() || 'Unnamed';
  const { status, displayVersion } = useSynkServerStatus(
    activeProfile?.serverUrl ?? '',
    profileLabel,
  );

  const [missingAttachmentIssues, setMissingAttachmentIssues] = useState<
    MissingAttachmentIssue[] | null
  >(null);
  const [resetLocalOpen, setResetLocalOpen] = useState(false);
  const [indexStatus, setIndexStatus] = useState<{
    activeGeneration: number;
    lastRebuildAt?: string | null;
  } | null>(null);

  const indexRebuildBusy = bundleActivity !== null;

  const refreshIndexStatus = useCallback(() => {
    void tauriClient
      .getObservationIndexStatus()
      .then(setIndexStatus)
      .catch(() => setIndexStatus(null));
  }, []);

  useEffect(() => {
    void loadHealth();
    void refreshPausedSyncJob();
    refreshIndexStatus();
  }, [loadHealth, refreshPausedSyncJob, refreshIndexStatus]);

  useEffect(() => {
    if (bundleActivity !== null) {
      return;
    }
    refreshIndexStatus();
  }, [bundleActivity, refreshIndexStatus]);

  async function recreateObservationIndexes() {
    await ensureBundleApplyEventPipeline();
    try {
      await tauriClient.startObservationIndexRebuild();
    } catch {
      /* store error if we wire one later */
    }
  }

  useEffect(() => {
    if (!syncActivity) {
      return;
    }
    const t = window.setInterval(() => void loadHealth(), 2000);
    return () => window.clearInterval(t);
  }, [syncActivity, loadHealth]);

  const reachabilityLabel =
    status === 'live'
      ? `Reachable${displayVersion ? ` (${displayVersion})` : ''}`
      : status === 'unconfigured'
        ? 'Not configured'
        : 'Unreachable';

  const activeInFlight = syncActivity !== null;
  const pausedJobStatus = activeInFlight
    ? null
    : (syncPausedJob?.status ?? null);
  const engineResumablePaused = pausedJobStatus === 'paused';
  const engineFailed = pausedJobStatus === 'failed';
  const enginePaused = engineResumablePaused || engineFailed;
  const blockedStart = activeInFlight || enginePaused;
  // A failed job must not block Pull: a `repository_reset_required` push failure
  // instructs the user to pull to realign, so pull() below discards the stale
  // failed job first, then starts a fresh pull.
  const pullBlocked = activeInFlight || engineResumablePaused;

  async function pull() {
    if (!(await ensureAuth())) return;
    if (pullBlocked) return;
    // A failed job (e.g. a push that hit `repository_reset_required`) is not
    // resumable into a pull and the backend rejects a new sync while it exists,
    // so discard it before realigning.
    if (engineFailed && syncPausedJob) {
      await syncCancelJob(syncPausedJob.id);
    }
    try {
      await synkPull({ baseUrl: serverUrl });
    } catch {
      /* store error */
    }
  }

  async function runPush(forcePushMissingAttachments: boolean) {
    try {
      await synkPush({
        baseUrl: serverUrl,
        forcePushMissingAttachments,
      });
    } catch {
      /* store error */
    }
  }

  async function push(options?: { announceEmpty?: boolean }) {
    if (!(await ensureAuth())) return;
    if (activeInFlight || enginePaused) return;
    await loadHealth();

    // Nothing pending: skip the "Push 0 observations?" confirm. When invoked
    // directly by the Push button, still surface the store's "No pending
    // observations to push." message so the click gives feedback; the combined
    // Pull + Push flow stays silent so it keeps the pull result message.
    const pending = await tauriClient.listDirtyObservations();
    if (pending.length === 0) {
      if (options?.announceEmpty) {
        await runPush(false);
      }
      return;
    }

    if (
      !(await confirmDestructiveAction(
        'push',
        pushConfirmMessage(pending.length, profileLabel),
      ))
    ) {
      return;
    }

    const issues = await auditPendingPushMissingAttachments(pending);
    if (issues.length > 0) {
      setMissingAttachmentIssues(issues);
      return;
    }

    await runPush(false);
  }

  async function pullAndPush() {
    if (!(await ensureAuth())) return;
    if (activeInFlight || enginePaused) return;
    try {
      await synkPull({ baseUrl: serverUrl });
    } catch {
      return;
    }
    await push({ announceEmpty: false });
  }

  async function resetServerAndPull() {
    if (!(await ensureAuth())) return;
    if (activeInFlight || enginePaused) return;
    if (
      !(await confirmDestructiveAction(
        'server_reset',
        'Reset the server repository? This deletes all observations and attachment manifest data on Synkronus, then pulls so this device archives its workspace and starts fresh.',
      ))
    ) {
      return;
    }
    try {
      await synkResetServerRepository({ baseUrl: serverUrl });
    } catch {
      /* store error */
    }
  }

  async function resetLocalData() {
    await loadHealth();
    setResetLocalOpen(true);
  }

  return (
    <section className="page">
      <header className="page-header">
        <h2>Sync</h2>
      </header>

      {authBlocked ? (
        <p className="notice warn">
          Not authenticated. <Link to="/data/profiles">Open Profiles</Link> to
          sign in.
        </p>
      ) : null}

      <div className="panel">
        <dl className="kv-grid">
          <dt>Server</dt>
          <dd>{serverUrl || '—'}</dd>
          <dt>Status</dt>
          <dd>
            <span className={`server-status-inline ${status}`}>
              <span className={`server-status-dot ${status}`} aria-hidden />
              {reachabilityLabel}
            </span>
          </dd>
          <dt>Pending push</dt>
          <dd>{health?.dirtyCount ?? 0}</dd>
          <dt>Conflicts</dt>
          <dd>{health?.conflictCount ?? 0}</dd>
          <dt>Last pull</dt>
          <dd>{formatDate(health?.lastPullAt)}</dd>
          <dt>Last push</dt>
          <dd>{formatDate(health?.lastPushAt)}</dd>
        </dl>
      </div>

      {activeInFlight ? (
        <div className="panel">
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
          <p className="muted">
            {engineFailed ? 'Failed' : 'Paused'}: {syncPausedJob.op} —{' '}
            {syncPausedJob.phase}
          </p>
          {engineFailed && syncPausedJob.errorMessage ? (
            <p className="muted">{syncPausedJob.errorMessage}</p>
          ) : null}
          {engineFailed ? (
            <p className="muted">
              Discard this job, then Pull to realign — or use the Pull button
              above, which discards it for you.
            </p>
          ) : null}
          <div className="button-row">
            <button
              type="button"
              className="secondary"
              onClick={() => void resumePausedSyncEngineJob()}>
              {engineFailed ? 'Retry job' : 'Resume job'}
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
        <div className="button-row">
          <button
            type="button"
            className="btn-icon btn-success"
            disabled={blockedStart}
            onClick={() => void pullAndPush()}>
            <span className="material-symbols-outlined" aria-hidden>
              sync_alt
            </span>
            Sync (Pull + Push)
          </button>
          <button
            type="button"
            className="btn-icon secondary"
            disabled={pullBlocked}
            onClick={() => void pull()}>
            <span className="material-symbols-outlined" aria-hidden>
              download
            </span>
            Pull
          </button>
          <button
            type="button"
            className="btn-icon"
            disabled={blockedStart}
            onClick={() => void push({ announceEmpty: true })}>
            <span className="material-symbols-outlined" aria-hidden>
              upload
            </span>
            Push
          </button>
        </div>
      </div>

      <div className="panel panel-danger-zone">
        <h3>Danger zone</h3>
        <p className="muted">
          Index generation {indexStatus?.activeGeneration ?? '—'} · last rebuild{' '}
          {formatDate(indexStatus?.lastRebuildAt)}
        </p>
        <div className="button-row">
          <button
            type="button"
            className="secondary danger"
            onClick={() => void resetLocalData()}>
            Reset local data
          </button>
          <button
            type="button"
            className="secondary"
            disabled={indexRebuildBusy}
            onClick={() => void recreateObservationIndexes()}>
            Re-create index
          </button>
          <button
            type="button"
            className="secondary danger"
            disabled={blockedStart}
            onClick={() => void resetServerAndPull()}>
            Reset server repository and pull
          </button>
        </div>
      </div>

      {error ? <p className="notice error">{error}</p> : null}

      <ForcePushMissingAttachmentsDialog
        open={missingAttachmentIssues !== null}
        issues={missingAttachmentIssues ?? []}
        onChoice={force => {
          const issues = missingAttachmentIssues;
          setMissingAttachmentIssues(null);
          if (force === null || !issues?.length) {
            return;
          }
          void runPush(force);
        }}
      />

      <ResetLocalDataDialog
        open={resetLocalOpen}
        dirtyCount={health?.dirtyCount ?? 0}
        conflictCount={health?.conflictCount ?? 0}
        onChoice={choice => {
          setResetLocalOpen(false);
          if (!choice) {
            return;
          }
          void resetLocalWorkspaceData({ pendingOnly: choice.pendingOnly });
        }}
      />
    </section>
  );
}
