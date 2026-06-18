import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FormFinalizeDialog } from '../components/FormFinalizeDialog';
import { FormplayerEmbed, type FormplayerEmbedHandle } from '../components/FormplayerEmbed';
import {
  buildFormPreviewInit,
  inferObservationIdFromSavedData,
  parseJsonObject,
} from '../lib/buildFormPreviewInit';
import { loadBundleFormplayerExtensions } from '../lib/bundleExtensionLoader';
import { useDeveloperMode } from '../hooks/useDeveloperMode';
import type { FinalizeRequest } from '../lib/formPreviewBridge';
import {
  handleFormPreviewBridgeMessage,
  type FormPreviewDeferOpenSubObservationPayload,
} from '../lib/formPreviewBridge';
import type { FormPreviewEditState } from '../lib/formPreviewNavigation';
import { tauriClient } from '../lib/tauriClient';
import type { FormInitData } from '../lib/formplayerHost';
import type { ActiveBundleFormEntry, BundleFormSpec } from '../types/domain';
import { messageSourceMatchesIframe } from '../lib/iframeMessageSource';
import {
  deliverSubObservationCancelled,
  deliverSubObservationCompletion,
  dropPendingSubObservationOpen,
  registerPendingSubObservationOpen,
} from '../lib/formPreviewSubObservationBridge';
import { subObsCompletionSummary, subObsDebug } from '../lib/subObsDebug';

const DEFAULT_JSON = '{}';

type LocationState = {
  formPreviewEdit?: FormPreviewEditState;
};

type NestedSubObservationSession = {
  parentIframe: HTMLIFrameElement;
  parentEmbed: FormplayerEmbedHandle | null;
  /** Parent iframe `contentWindow` captured when the nested open was deferred. */
  parentContentWindow: Window | null;
  parentMessageId: string;
  formType: string;
  /** Null while bundle init is loading */
  initData: FormInitData | null;
};

export function FormPreviewPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { developerMode, devMirrorGeneration } = useDeveloperMode();

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

  const iframeRef = useRef<FormplayerEmbedHandle>(null);
  const rootContentWindowRef = useRef<Window | null>(null);
  const nestedEmbedByMessageIdRef = useRef<
    Map<string, FormplayerEmbedHandle>
  >(new Map());
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
  const nestedContentWindowByMessageIdRef = useRef<Map<string, Window | null>>(
    new Map(),
  );

  useEffect(() => {
    nestedSessionsRef.current = nestedSessions;
  }, [nestedSessions]);

  const resolveParentEmbed = useCallback(
    (source: Window): FormplayerEmbedHandle | null => {
      const rootHandle = iframeRef.current;
      const rootIframe = rootHandle?.getIframe() ?? null;
      if (
        messageSourceMatchesIframe(
          source,
          rootIframe,
          rootContentWindowRef.current,
        )
      ) {
        return rootHandle;
      }
      for (const handle of nestedEmbedByMessageIdRef.current.values()) {
        const el = handle.getIframe();
        const cw = el?.contentWindow ?? null;
        if (messageSourceMatchesIframe(source, el, cw)) {
          return handle;
        }
      }
      return null;
    },
    [],
  );

  const finishNestedSession = useCallback((parentMessageId: string) => {
    subObsDebug('Desktop.finishNestedSession', {
      parentMessageId,
      remainingBefore: nestedSessionsRef.current.length,
    });
    dropPendingSubObservationOpen(parentMessageId);
    nestedEmbedByMessageIdRef.current.delete(parentMessageId);
    nestedIframeByMessageIdRef.current.delete(parentMessageId);
    nestedContentWindowByMessageIdRef.current.delete(parentMessageId);
    queueMicrotask(() => {
      setNestedSessions(prev =>
        prev.filter(sess => sess.parentMessageId !== parentMessageId),
      );
    });
  }, []);

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
  }, []);

  useEffect(() => {
    void loadForms();
  }, [loadForms, devMirrorGeneration]);

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
    const top =
      nestedSessionsRef.current[nestedSessionsRef.current.length - 1];
    if (!top) {
      return;
    }
    deliverSubObservationCancelled(top.parentMessageId, top.formType);
    finishNestedSession(top.parentMessageId);
  }, [finishNestedSession]);

  const beginDeferredNestedOpen = useCallback(
    (payload: FormPreviewDeferOpenSubObservationPayload) => {
      const {
        parentIframe,
        parentContentWindow,
        messageId,
        formType,
        params,
        savedData,
        skipFinalize,
        skipDraftSelection,
      } = payload;
      const parentEmbed =
        parentContentWindow != null
          ? resolveParentEmbed(parentContentWindow)
          : null;
      const parentMessageId = messageId;
      subObsDebug('Desktop.beginDeferredNestedOpen', {
        messageId: parentMessageId,
        childFormType: formType,
        hasParentContentWindow: Boolean(parentContentWindow),
        hasParentEmbed: Boolean(parentEmbed),
        savedDataKeys: Object.keys(savedData ?? {}),
        paramsKeys: Object.keys(params ?? {}),
      });
      registerPendingSubObservationOpen({
        parentMessageId: messageId,
        parentEmbed,
        parentContentWindow,
        formType,
      });
      setNestedSessions(prev => [
        ...prev,
        {
          parentIframe,
          parentEmbed,
          parentContentWindow,
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
            skipFinalize,
            skipDraftSelection,
          });
          setNestedSessions(prev =>
            prev.map(sess =>
              sess.parentMessageId === messageId ? { ...sess, initData } : sess,
            ),
          );
        } catch (e) {
          deliverSubObservationCompletion(messageId, {
            status: 'error',
            formType,
            message: e instanceof Error ? e.message : String(e),
          });
          finishNestedSession(messageId);
        }
      })();
    },
    [developerMode, finishNestedSession, resolveParentEmbed],
  );

  const tryCompleteNestedSubObservationFinalize = useCallback(
    async (
      eventSource: Window,
      request: FinalizeRequest,
    ): Promise<{ result?: string; error?: string } | null> => {
      const stack = nestedSessionsRef.current;
      let matchedIndex = -1;
      for (let i = stack.length - 1; i >= 0; i -= 1) {
        const sess = stack[i];
        if (!sess.initData) {
          continue;
        }
        const el = nestedIframeByMessageIdRef.current.get(sess.parentMessageId);
        const cw = nestedContentWindowByMessageIdRef.current.get(
          sess.parentMessageId,
        );
        if (messageSourceMatchesIframe(eventSource, el, cw)) {
          matchedIndex = i;
          break;
        }
      }
      if (matchedIndex < 0) {
        subObsDebug('Desktop.tryCompleteNestedSubObservationFinalize — no match', {
          nestedStackDepth: stack.length,
          finalizeKind: request.kind,
        });
        return null;
      }
      const matched = stack[matchedIndex];

      subObsDebug('Desktop.tryCompleteNestedSubObservationFinalize', {
        parentMessageId: matched.parentMessageId,
        childFormType: matched.formType,
        finalizeKind: request.kind,
        finalDataKeys: Object.keys(request.finalData ?? {}),
        stackDepth: stack.length,
        matchedIndex,
      });

      const syntheticResult =
        request.kind === 'update' ? request.observationId : crypto.randomUUID();

      const completion =
        request.kind === 'update'
          ? {
              status: 'form_updated' as const,
              formType: matched.formType,
              observationId: request.observationId,
              formData: request.finalData,
            }
          : {
              status: 'form_submitted' as const,
              formType: matched.formType,
              formData: request.finalData,
            };

      deliverSubObservationCompletion(
        matched.parentMessageId,
        completion,
      );
      subObsDebug('Desktop.tryCompleteNestedSubObservationFinalize → delivered', {
        parentMessageId: matched.parentMessageId,
        completion: subObsCompletionSummary(completion),
      });
      finishNestedSession(matched.parentMessageId);

      return { result: syntheticResult };
    },
    [finishNestedSession],
  );

  const resolveReplyIframe = useCallback((source: Window) => {
    const rootIframe = iframeRef.current?.getIframe() ?? null;
    if (
      messageSourceMatchesIframe(
        source,
        rootIframe,
        rootContentWindowRef.current,
      )
    ) {
      return rootIframe;
    }
    for (let i = nestedSessionsRef.current.length - 1; i >= 0; i -= 1) {
      const s = nestedSessionsRef.current[i];
      const el = nestedIframeByMessageIdRef.current.get(s.parentMessageId);
      const cw = nestedContentWindowByMessageIdRef.current.get(
        s.parentMessageId,
      );
      if (messageSourceMatchesIframe(source, el, cw)) {
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
        iframe: iframeRef.current?.getIframe() ?? null,
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
                    ref={handle => {
                      const embedMap = nestedEmbedByMessageIdRef.current;
                      const iframeMap = nestedIframeByMessageIdRef.current;
                      if (handle) {
                        embedMap.set(session.parentMessageId, handle);
                        iframeMap.set(
                          session.parentMessageId,
                          handle.getIframe(),
                        );
                      } else {
                        embedMap.delete(session.parentMessageId);
                        iframeMap.delete(session.parentMessageId);
                        nestedContentWindowByMessageIdRef.current.delete(
                          session.parentMessageId,
                        );
                      }
                    }}
                    onContentWindowReady={cw => {
                      const map = nestedContentWindowByMessageIdRef.current;
                      if (cw) {
                        map.set(session.parentMessageId, cw);
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

      <header className="page-header">
        <h2>Form preview</h2>
      </header>

      <div className="split split-form-preview">
        <aside className="panel panel-form-preview-sidebar card">
          <div className="form-preview-controls">
            <select
              id="form-type-select"
              className="form-preview-type-select"
              aria-label="Form type"
              value={selectedFormType}
              disabled={listLoading}
              onChange={e => {
                const v = e.target.value;
                setSelectedFormType(v);
                void loadSpec(v);
              }}>
              <option value="">{listLoading ? 'Loading…' : 'Form type'}</option>
              {formOptions}
            </select>
            {listError ? (
              <p className="notice error">{listError}</p>
            ) : forms.length === 0 && !listLoading ? (
              <p className="muted">No forms in bundle.</p>
            ) : null}

            {specLoading ? <p className="muted">Loading form spec…</p> : null}
            {specError ? <p className="notice error">{specError}</p> : null}

            <details className="form-preview-advanced">
              <summary>Advanced params</summary>
              <div className="form-preview-row form-preview-row-stacked">
                <label className="form-preview-label" htmlFor="params-json">
                  params
                </label>
                <textarea
                  id="params-json"
                  className="form-preview-json"
                  spellCheck={false}
                  disabled={!selectedFormType}
                  value={paramsJson}
                  onChange={e => setParamsJson(e.target.value)}
                  rows={5}
                />
              </div>
              <div className="form-preview-row form-preview-row-stacked">
                <label className="form-preview-label" htmlFor="saved-json">
                  savedData
                </label>
                <textarea
                  id="saved-json"
                  className="form-preview-json"
                  spellCheck={false}
                  disabled={!selectedFormType}
                  value={savedJson}
                  onChange={e => setSavedJson(e.target.value)}
                  rows={5}
                />
              </div>
              {parseError ? <p className="notice error">{parseError}</p> : null}
              <div className="button-row">
                <button
                  type="button"
                  disabled={!spec}
                  onClick={() => void applyJsonToPreview()}>
                  Apply
                </button>
              </div>
            </details>
          </div>
        </aside>

        <div className="panel panel-form-preview-embed panel-embed-flush">
          <FormplayerEmbed
            ref={iframeRef}
            onContentWindowReady={cw => {
              rootContentWindowRef.current = cw;
            }}
            formInitData={formInitData}
            emptyMessage="Choose a form type to load schema and ui from the active bundle, then adjust params / saved JSON and click Apply."
          />
        </div>
      </div>
    </div>
  );
}
