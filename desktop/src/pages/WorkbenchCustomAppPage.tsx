import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { message } from '@tauri-apps/plugin-dialog';
import { CustomAppDeviceViewport } from '../components/CustomAppDeviceViewport';
import { CustomAppEmbed } from '../components/CustomAppEmbed';
import { FormFinalizeDialog } from '../components/FormFinalizeDialog';
import { useDeveloperMode } from '../hooks/useDeveloperMode';
import { useProfileAutoSynkAuth } from '../hooks/useProfileAutoSynkAuth';
import { confirmDestructiveAction } from '../lib/destructivePolicy';
import type { FinalizeRequest } from '../lib/formPreviewBridge';
import { handleFormPreviewBridgeMessage } from '../lib/formPreviewBridge';
import { messageSourceMatchesIframe } from '../lib/iframeMessageSource';
import { isUnauthorizedSynkError } from '../lib/synkAuthErrors';
import { SYNKRONUS_CLIENT_VERSION } from '../lib/synkConstants';
import { tauriClient } from '../lib/tauriClient';
import { promptNavigateToProfilesForBundleAuth } from '../lib/workbenchBundleAuth';
import { WORKSPACE_BUNDLE_STATE_FILE } from '../lib/workspacePaths';
import {
  selectActiveProfileState,
  selectAuthSessionForActiveProfile,
  useCustodianStore,
} from '../store/useCustodianStore';
import type { AppBundleState } from '../types/domain';

export function WorkbenchCustomAppPage() {
  const navigate = useNavigate();
  const activeProfile = useCustodianStore(selectActiveProfileState);
  const { authSession, authBlocked, ensureAuth } = useProfileAutoSynkAuth(
    activeProfile?.id,
  );
  const recoverActiveProfileAuth = useCustodianStore(
    s => s.recoverActiveProfileAuth,
  );
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const customAppContentWindowRef = useRef<Window | null>(null);
  const finalizeResolverRef = useRef<
    ((v: { result?: string; error?: string }) => void) | null
  >(null);
  const [finalizeRequest, setFinalizeRequest] =
    useState<FinalizeRequest | null>(null);
  const [bundleState, setBundleState] = useState<AppBundleState | null>(null);
  const [bundleError, setBundleError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const {
    developerMode,
    devMirrorGeneration,
    devBusy,
    devError,
    localFolder,
    refreshDevApp,
  } = useDeveloperMode();

  const baseUrl = (activeProfile?.serverUrl ?? '').trim().replace(/\/+$/, '');
  const canShowUpdateServer = developerMode && Boolean(baseUrl);
  const updateServerDisabled =
    devBusy || uploading || !localFolder || devError != null;

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

  useEffect(() => {
    void loadBundleState();
  }, [loadBundleState]);

  useEffect(() => {
    setReloadToken(t => t + 1);
  }, [developerMode, devMirrorGeneration]);

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
      observationId?: string;
    }) => {
      const explicitId =
        typeof payload.observationId === 'string'
          ? payload.observationId.trim()
          : '';
      const sd = payload.savedData;
      const observationId =
        explicitId ||
        (typeof sd.observationId === 'string'
          ? sd.observationId
          : typeof sd.id === 'string'
            ? sd.id
            : '');
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
      const src = e.source;
      if (src == null || typeof src !== 'object') {
        return;
      }
      const winSrc = src as Window;
      if (
        !messageSourceMatchesIframe(
          winSrc,
          iframeRef.current,
          customAppContentWindowRef.current,
        )
      ) {
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

  const handleUpdateServer = useCallback(async () => {
    if (updateServerDisabled || uploading) {
      return;
    }
    setUploadError(null);

    if (!activeProfile) {
      await promptNavigateToProfilesForBundleAuth(
        'Select a profile in Profiles before updating the server bundle.',
        navigate,
      );
      return;
    }
    if (!baseUrl) {
      await promptNavigateToProfilesForBundleAuth(
        'Set a server URL for this profile in Profiles before updating the server bundle.',
        navigate,
      );
      return;
    }
    if (!(await ensureAuth())) {
      return;
    }

    if (
      !(await confirmDestructiveAction(
        'bundle_push',
        `Warning: This will update the custom_app on the server: ${baseUrl} to match the local developer version`,
      ))
    ) {
      return;
    }

    setUploading(true);
    try {
      await refreshDevApp();
      if (!(await ensureAuth())) {
        return;
      }
      let token = selectAuthSessionForActiveProfile(
        useCustodianStore.getState(),
      )?.token;
      if (!token) {
        return;
      }

      let result;
      try {
        result = await tauriClient.pushDevMirrorAppBundle({
          baseUrl,
          bearerToken: token,
          xOdeVersion: SYNKRONUS_CLIENT_VERSION,
        });
      } catch (e) {
        if (!isUnauthorizedSynkError(e)) {
          throw e;
        }
        const recovered = await recoverActiveProfileAuth();
        token = selectAuthSessionForActiveProfile(
          useCustodianStore.getState(),
        )?.token;
        if (!recovered || !token) {
          throw e;
        }
        result = await tauriClient.pushDevMirrorAppBundle({
          baseUrl,
          bearerToken: token,
          xOdeVersion: SYNKRONUS_CLIENT_VERSION,
        });
      }
      await message(
        `Server bundle updated to version ${result.version} (hash ${result.hash}).`,
        { title: 'Update server', kind: 'info' },
      );
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  }, [
    activeProfile,
    baseUrl,
    ensureAuth,
    navigate,
    recoverActiveProfileAuth,
    refreshDevApp,
    updateServerDisabled,
    uploading,
  ]);

  const embedMode = developerMode ? 'developer' : 'bundle';
  const mountKey = developerMode
    ? `dev-${localFolder}-${devMirrorGeneration}-${reloadToken}`
    : `${bundleState?.activeVersion ?? 'none'}-${reloadToken}`;

  const devBlocked = developerMode && (!localFolder || devError != null);
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
      {devError ? <p className="notice error">{devError}</p> : null}
      {bundleError ? <p className="notice error">{bundleError}</p> : null}
      {uploadError ? <p className="notice error">{uploadError}</p> : null}
      {developerMode && baseUrl && authBlocked && !authSession ? (
        <p className="notice warn">
          Not authenticated. <Link to="/data/profiles">Open Profiles</Link> to
          sign in.
        </p>
      ) : null}
      {developerMode ? (
        <div className="custom-app-bundle-row">
          <p className="muted custom-app-bundle-line">Devmode active.</p>
          {canShowUpdateServer ? (
            <button
              type="button"
              className="secondary"
              disabled={updateServerDisabled}
              onClick={() => void handleUpdateServer()}>
              {uploading ? 'Updating server…' : 'Update server'}
            </button>
          ) : null}
        </div>
      ) : bundleState ? (
        <div className="custom-app-bundle-row">
          <p className="muted custom-app-bundle-line">
            Active bundle <strong>{bundleState.activeVersion}</strong> (hash{' '}
            <code className="custom-app-hash">{bundleState.activeHash}</code>) —
            state file <code>{WORKSPACE_BUNDLE_STATE_FILE}</code>
          </p>
          <button
            type="button"
            className="secondary"
            disabled={!bundleState}
            onClick={() => setReloadToken(t => t + 1)}>
            Reload app
          </button>
        </div>
      ) : (
        <p className="muted">
          No local bundle state yet. Download an app bundle on the Bundles page.
        </p>
      )}

      {devBusy ? (
        <p className="muted">Syncing local custom app into workspace…</p>
      ) : null}

      <section className="panel panel-embed-flush custom-app-embed-panel">
        {canLoadEmbed ? (
          <CustomAppDeviceViewport>
            {({ fillFrame, devicePixelRatio }) => (
              <CustomAppEmbed
                ref={iframeRef}
                mountKey={mountKey}
                mode={embedMode}
                fillFrame={fillFrame}
                devicePixelRatio={devicePixelRatio}
                onContentWindowReady={cw => {
                  customAppContentWindowRef.current = cw;
                }}
              />
            )}
          </CustomAppDeviceViewport>
        ) : developerMode ? (
          <p className="notice warn">
            Configure developer mode on the Bundles page, then use Refresh app
            in the banner to load the custom app.
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
