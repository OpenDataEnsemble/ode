import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CustomAppDeviceViewport } from '../components/CustomAppDeviceViewport';
import { CustomAppEmbed } from '../components/CustomAppEmbed';
import { FormFinalizeDialog } from '../components/FormFinalizeDialog';
import { useDeveloperMode } from '../hooks/useDeveloperMode';
import type { FinalizeRequest } from '../lib/formPreviewBridge';
import { handleFormPreviewBridgeMessage } from '../lib/formPreviewBridge';
import { messageSourceMatchesIframe } from '../lib/iframeMessageSource';
import { tauriClient } from '../lib/tauriClient';
import { WORKSPACE_BUNDLE_STATE_FILE } from '../lib/workspacePaths';
import type { AppBundleState } from '../types/domain';

export function WorkbenchCustomAppPage() {
  const navigate = useNavigate();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const customAppContentWindowRef = useRef<Window | null>(null);
  const finalizeResolverRef = useRef<
    ((v: { result?: string; error?: string }) => void) | null
  >(null);
  const [finalizeRequest, setFinalizeRequest] =
    useState<FinalizeRequest | null>(null);
  const [bundleState, setBundleState] = useState<AppBundleState | null>(null);
  const [bundleError, setBundleError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const { developerMode, devMirrorGeneration, devBusy, devError, localFolder } =
    useDeveloperMode();

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
      <header className="page-header page-header-inline">
        <div>
          <h2>Custom app</h2>
        </div>
        {!developerMode ? (
          <div className="button-row">
            <button
              type="button"
              className="secondary"
              disabled={!bundleState}
              onClick={() => setReloadToken(t => t + 1)}>
              Reload app
            </button>
          </div>
        ) : null}
      </header>

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
              remains on disk for sync.
            </>
          ) : (
            <>
              Active bundle <strong>{bundleState.activeVersion}</strong> (hash{' '}
              <code className="custom-app-hash">{bundleState.activeHash}</code>)
              — state file <code>{WORKSPACE_BUNDLE_STATE_FILE}</code>
            </>
          )}
        </p>
      ) : !developerMode ? (
        <p className="muted">
          No local bundle state yet. Download an app bundle on the Bundles page.
        </p>
      ) : null}

      {devBusy ? (
        <p className="muted">Syncing local custom app into workspace…</p>
      ) : null}

      <section className="panel panel-embed-flush custom-app-embed-panel">
        {canLoadEmbed ? (
          <CustomAppDeviceViewport>
            {({ fillFrame }) => (
              <CustomAppEmbed
                ref={iframeRef}
                mountKey={mountKey}
                mode={embedMode}
                fillFrame={fillFrame}
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
