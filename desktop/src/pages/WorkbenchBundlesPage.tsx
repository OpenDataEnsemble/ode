import { useCallback, useEffect, useState } from 'react';
import { confirm } from '@tauri-apps/plugin-dialog';
import {
  Configuration,
  DefaultApi,
  type AppBundleManifest,
} from '../generated/synkronus-client';
import { appBundleUpdateAvailable } from '../lib/appBundleStatus';
import { readBundleCache, writeBundleCache } from '../lib/bundleCacheMeta';
import { SYNKRONUS_CLIENT_VERSION } from '../lib/synkConstants';
import { tauriClient } from '../lib/tauriClient';
import {
  selectActiveProfileState,
  selectAuthSessionForActiveProfile,
  useCustodianStore,
} from '../store/useCustodianStore';
import type { AppBundleState } from '../types/domain';

function shortHash(h: string, n = 10): string {
  if (h.length <= n) return h;
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

  const baseUrl = (active?.serverUrl ?? '').trim().replace(/\/+$/, '');

  const loadLocalBundleState = useCallback(async () => {
    try {
      setLocalState(await tauriClient.getAppBundleState());
    } catch {
      setLocalState(null);
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!auth?.token || !baseUrl) {
      setError('Authenticate in Profiles first.');
      setVersions([]);
      setManifest(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const api = new DefaultApi(
        new Configuration({ basePath: baseUrl, accessToken: auth.token }),
      );
      const [vRes, mRes] = await Promise.all([
        api.getAppBundleVersions({ xOdeVersion: SYNKRONUS_CLIENT_VERSION }),
        api.getAppBundleManifest({ xOdeVersion: SYNKRONUS_CLIENT_VERSION }),
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
  }, [auth, baseUrl, active, loadLocalBundleState]);

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

  async function downloadAndApply() {
    if (!auth?.token || !baseUrl) {
      setError('Authenticate first.');
      return;
    }
    if (
      !(await confirm(
        'Download and apply the active app bundle from the server?',
        { title: 'Download bundle', kind: 'warning' },
      ))
    ) {
      return;
    }
    setZipLoading(true);
    setError(null);
    try {
      const api = new DefaultApi(
        new Configuration({ basePath: baseUrl, accessToken: auth.token }),
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
      useCustodianStore.setState(s => ({
        devMirrorGeneration: s.devMirrorGeneration + 1,
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setZipLoading(false);
    }
  }

  return (
    <div className="page workbench-page">
      <header className="page-header page-header-inline">
        <h2>Bundles</h2>
        <div className="button-row">
          <button
            type="button"
            disabled={loading}
            onClick={() => void refresh()}>
            {loading ? 'Refreshing…' : 'Refresh from server'}
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
                    disabled={zipLoading || !auth}
                    onClick={() => void downloadAndApply()}>
                    {zipLoading ? 'Downloading…' : 'Download & apply'}
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
          <p className="muted">{loading ? 'Loading…' : 'No manifest.'}</p>
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
