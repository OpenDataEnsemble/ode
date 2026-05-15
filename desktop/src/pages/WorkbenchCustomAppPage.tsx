import { open } from '@tauri-apps/plugin-dialog';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CustomAppEmbed } from '../components/CustomAppEmbed';
import { FormFinalizeDialog } from '../components/FormFinalizeDialog';
import type { FinalizeRequest } from '../lib/formPreviewBridge';
import { handleFormPreviewBridgeMessage } from '../lib/formPreviewBridge';
import { tauriClient } from '../lib/tauriClient';
import { WORKSPACE_BUNDLE_STATE_FILE } from '../lib/workspacePaths';
import {
  selectActiveProfileState,
  useCustodianStore,
} from '../store/useCustodianStore';
import type { AppBundleState } from '../types/domain';

export function WorkbenchCustomAppPage() {
  const navigate = useNavigate();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const finalizeResolverRef = useRef<
    ((v: { result?: string; error?: string }) => void) | null
  >(null);
  const [finalizeRequest, setFinalizeRequest] =
    useState<FinalizeRequest | null>(null);
  const [bundleState, setBundleState] = useState<AppBundleState | null>(null);
  const [bundleError, setBundleError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [mirrorToken, setMirrorToken] = useState(0);
  const [devError, setDevError] = useState<string | null>(null);
  const [devBusy, setDevBusy] = useState(false);

  const activeProfile = useCustodianStore(selectActiveProfileState);
  const upsertProfileRemote = useCustodianStore(s => s.upsertProfileRemote);

  const developerMode = Boolean(activeProfile?.customAppDeveloperMode);
  const localFolder = (activeProfile?.customAppLocalFolder ?? '').trim();

  const loadBundleState = useCallback(async () => {
    try {
      const s = await tauriClient.getAppBundleState();
      setBundleState(s);
      setBundleError(null);
    } catch (e) {
      setBundleState(null);
      setBundleError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const refreshDevMirror = useCallback(async () => {
    setDevBusy(true);
    try {
      await tauriClient.refreshCustomAppDevMirror();
      setDevError(null);
      setMirrorToken(t => t + 1);
      return true;
    } catch (e) {
      setDevError(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setDevBusy(false);
    }
  }, []);

  useEffect(() => {
    void loadBundleState();
  }, [loadBundleState]);

  useEffect(() => {
    if (!developerMode) {
      setDevError(null);
      return;
    }
    if (!localFolder) {
      setDevError(
        'Developer mode is on but no local custom app folder is configured.',
      );
      return;
    }
    void refreshDevMirror();
  }, [developerMode, localFolder, activeProfile?.id, refreshDevMirror]);

  const onFinalize = useCallback((request: FinalizeRequest) => {
    return new Promise<{ result?: string; error?: string }>(resolve => {
      setFinalizeRequest(request);
      finalizeResolverRef.current = resolve;
    });
  }, []);

  const onOpenFormplayerNavigate = useCallback(
    (payload: {
      formType: string;
      params: Record<string, unknown>;
      savedData: Record<string, unknown>;
    }) => {
      const sd = payload.savedData;
      const observationId =
        typeof sd.observationId === 'string'
          ? sd.observationId
          : typeof sd.id === 'string'
            ? sd.id
            : '';
      navigate('/workbench/form-preview', {
        state: {
          formPreviewEdit: {
            formType: payload.formType,
            observationId,
            params: payload.params,
            savedData: payload.savedData,
          },
        },
      });
    },
    [navigate],
  );

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== iframeRef.current?.contentWindow) {
        return;
      }
      void handleFormPreviewBridgeMessage(e, {
        iframe: iframeRef.current,
        onFinalize,
        onOpenFormplayerNavigate,
      });
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onFinalize, onOpenFormplayerNavigate]);

  const persistProfilePatch = useCallback(
    async (
      patch: Partial<{
        customAppDeveloperMode: boolean | null;
        customAppLocalFolder: string | null;
      }>,
    ) => {
      if (!activeProfile) {
        return;
      }
      await upsertProfileRemote({ ...activeProfile, ...patch });
    },
    [activeProfile, upsertProfileRemote],
  );

  const toggleDeveloperMode = useCallback(async () => {
    if (!activeProfile) {
      return;
    }
    const next = !developerMode;
    await persistProfilePatch({ customAppDeveloperMode: next });
    if (!next) {
      setDevError(null);
      setReloadToken(t => t + 1);
    }
  }, [activeProfile, developerMode, persistProfilePatch]);

  const pickLocalFolder = useCallback(async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: 'Select local custom app folder',
    });
    if (selected == null || Array.isArray(selected)) {
      return;
    }
    await persistProfilePatch({
      customAppLocalFolder: selected,
      customAppDeveloperMode: true,
    });
  }, [persistProfilePatch]);

  const onRefreshDev = useCallback(async () => {
    const ok = await refreshDevMirror();
    if (ok) {
      setReloadToken(t => t + 1);
    }
  }, [refreshDevMirror]);

  const embedMode = developerMode ? 'developer' : 'bundle';
  const mountKey = developerMode
    ? `dev-${localFolder}-${mirrorToken}-${reloadToken}`
    : `${bundleState?.activeVersion ?? 'none'}-${reloadToken}`;

  const devBlocked =
    developerMode && (!localFolder || devError != null);
  const canLoadEmbed = developerMode
    ? !devBlocked && !devBusy
    : Boolean(bundleState);

  return (
    <div className="page workbench-page page-custom-app">
      <FormFinalizeDialog
        open={finalizeRequest !== null}
        request={finalizeRequest}
        onComplete={result => {
          finalizeResolverRef.current?.(result);
          finalizeResolverRef.current = null;
          setFinalizeRequest(null);
        }}
      />
      <header className="page-header page-header-inline">
        <div>
          <h2>Custom app</h2>
        </div>
        <div className="button-row">
          <button
            type="button"
            className={`secondary${developerMode ? ' mode-switch-btn-active' : ''}`}
            aria-pressed={developerMode}
            disabled={!activeProfile || devBusy}
            onClick={() => void toggleDeveloperMode()}>
            Developer mode
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => void loadBundleState()}>
            Refresh status
          </button>
          {developerMode ? (
            <button
              type="button"
              className="secondary"
              disabled={!localFolder || devBusy}
              onClick={() => void onRefreshDev()}>
              Refresh
            </button>
          ) : (
            <button
              type="button"
              className="secondary"
              disabled={!bundleState}
              onClick={() => setReloadToken(t => t + 1)}>
              Reload app
            </button>
          )}
          {developerMode ? (
            <button
              type="button"
              className="secondary"
              disabled={!canLoadEmbed || devBusy}
              onClick={() => setReloadToken(t => t + 1)}>
              Reload app
            </button>
          ) : null}
        </div>
      </header>

      <section className="card custom-app-dev-panel">
        <label
          className="custom-app-dev-folder-label"
          htmlFor="custom-app-local-folder">
          Local custom_app folder
        </label>
        <div className="custom-app-dev-folder-row">
          <input
            id="custom-app-local-folder"
            type="text"
            className="custom-app-dev-folder-input"
            readOnly
            disabled={!developerMode}
            value={localFolder}
            placeholder={
              developerMode
                ? 'Pick a folder that contains index.html (e.g. dist/)'
                : 'Enable Developer mode to select a folder'
            }
          />
          <button
            type="button"
            className="secondary"
            disabled={!developerMode || devBusy}
            onClick={() => void pickLocalFolder()}>
            Browse…
          </button>
        </div>
        {developerMode ? (
          <p className="muted custom-app-dev-hint">
            The app is mirrored into your profile workspace. Observations and sync
            still use this profile&apos;s database and downloaded bundle forms.
          </p>
        ) : null}
      </section>

      {devError ? <p className="notice error">{devError}</p> : null}
      {bundleError ? (
        <p className="notice error">{bundleError}</p>
      ) : bundleState ? (
        <p className="muted custom-app-bundle-line">
          {developerMode ? (
            <>
              Developer mirror active — downloaded bundle{' '}
              <strong>{bundleState.activeVersion}</strong> (hash{' '}
              <code className="custom-app-hash">{bundleState.activeHash}</code>)
              remains on disk for forms/sync.
            </>
          ) : (
            <>
              Active bundle <strong>{bundleState.activeVersion}</strong> (hash{' '}
              <code className="custom-app-hash">{bundleState.activeHash}</code>) —
              state file <code>{WORKSPACE_BUNDLE_STATE_FILE}</code>
            </>
          )}
        </p>
      ) : (
        <p className="muted">
          No local bundle state yet. Download an app bundle on the Bundles page.
        </p>
      )}

      {devBusy ? (
        <p className="muted">Syncing local custom app into workspace…</p>
      ) : null}

      <section className="card custom-app-embed-panel">
        {canLoadEmbed ? (
          <CustomAppEmbed
            ref={iframeRef}
            mountKey={mountKey}
            mode={embedMode}
          />
        ) : developerMode ? (
          <p className="notice warn">
            Configure a valid local folder and use Refresh to load the custom app.
          </p>
        ) : (
          <p className="notice warn">
            Download an app bundle on the Bundles page to load the custom app.
          </p>
        )}
      </section>
    </div>
  );
}
