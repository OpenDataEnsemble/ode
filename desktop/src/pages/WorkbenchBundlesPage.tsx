import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { confirm } from '@tauri-apps/plugin-dialog';
import {
  Configuration,
  DefaultApi,
  type AppBundleManifest,
} from '../generated/synkronus-client';
import { useProfileAutoSynkAuth } from '../hooks/useProfileAutoSynkAuth';
import { appBundleUpdateAvailable } from '../lib/appBundleStatus';
import {
  bundleBannerLineFromProgress,
  ensureBundleApplyEventPipeline,
  setBundleApplyProgressHandler,
} from '../lib/bundleTauriEvents';
import { readBundleCache, writeBundleCache } from '../lib/bundleCacheMeta';
import { isUnauthorizedSynkError } from '../lib/synkAuthErrors';
import { SYNKRONUS_CLIENT_VERSION } from '../lib/synkConstants';
import { tauriClient } from '../lib/tauriClient';
import {
  ensureWorkbenchBundleAuth,
  promptNavigateToProfilesForBundleAuth,
} from '../lib/workbenchBundleAuth';
import {
  selectActiveProfileState,
  selectAuthSessionForActiveProfile,
  useCustodianStore,
} from '../store/useCustodianStore';
import type {
  AppBundleState,
  BundleApplyProgressPayload,
} from '../types/domain';

function shortHash(h: string, n = 10): string {
  if (h.length <= n) return h;
  return `${h.slice(0, n)}…`;
}

function bundleButtonLabel(
  progress: BundleApplyProgressPayload | null,
): string {
  if (!progress || progress.phase === 'completed') {
    return 'Download & apply';
  }
  if (progress.phase === 'failed') {
    return 'Download & apply';
  }
  switch (progress.phase) {
    case 'downloading':
      return 'Downloading…';
    case 'archiving':
      return 'Saving archive…';
    case 'extracting':
      return 'Extracting…';
    case 'indexing':
      return 'Rebuilding indexes…';
    default:
      return 'Applying…';
  }
}

async function fetchServerBundleInfoFromApi(
  baseUrl: string,
  token: string,
  recoverActiveProfileAuth: () => Promise<boolean>,
  retryOnUnauthorized = true,
): Promise<{ versions: string[]; manifest: AppBundleManifest }> {
  const api = new DefaultApi(
    new Configuration({ basePath: baseUrl, accessToken: token }),
  );
  try {
    const [vRes, mRes] = await Promise.all([
      api.getAppBundleVersions({ xOdeVersion: SYNKRONUS_CLIENT_VERSION }),
      api.getAppBundleManifest({ xOdeVersion: SYNKRONUS_CLIENT_VERSION }),
    ]);
    return { versions: vRes.versions ?? [], manifest: mRes };
  } catch (e) {
    if (retryOnUnauthorized && isUnauthorizedSynkError(e)) {
      const recovered = await recoverActiveProfileAuth();
      const nextToken = selectAuthSessionForActiveProfile(
        useCustodianStore.getState(),
      )?.token;
      if (recovered && nextToken) {
        return fetchServerBundleInfoFromApi(
          baseUrl,
          nextToken,
          recoverActiveProfileAuth,
          false,
        );
      }
    }
    throw e;
  }
}

export function WorkbenchBundlesPage() {
  const navigate = useNavigate();
  const active = useCustodianStore(selectActiveProfileState);
  useProfileAutoSynkAuth(active?.id);
  const recoverActiveProfileAuth = useCustodianStore(
    s => s.recoverActiveProfileAuth,
  );
  const setBundleActivity = useCustodianStore(s => s.setBundleActivity);
  const clearBundleActivity = useCustodianStore(s => s.clearBundleActivity);
  const [versions, setVersions] = useState<string[]>([]);
  const [manifest, setManifest] = useState<AppBundleManifest | null>(null);
  const [localState, setLocalState] = useState<AppBundleState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [zipLoading, setZipLoading] = useState(false);
  const [applyProgress, setApplyProgress] =
    useState<BundleApplyProgressPayload | null>(null);

  const baseUrl = (active?.serverUrl ?? '').trim().replace(/\/+$/, '');
  const busy = checking || zipLoading;

  const updateBundleActivity = useCallback(
    (p: BundleApplyProgressPayload) => {
      setApplyProgress(p);
      if (p.phase === 'failed') {
        setBundleActivity({
          jobId: p.jobId,
          statusText: bundleBannerLineFromProgress(p),
          done: p.done,
          total: p.total,
        });
        return;
      }
      if (p.phase === 'completed') {
        setBundleActivity({
          jobId: p.jobId,
          statusText: bundleBannerLineFromProgress(p),
          done: p.done,
          total: p.total,
        });
        return;
      }
      setBundleActivity({
        jobId: p.jobId,
        statusText: bundleBannerLineFromProgress(p),
        done: p.done,
        total: p.total,
      });
    },
    [setBundleActivity],
  );

  const loadLocalBundleState = useCallback(async () => {
    try {
      setLocalState(await tauriClient.getAppBundleState());
    } catch {
      setLocalState(null);
    }
  }, []);

  const fetchServerBundleInfo = useCallback(
    (token: string, retryOnUnauthorized = true) =>
      fetchServerBundleInfoFromApi(
        baseUrl,
        token,
        recoverActiveProfileAuth,
        retryOnUnauthorized,
      ),
    [baseUrl, recoverActiveProfileAuth],
  );

  const promptNavigateToProfiles = useCallback(
    async (body: string) => {
      await promptNavigateToProfilesForBundleAuth(body, navigate);
    },
    [navigate],
  );

  const ensureAuthForBundleOps = useCallback(async (): Promise<
    string | null
  > => {
    return ensureWorkbenchBundleAuth({
      active,
      baseUrl,
      onAuthRequired: promptNavigateToProfiles,
      messages: {
        noProfile:
          'Select a profile in Profiles before checking for app bundle updates.',
        noServerUrl:
          'Set a server URL for this profile in Profiles before checking for app bundle updates.',
        authFailed:
          'Could not sign in automatically. Open Profiles to authenticate (save a password or sign in manually).',
      },
    });
  }, [active, baseUrl, promptNavigateToProfiles]);

  const applyDownloadedBundle = useCallback(
    async (m: AppBundleManifest, token: string, skipConfirm: boolean) => {
      if (!skipConfirm) {
        if (
          !(await confirm(
            'Download and apply the active app bundle from the server?',
            { title: 'Download bundle', kind: 'warning' },
          ))
        ) {
          return;
        }
      }
      setZipLoading(true);
      setError(null);
      setApplyProgress(null);
      await ensureBundleApplyEventPipeline();
      setBundleApplyProgressHandler(updateBundleActivity);
      try {
        const result = await tauriClient.downloadAndApplyAppBundle({
          baseUrl,
          bearerToken: token,
          xOdeVersion: SYNKRONUS_CLIENT_VERSION,
          version: m.version,
          hash: m.hash,
        });
        setLocalState(result.state);
        setManifest(m);
        useCustodianStore.setState(s => ({
          devMirrorGeneration: s.devMirrorGeneration + 1,
        }));
        if (!result.indexRebuildScheduled) {
          clearBundleActivity();
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        clearBundleActivity();
      } finally {
        setZipLoading(false);
        setApplyProgress(null);
        setBundleApplyProgressHandler(null);
      }
    },
    [baseUrl, clearBundleActivity, updateBundleActivity],
  );

  async function checkForUpdatedBundle() {
    if (busy) {
      return;
    }
    setChecking(true);
    setError(null);
    try {
      const token = await ensureAuthForBundleOps();
      if (!token) {
        return;
      }
      const { versions: list, manifest: mRes } =
        await fetchServerBundleInfo(token);
      setVersions(list);
      setManifest(mRes);
      if (active?.id) {
        writeBundleCache(active.id, {
          versionsJson: JSON.stringify(list),
          fetchedAt: new Date().toISOString(),
        });
      }
      const local = await tauriClient.getAppBundleState();
      setLocalState(local);
      if (appBundleUpdateAvailable(mRes, local)) {
        const shouldDownload = await confirm(
          `A newer app bundle is available (version ${mRes.version}). Download and apply now?`,
          { title: 'App bundle update', kind: 'info' },
        );
        if (shouldDownload) {
          await applyDownloadedBundle(mRes, token, true);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setChecking(false);
    }
  }

  async function downloadAndApply() {
    const token = await ensureAuthForBundleOps();
    if (!token) {
      return;
    }
    let m = manifest;
    if (!m) {
      const fetched = await fetchServerBundleInfo(token);
      m = fetched.manifest;
      setVersions(fetched.versions);
      setManifest(m);
    }
    await applyDownloadedBundle(m, token, false);
  }

  useEffect(() => {
    if (active?.id) {
      const cached = readBundleCache(active.id);
      if (cached) {
        try {
          setVersions(JSON.parse(cached.versionsJson) as string[]);
        } catch {
          setVersions([]);
        }
      }
    }
  }, [active?.id]);

  useEffect(() => {
    void loadLocalBundleState();
  }, [loadLocalBundleState, active?.id]);

  const updateAvailable = appBundleUpdateAvailable(manifest, localState);

  return (
    <div className="page workbench-page">
      <header className="page-header page-header-inline">
        <h2>Bundles</h2>
        <div className="button-row">
          <button
            type="button"
            disabled={busy}
            onClick={() => void checkForUpdatedBundle()}>
            {checking ? 'Checking…' : 'Check for updated app bundle'}
          </button>
        </div>
      </header>

      {error ? <p className="notice error">{error}</p> : null}
      {updateAvailable ? (
        <p className="notice warn">
          Server bundle differs from local workspace.
        </p>
      ) : null}

      <div className="panel">
        <h3>Server</h3>
        {manifest ? (
          <table className="bundle-versions-table">
            <tbody>
              <tr>
                <th>Active version</th>
                <td>{manifest.version}</td>
                <td>
                  <button
                    type="button"
                    className="btn-compact"
                    disabled={busy}
                    onClick={() => void downloadAndApply()}>
                    {zipLoading
                      ? bundleButtonLabel(applyProgress)
                      : 'Download & apply'}
                  </button>
                </td>
              </tr>
              <tr>
                <th>Hash</th>
                <td colSpan={2} title={manifest.hash}>
                  {shortHash(manifest.hash)}
                </td>
              </tr>
            </tbody>
          </table>
        ) : (
          <p className="muted">
            {checking
              ? 'Checking server…'
              : 'Use “Check for updated app bundle” to load server version info.'}
          </p>
        )}
        {versions.length > 0 ? (
          <table
            className="bundle-versions-table"
            style={{ marginTop: '1rem' }}>
            <thead>
              <tr>
                <th>Versions on server</th>
                <th>Local archive</th>
              </tr>
            </thead>
            <tbody>
              {versions.map(v => (
                <tr key={v}>
                  <td>{v}</td>
                  <td>
                    {localState?.archivedVersions.includes(v) ? 'Yes' : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>

      <div className="panel">
        <h3>Local workspace</h3>
        {localState ? (
          <dl className="kv-grid">
            <dt>Version</dt>
            <dd>{localState.activeVersion}</dd>
            <dt>Hash</dt>
            <dd title={localState.activeHash}>
              {shortHash(localState.activeHash)}
            </dd>
            <dt>Downloaded</dt>
            <dd>{new Date(localState.downloadedAt).toLocaleString()}</dd>
          </dl>
        ) : (
          <p className="muted">No bundle applied yet.</p>
        )}
      </div>
    </div>
  );
}
