import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CustomAppEmbed } from '../components/CustomAppEmbed';
import { FormFinalizeDialog } from '../components/FormFinalizeDialog';
import type { FinalizeRequest } from '../lib/formPreviewBridge';
import { handleFormPreviewBridgeMessage } from '../lib/formPreviewBridge';
import { tauriClient } from '../lib/tauriClient';
import { WORKSPACE_BUNDLE_STATE_FILE } from '../lib/workspacePaths';
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
      void handleFormPreviewBridgeMessage(e.data, {
        iframe: iframeRef.current,
        onFinalize,
        onOpenFormplayerNavigate,
      });
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onFinalize, onOpenFormplayerNavigate]);

  const mountKey = `${bundleState?.activeVersion ?? 'none'}-${reloadToken}`;

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
            className="secondary"
            onClick={() => void loadBundleState()}>
            Refresh status
          </button>
          <button
            type="button"
            className="secondary"
            disabled={!bundleState}
            onClick={() => setReloadToken(t => t + 1)}>
            Reload app
          </button>
        </div>
      </header>

      {bundleError ? (
        <p className="notice error">{bundleError}</p>
      ) : bundleState ? (
        <p className="muted custom-app-bundle-line">
          Active bundle <strong>{bundleState.activeVersion}</strong> (hash{' '}
          <code className="custom-app-hash">{bundleState.activeHash}</code>) —
          state file <code>{WORKSPACE_BUNDLE_STATE_FILE}</code>
        </p>
      ) : (
        <p className="muted">
          No local bundle state yet. Download an app bundle on the Bundles page.
        </p>
      )}

      <section className="card custom-app-embed-panel">
        <CustomAppEmbed ref={iframeRef} mountKey={mountKey} />
      </section>
    </div>
  );
}
