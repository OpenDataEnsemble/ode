import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FormFinalizeDialog } from '../components/FormFinalizeDialog';
import { FormplayerEmbed } from '../components/FormplayerEmbed';
import {
  buildFormPreviewInit,
  inferObservationIdFromSavedData,
  parseJsonObject,
} from '../lib/buildFormPreviewInit';
import { bundleFormsRel } from '../lib/bundleLayout';
import { loadBundleFormplayerExtensions } from '../lib/bundleExtensionLoader';
import { useDeveloperMode } from '../hooks/useDeveloperMode';
import type { FinalizeRequest } from '../lib/formPreviewBridge';
import {
  handleFormPreviewBridgeMessage,
  postFormplayerBridgeReply,
  type FormPreviewDeferOpenSubObservationPayload,
} from '../lib/formPreviewBridge';
import type { FormPreviewEditState } from '../lib/formPreviewNavigation';
import { tauriClient } from '../lib/tauriClient';
import { WORKSPACE_BUNDLE_ACTIVE_DIR } from '../lib/workspacePaths';
import type { FormInitData } from '../lib/formplayerHost';
import type { ActiveBundleFormEntry, BundleFormSpec } from '../types/domain';

const DEFAULT_JSON = '{}';

/**
 * WebKit / WCO (Tauri): `MessageEvent.source` may not be strictly `===` to
 * `iframe.contentWindow`, and `instanceof Window` can be false for iframe globals.
 * `window.frameElement === iframe` identifies the embedding element reliably for same-origin frames.
 */
function messageSourceMatchesIframe(
  source: Window,
  iframe: HTMLIFrameElement | null | undefined,
): boolean {
  if (!iframe) {
    return false;
  }
  try {
    if (iframe.contentWindow === source) {
      return true;
    }
    return source.frameElement === iframe;
  } catch {
    return false;
  }
}

type LocationState = {
  formPreviewEdit?: FormPreviewEditState;
};

type NestedSubObservationSession = {
  parentIframe: HTMLIFrameElement;
  parentMessageId: string;
  formType: string;
  /** Null while bundle init is loading */
  initData: FormInitData | null;
};

export function FormPreviewPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { developerMode, devMirrorGeneration } = useDeveloperMode();
  const formsBundlePath = bundleFormsRel(developerMode);

  const [forms, setForms] = useState<ActiveBundleFormEntry[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(true);

  const [selectedFormType, setSelectedFormType] = useState('');
  const [spec, setSpec] = useState<BundleFormSpec | null>(null);
  const [specError, setSpecError] = useState<string | null>(null);
  const [specLoading, setSpecLoading] = useState(false);

  const [paramsJson, setParamsJson] = useState(DEFAULT_JSON);
  const [savedJson, setSavedJson] = useState(DEFAULT_JSON);
  const [parseError, setParseError] = useState<string | null>(null);

  /** When non-null, preview is editing an existing observation (Finalize → update). */
  const [previewObservationId, setPreviewObservationId] = useState<
    string | null
  >(null);

  const [formInitData, setFormInitData] = useState<FormInitData | null>(null);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const finalizeResolverRef = useRef<
    ((v: { result?: string; error?: string }) => void) | null
  >(null);
  const [finalizeRequest, setFinalizeRequest] =
    useState<FinalizeRequest | null>(null);

  const [nestedSessions, setNestedSessions] = useState<
    NestedSubObservationSession[]
  >([]);
  const nestedSessionsRef = useRef<NestedSubObservationSession[]>([]);
  const nestedIframeByMessageIdRef = useRef<
    Map<string, HTMLIFrameElement | null>
  >(new Map());

  useEffect(() => {
    nestedSessionsRef.current = nestedSessions;
  }, [nestedSessions]);

  const loadForms = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const rows = await tauriClient.listActiveBundleForms();
      setForms(rows);
    } catch (e) {
      setListError(e instanceof Error ? e.message : String(e));
      setForms([]);
    } finally {
      setListLoading(false);
    }
  }, [devMirrorGeneration]);

  useEffect(() => {
    void loadForms();
  }, [loadForms]);

  const buildInitFromSpec = useCallback(
    async (
      s: BundleFormSpec,
      params: Record<string, unknown>,
      savedData: Record<string, unknown>,
      observationId: string | null,
    ) => {
      const ext = await loadBundleFormplayerExtensions(
        s.formType,
        developerMode,
      );
      return buildFormPreviewInit({
        formType: s.formType,
        observationId,
        params,
        savedData,
        formSchema: s.formSchema,
        uiSchema: s.uiSchema,
        extensions: ext.extensions,
        customQuestionTypes: ext.customQuestionTypes,
      });
    },
    [developerMode],
  );

  const loadSpec = useCallback(
    async (formType: string) => {
      if (!formType.trim()) {
        setSpec(null);
        setSpecError(null);
        setFormInitData(null);
        setPreviewObservationId(null);
        return;
      }
      setSpecLoading(true);
      setSpecError(null);
      setPreviewObservationId(null);
      try {
        const s = await tauriClient.readBundleFormSpec(formType);
        setSpec(s);
        setParamsJson(DEFAULT_JSON);
        setSavedJson(DEFAULT_JSON);
        setParseError(null);
        const p = parseJsonObject(DEFAULT_JSON, 'params');
        const sv = parseJsonObject(DEFAULT_JSON, 'savedData');
        if (!p.ok) {
          setParseError(p.error);
          setFormInitData(null);
          return;
        }
        if (!sv.ok) {
          setParseError(sv.error);
          setFormInitData(null);
          return;
        }
        setFormInitData(await buildInitFromSpec(s, p.value, sv.value, null));
      } catch (e) {
        setSpec(null);
        setFormInitData(null);
        setSpecError(e instanceof Error ? e.message : String(e));
      } finally {
        setSpecLoading(false);
      }
    },
    [buildInitFromSpec],
  );

  useEffect(() => {
    const previewEdit = (location.state as LocationState | null)
      ?.formPreviewEdit;
    if (!previewEdit || !previewEdit.formType.trim()) {
      return;
    }
    const formType = previewEdit.formType;
    const observationId = previewEdit.observationId;
    const params = previewEdit.params ?? {};
    const savedData = previewEdit.savedData ?? {};

    let cancelled = false;
    async function run() {
      setSelectedFormType(formType);
      setSpecLoading(true);
      setSpecError(null);
      setParseError(null);
      try {
        const s = await tauriClient.readBundleFormSpec(formType);
        if (cancelled) {
          return;
        }
        setSpec(s);
        setParamsJson(JSON.stringify(params, null, 2));
        setSavedJson(JSON.stringify(savedData, null, 2));
        setPreviewObservationId(observationId);
        setFormInitData(
          await buildInitFromSpec(s, params, savedData, observationId),
        );
      } catch (e) {
        if (!cancelled) {
          setSpec(null);
          setFormInitData(null);
          setPreviewObservationId(null);
          setSpecError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (!cancelled) {
          setSpecLoading(false);
          navigate(location.pathname, { replace: true, state: null });
        }
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [buildInitFromSpec, location.pathname, location.state, navigate]);

  const applyJsonToPreview = useCallback(async () => {
    if (!spec) {
      return;
    }
    const p = parseJsonObject(paramsJson, 'params');
    const sv = parseJsonObject(savedJson, 'savedData');
    if (!p.ok) {
      setParseError(p.error);
      return;
    }
    if (!sv.ok) {
      setParseError(sv.error);
      return;
    }
    setParseError(null);
    setFormInitData(
      await buildInitFromSpec(spec, p.value, sv.value, previewObservationId),
    );
  }, [paramsJson, savedJson, spec, buildInitFromSpec, previewObservationId]);

  const onFinalize = useCallback((request: FinalizeRequest) => {
    return new Promise<{ result?: string; error?: string }>(resolve => {
      setFinalizeRequest(request);
      finalizeResolverRef.current = resolve;
    });
  }, []);

  const dismissTopNestedSession = useCallback(() => {
    setNestedSessions(prev => {
      const top = prev[prev.length - 1];
      if (!top) {
        return prev;
      }
      postFormplayerBridgeReply(
        top.parentIframe,
        'openFormplayer',
        top.parentMessageId,
        {
          result: {
            status: 'cancelled',
            formType: top.formType,
          },
        },
      );
      nestedIframeByMessageIdRef.current.delete(top.parentMessageId);
      return prev.slice(0, -1);
    });
  }, []);

  const beginDeferredNestedOpen = useCallback(
    (payload: FormPreviewDeferOpenSubObservationPayload) => {
      const { parentIframe, messageId, formType, params, savedData } = payload;
      setNestedSessions(prev => [
        ...prev,
        {
          parentIframe,
          parentMessageId: messageId,
          formType,
          initData: null,
        },
      ]);
      void (async () => {
        try {
          const s = await tauriClient.readBundleFormSpec(formType);
          const ext = await loadBundleFormplayerExtensions(
            formType,
            developerMode,
          );
          const observationId = inferObservationIdFromSavedData(savedData);
          const initData = buildFormPreviewInit({
            formType,
            observationId,
            params,
            savedData,
            formSchema: s.formSchema,
            uiSchema: s.uiSchema,
            extensions: ext.extensions,
            customQuestionTypes: ext.customQuestionTypes,
            subObservationMode: true,
          });
          setNestedSessions(prev =>
            prev.map(sess =>
              sess.parentMessageId === messageId ? { ...sess, initData } : sess,
            ),
          );
        } catch (e) {
          postFormplayerBridgeReply(parentIframe, 'openFormplayer', messageId, {
            result: {
              status: 'error',
              formType,
              message: e instanceof Error ? e.message : String(e),
            },
          });
          nestedIframeByMessageIdRef.current.delete(messageId);
          setNestedSessions(prev =>
            prev.filter(sess => sess.parentMessageId !== messageId),
          );
        }
      })();
    },
    [],
  );

  const tryCompleteNestedSubObservationFinalize = useCallback(
    async (
      eventSource: Window,
      request: FinalizeRequest,
    ): Promise<{ result?: string; error?: string } | null> => {
      const stack = nestedSessionsRef.current;
      const top = stack[stack.length - 1];
      if (!top?.initData) {
        return null;
      }
      const topEl = nestedIframeByMessageIdRef.current.get(top.parentMessageId);
      if (!messageSourceMatchesIframe(eventSource, topEl)) {
        return null;
      }

      const syntheticResult =
        request.kind === 'update' ? request.observationId : crypto.randomUUID();

      const completion =
        request.kind === 'update'
          ? {
              status: 'form_updated' as const,
              formType: top.formType,
              observationId: request.observationId,
              formData: request.finalData,
            }
          : {
              status: 'form_submitted' as const,
              formType: top.formType,
              formData: request.finalData,
            };

      postFormplayerBridgeReply(
        top.parentIframe,
        'openFormplayer',
        top.parentMessageId,
        { result: completion },
      );

      nestedIframeByMessageIdRef.current.delete(top.parentMessageId);
      setNestedSessions(prev => prev.slice(0, -1));

      return { result: syntheticResult };
    },
    [],
  );

  const resolveReplyIframe = useCallback((source: Window) => {
    if (messageSourceMatchesIframe(source, iframeRef.current)) {
      return iframeRef.current;
    }
    for (const s of nestedSessionsRef.current) {
      const el = nestedIframeByMessageIdRef.current.get(s.parentMessageId);
      if (messageSourceMatchesIframe(source, el)) {
        return el ?? null;
      }
    }
    return null;
  }, []);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const src = e.source;
      if (src == null || typeof src !== 'object') {
        return;
      }
      const winSrc = src as Window;
      if (!resolveReplyIframe(winSrc)) {
        return;
      }
      void handleFormPreviewBridgeMessage(e, {
        iframe: iframeRef.current,
        resolveReplyIframe,
        onFinalize,
        onDeferOpenSubObservation: beginDeferredNestedOpen,
        tryCompleteNestedSubObservationFinalize,
      });
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [
    beginDeferredNestedOpen,
    onFinalize,
    resolveReplyIframe,
    tryCompleteNestedSubObservationFinalize,
  ]);

  const formOptions = forms.map(f => (
    <option key={f.formType} value={f.formType}>
      {f.formType}
    </option>
  ));

  return (
    <div className="page workbench-page page-form-preview">
      <FormFinalizeDialog
        open={finalizeRequest !== null}
        request={finalizeRequest}
        onComplete={result => {
          finalizeResolverRef.current?.(result);
          finalizeResolverRef.current = null;
          setFinalizeRequest(null);
        }}
      />

      {nestedSessions.length > 0 ? (
        <div className="form-preview-nested-overlay-root">
          {nestedSessions.map((session, idx) => (
            <div
              key={session.parentMessageId}
              className="form-preview-nested-layer"
              style={{ zIndex: 200 + idx }}>
              <div className="form-preview-nested-layer-inner card">
                <div className="form-preview-nested-toolbar">
                  <span className="muted">
                    Sub-observation ({session.formType})
                  </span>
                  <button
                    type="button"
                    className="secondary"
                    onClick={dismissTopNestedSession}>
                    Cancel
                  </button>
                </div>
                {session.initData ? (
                  <FormplayerEmbed
                    ref={el => {
                      const map = nestedIframeByMessageIdRef.current;
                      if (el) {
                        map.set(session.parentMessageId, el);
                      } else {
                        map.delete(session.parentMessageId);
                      }
                    }}
                    formInitData={session.initData}
                    emptyMessage=""
                  />
                ) : (
                  <p className="muted form-preview-nested-loading">
                    Loading nested form…
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="split split-form-preview">
        <aside className="panel panel-form-preview-sidebar card">
          <h2>Form preview</h2>
          <p className="page-lead">
            Load forms from <code>{formsBundlePath}/</code>
            {developerMode ? (
              <> (developer mirror — configure on the Bundles page)</>
            ) : (
              <>
                {' '}
                (active app bundle under{' '}
                <code>{WORKSPACE_BUNDLE_ACTIVE_DIR}</code>)
              </>
            )}{' '}
            (same layout as Formulus: each form folder has{' '}
            <code>schema.json</code> and <code>ui.json</code>
            ). Optional <code>ext.json</code> at <code>forms/ext.json</code> and
            per-form <code>forms/&lt;type&gt;/ext.json</code>, plus{' '}
            <code>question_types</code> / <code>validators</code> next to or
            under <code>forms/</code>, match the Formulus bundle. Use{' '}
            <strong>params</strong> for host / prefill data (e.g.{' '}
            <code>defaultData</code>) and <strong>saved data</strong> for
            edit-style payloads — same shape as <code>FormInitData</code> in{' '}
            <code>FormulusInterfaceDefinition</code>. Build formplayer from{' '}
            <code>formulus-formplayer/</code> (<code>pnpm build:copy</code>) or{' '}
            <code>pnpm copy:formplayer</code> in <code>desktop/</code>.
          </p>

          <div className="form-preview-controls">
            <div className="form-preview-row">
              <label className="form-preview-label" htmlFor="form-type-select">
                Form type
              </label>
              <div className="form-preview-field">
                <select
                  id="form-type-select"
                  value={selectedFormType}
                  disabled={listLoading}
                  onChange={e => {
                    const v = e.target.value;
                    setSelectedFormType(v);
                    void loadSpec(v);
                  }}>
                  <option value="">
                    {listLoading ? 'Loading…' : '— Select —'}
                  </option>
                  {formOptions}
                </select>
                <button
                  type="button"
                  className="secondary"
                  disabled={listLoading}
                  onClick={() => void loadForms()}>
                  Refresh list
                </button>
              </div>
            </div>
            {listError ? (
              <p className="notice error">{listError}</p>
            ) : forms.length === 0 && !listLoading ? (
              <p className="muted">
                No forms found. Download and apply an app bundle on the Bundles
                page so <code>{formsBundlePath}/</code> contains form folders,
                or enable developer mode and mirror a local <code>forms/</code>{' '}
                folder.
              </p>
            ) : null}

            {specLoading ? <p className="muted">Loading form spec…</p> : null}
            {specError ? <p className="notice error">{specError}</p> : null}

            {spec ? (
              <>
                <div className="form-preview-row">
                  <label className="form-preview-label" htmlFor="params-json">
                    params (JSON object)
                  </label>
                  <textarea
                    id="params-json"
                    className="form-preview-json"
                    spellCheck={false}
                    value={paramsJson}
                    onChange={e => setParamsJson(e.target.value)}
                    rows={6}
                  />
                </div>
                <div className="form-preview-row">
                  <label className="form-preview-label" htmlFor="saved-json">
                    savedData (JSON object)
                  </label>
                  <textarea
                    id="saved-json"
                    className="form-preview-json"
                    spellCheck={false}
                    value={savedJson}
                    onChange={e => setSavedJson(e.target.value)}
                    rows={6}
                  />
                </div>
                {parseError ? (
                  <p className="notice error">{parseError}</p>
                ) : null}
                <div className="button-row">
                  <button
                    type="button"
                    onClick={() => void applyJsonToPreview()}>
                    Apply JSON to preview
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </aside>

        <div className="panel panel-form-preview-embed">
          <section className="card form-preview-embed-card">
            <FormplayerEmbed
              ref={iframeRef}
              formInitData={formInitData}
              emptyMessage="Choose a form type to load schema and ui from the active bundle, then adjust params / saved JSON and click Apply."
            />
          </section>
        </div>
      </div>
    </div>
  );
}
