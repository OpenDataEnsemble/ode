import { useCallback, useEffect, useState } from 'react';
import {
  Configuration,
  DefaultApi,
  type AppBundleManifest,
} from '../generated/synkronus-client';
import { DeveloperModePanel } from '../components/DeveloperModePanel';
import {
  appBundleUpdateAvailable,
  serverVersionsNotDownloaded,
} from '../lib/appBundleStatus';
import { readBundleCache, writeBundleCache } from '../lib/bundleCacheMeta';
import { SYNKRONUS_CLIENT_VERSION } from '../lib/synkConstants';
import { tauriClient } from '../lib/tauriClient';
import {
  WORKSPACE_BUNDLE_ACTIVE_DIR,
  WORKSPACE_BUNDLE_ARCHIVES_DIR,
} from '../lib/workspacePaths';
import {
  selectActiveProfileState,
  selectAuthSessionForActiveProfile,
  useCustodianStore,
} from '../store/useCustodianStore';
import type { AppBundleState } from '../types/domain';

function shortHash(h: string, n = 12): string {
  if (h.length <= n) {
    return h;
  }
  return `${h.slice(0, n)}…`;
}

export function WorkbenchBundlesPage() {
  const active = useCustodianStore(selectActiveProfileState);
  const auth = useCustodianStore(selectAuthSessionForActiveProfile);
  const [versions, setVersions] = useState<string[]>([]);
  const [manifest, setManifest] = useState<AppBundleManifest | null>(null);
  const [localState, setLocalState] = useState<AppBundleState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [zipLoading, setZipLoading] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  const baseUrl = (active?.serverUrl ?? '').trim().replace(/\/+$/, '');

  const loadLocalBundleState = useCallback(async () => {
    try {
      const s = await tauriClient.getAppBundleState();
      setLocalState(s);
    } catch {
      setLocalState(null);
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!auth?.token || !baseUrl) {
      setError('Authenticate in Profiles with a server URL for this profile.');
      setVersions([]);
      setManifest(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const api = new DefaultApi(
        new Configuration({
          basePath: baseUrl,
          accessToken: auth.token,
        }),
      );
      const [vRes, mRes] = await Promise.all([
        api.getAppBundleVersions({
          xOdeVersion: SYNKRONUS_CLIENT_VERSION,
        }),
        api.getAppBundleManifest({
          xOdeVersion: SYNKRONUS_CLIENT_VERSION,
        }),
      ]);
      const list = vRes.versions ?? [];
      setVersions(list);
      setManifest(mRes);
      if (active?.id) {
        writeBundleCache(active.id, {
          versionsJson: JSON.stringify(list),
          fetchedAt: new Date().toISOString(),
        });
      }
      await loadLocalBundleState();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setVersions([]);
      setManifest(null);
    } finally {
      setLoading(false);
    }
  }, [auth?.token, baseUrl, active?.id, loadLocalBundleState]);

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

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const updateAvailable = appBundleUpdateAvailable(manifest, localState);
  const notDownloaded = serverVersionsNotDownloaded(
    versions,
    localState?.archivedVersions ?? [],
  );

  async function downloadAndApply() {
    if (!auth?.token || !baseUrl) {
      setError('Authenticate first.');
      return;
    }
    const tier = active?.environment ?? 'production';
    if (
      tier === 'production' &&
      !window.confirm(
        'Download the active app bundle from the production server, replace the extracted copy under this profile’s workspace, and add the ZIP to the local archive?',
      )
    ) {
      return;
    }
    setZipLoading(true);
    setError(null);
    setSaveNotice(null);
    try {
      const api = new DefaultApi(
        new Configuration({
          basePath: baseUrl,
          accessToken: auth.token,
        }),
      );
      const m =
        manifest ??
        (await api.getAppBundleManifest({
          xOdeVersion: SYNKRONUS_CLIENT_VERSION,
        }));
      const blob = await api.downloadAppBundleZip({
        xOdeVersion: SYNKRONUS_CLIENT_VERSION,
      });
      const buf = new Uint8Array(await blob.arrayBuffer());
      const state = await tauriClient.applyAppBundleDownload({
        version: m.version,
        hash: m.hash,
        zipBytes: buf,
      });
      setLocalState(state);
      setManifest(m);
      setSaveNotice(
        `Applied version ${state.activeVersion} — extracted to ${WORKSPACE_BUNDLE_ACTIVE_DIR}, archive under ${WORKSPACE_BUNDLE_ARCHIVES_DIR}.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setZipLoading(false);
    }
  }

  return (
    <div className="page workbench-page">
      <header className="page-header page-header-inline">
        <div>
          <h2>Bundles</h2>
          <p className="page-lead">
            Per profile, Synkronus app bundles are stored under that profile’s
            workspace: versioned ZIPs in{' '}
            <code>{WORKSPACE_BUNDLE_ARCHIVES_DIR}</code>, and the currently
            active bundle extracted to{' '}
            <code>{WORKSPACE_BUNDLE_ACTIVE_DIR}</code> (previous extraction is
            removed before unpacking a new download). Switching profiles uses
            each profile’s own workspace paths.
          </p>
        </div>
        <div className="button-row">
          <button
            type="button"
            disabled={loading}
            onClick={() => void refresh()}>
            {loading ? 'Refreshing…' : 'Refresh from server'}
          </button>
          <button
            type="button"
            className="secondary"
            disabled={zipLoading || !auth}
            onClick={() => void downloadAndApply()}>
            {zipLoading
              ? 'Downloading…'
              : updateAvailable
                ? 'Download and apply latest bundle…'
                : 'Re-download and apply bundle…'}
          </button>
        </div>
      </header>

      {error ? <p className="notice error">{error}</p> : null}
      {saveNotice ? <p className="notice success">{saveNotice}</p> : null}

      <DeveloperModePanel variant="full" />

      <section className="card">
        <h3>Server (active bundle)</h3>
        {manifest ? (
          <div className="bundle-facts">
            <p>
              <strong>Version</strong> {manifest.version}
            </p>
            <p>
              <strong>Hash</strong>{' '}
              <span title={manifest.hash}>{shortHash(manifest.hash)}</span>
            </p>
            <p>
              <strong>Generated</strong>{' '}
              {manifest.generatedAt instanceof Date
                ? manifest.generatedAt.toLocaleString()
                : String(manifest.generatedAt)}
            </p>
          </div>
        ) : (
          <p className="muted">
            {loading ? 'Loading manifest…' : 'No manifest yet.'}
          </p>
        )}
        {updateAvailable ? (
          <p className="notice warn">
            Update available: server active bundle differs from the last bundle
            applied in this workspace (or nothing applied yet).
          </p>
        ) : manifest && localState ? (
          <p className="muted small-hint">
            Local workspace matches this server manifest version and hash.
          </p>
        ) : null}
      </section>

      <section className="card">
        <h3>This profile’s workspace</h3>
        {localState ? (
          <div className="bundle-facts">
            <p>
              <strong>Applied version</strong> {localState.activeVersion}
            </p>
            <p>
              <strong>Applied hash</strong>{' '}
              <span title={localState.activeHash}>
                {shortHash(localState.activeHash)}
              </span>
            </p>
            <p>
              <strong>Downloaded at</strong>{' '}
              {new Date(localState.downloadedAt).toLocaleString()}
            </p>
            <p>
              <strong>Archived versions (ZIPs kept)</strong>{' '}
              {localState.archivedVersions.length === 0 ? (
                <span className="muted">None yet</span>
              ) : (
                <span>{localState.archivedVersions.join(', ')}</span>
              )}
            </p>
          </div>
        ) : (
          <p className="muted">
            No bundle state on disk for this workspace yet.
          </p>
        )}
      </section>

      <section className="card">
        <h3>Versions on server</h3>
        {versions.length === 0 && !loading ? (
          <p className="muted">No versions loaded yet.</p>
        ) : (
          <ul className="list-plain">
            {versions.map(v => {
              const have = localState?.archivedVersions.includes(v) ?? false;
              return (
                <li key={v}>
                  {v}
                  {have ? (
                    <span className="muted"> — archived locally</span>
                  ) : (
                    <span className="muted">
                      {' '}
                      — not downloaded in this workspace
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {notDownloaded.length > 0 ? (
          <p className="muted small-hint">
            Some server versions are not in the local archive yet. Only the
            server&apos;s <strong>active</strong> bundle can be downloaded with
            the current API; applying it adds that version to the archive and
            extracts it.
          </p>
        ) : null}
        {active?.id ? (
          <p className="muted small-hint">
            Version list metadata is cached in browser storage for this profile.
          </p>
        ) : null}
      </section>
    </div>
  );
}
