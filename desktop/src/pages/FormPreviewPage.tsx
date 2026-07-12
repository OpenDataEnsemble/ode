import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FormFinalizeDialog } from '../components/FormFinalizeDialog';
import { FormPreviewAdvancedParamsDialog } from '../components/FormPreviewAdvancedParamsDialog';
import { CustomAppDeviceViewport } from '../components/CustomAppDeviceViewport';
import {
  FormplayerEmbed,
  type FormplayerEmbedHandle,
} from '../components/FormplayerEmbed';
import {
  buildFormPreviewInitFromBundleSpec,
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
import {
  FORM_LOCALE_DEFAULT,
  getDesktopFormLocalePreference,
  scanActiveBundleFormLocales,
  setDesktopFormLocalePreference,
  type FormLocalePreference,
} from '../lib/formLocale';
import {
  getDesktopLocalePreference,
  setDesktopLocalePreference,
  type UiLocalePreference,
} from '../lib/uiLocale';

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
  const [uiLocalePreference, setUiLocalePreference] =
    useState<UiLocalePreference>(() => getDesktopLocalePreference());
  const [formLocalePreference, setFormLocalePreference] =
    useState<FormLocalePreference>(() => getDesktopFormLocalePreference());
  const [scannedFormLocales, setScannedFormLocales] = useState<string[]>([]);

  const [formInitData, setFormInitData] = useState<FormInitData | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [advancedDraftParams, setAdvancedDraftParams] = useState(DEFAULT_JSON);
  const [advancedDraftSaved, setAdvancedDraftSaved] = useState(DEFAULT_JSON);
  const [advancedParseError, setAdvancedParseError] = useState<string | null>(
    null,
  );

  const iframeRef = useRef<FormplayerEmbedHandle>(null);
  const rootContentWindowRef = useRef<Window | null>(null);
  const nestedEmbedByMessageIdRef = useRef<Map<string, FormplayerEmbedHandle>>(
    new Map(),
  );
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
      const [rows, locales] = await Promise.all([
        tauriClient.listActiveBundleForms(),
        scanActiveBundleFormLocales(),
      ]);
      setForms(rows);
      setScannedFormLocales(locales);
    } catch (e) {
      setListError(e instanceof Error ? e.message : String(e));
      setForms([]);
      setScannedFormLocales([]);
    } finally {
      setListLoading(false);
    }
  }, []);

  const prevDevMirrorGenerationRef = useRef(devMirrorGeneration);

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
      return buildFormPreviewInitFromBundleSpec({
        spec: s,
        observationId,
        params,
        savedData,
        extensions: ext.extensions,
        customQuestionTypes: ext.customQuestionTypes,
        loadLinkedFormSpec: ft => tauriClient.readBundleFormSpec(ft),
      });
    },
    [developerMode],
  );

  /** Re-read schema/ui/extensions from the (dev) bundle and remount formplayer. */
  const reloadActivePreview = useCallback(async () => {
    const formType = selectedFormType.trim();
    if (!formType) {
      return;
    }
    const p = parseJsonObject(paramsJson, 'params');
    const sv = parseJsonObject(savedJson, 'savedData');
    if (!p.ok || !sv.ok) {
      return;
    }
    try {
      const s = await tauriClient.readBundleFormSpec(formType);
      setSpec(s);
      setSpecError(null);
      setFormInitData(
        await buildInitFromSpec(s, p.value, sv.value, previewObservationId),
      );
    } catch (e) {
      setSpecError(e instanceof Error ? e.message : String(e));
    }
  }, [
    selectedFormType,
    paramsJson,
    savedJson,
    previewObservationId,
    buildInitFromSpec,
  ]);

  useEffect(() => {
    if (prevDevMirrorGenerationRef.current === devMirrorGeneration) {
      return;
    }
    prevDevMirrorGenerationRef.current = devMirrorGeneration;
    nestedEmbedByMessageIdRef.current.clear();
    nestedIframeByMessageIdRef.current.clear();
    nestedContentWindowByMessageIdRef.current.clear();
    setNestedSessions([]);
    void reloadActivePreview();
  }, [devMirrorGeneration, reloadActivePreview]);

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

  const openAdvancedDialog = useCallback(() => {
    setAdvancedDraftParams(paramsJson);
    setAdvancedDraftSaved(savedJson);
    setAdvancedParseError(null);
    setAdvancedOpen(true);
  }, [paramsJson, savedJson]);

  const applyAdvancedDialog = useCallback(async () => {
    const p = parseJsonObject(advancedDraftParams, 'params');
    const sv = parseJsonObject(advancedDraftSaved, 'savedData');
    if (!p.ok) {
      setAdvancedParseError(p.error);
      return;
    }
    if (!sv.ok) {
      setAdvancedParseError(sv.error);
      return;
    }
    setAdvancedParseError(null);
    setParamsJson(advancedDraftParams);
    setSavedJson(advancedDraftSaved);
    setParseError(null);
    if (!spec) {
      setAdvancedOpen(false);
      return;
    }
    setFormInitData(
      await buildInitFromSpec(spec, p.value, sv.value, previewObservationId),
    );
    setAdvancedOpen(false);
  }, [
    advancedDraftParams,
    advancedDraftSaved,
    spec,
    buildInitFromSpec,
    previewObservationId,
  ]);

  const onFinalize = useCallback((request: FinalizeRequest) => {
    return new Promise<{ result?: string; error?: string }>(resolve => {
      setFinalizeRequest(request);
      finalizeResolverRef.current = resolve;
    });
  }, []);

  const dismissTopNestedSession = useCallback(() => {
    const top = nestedSessionsRef.current[nestedSessionsRef.current.length - 1];
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
          const initData = await buildFormPreviewInitFromBundleSpec({
            spec: s,
            observationId,
            params,
            savedData,
            extensions: ext.extensions,
            customQuestionTypes: ext.customQuestionTypes,
            subObservationMode: true,
            skipFinalize,
            skipDraftSelection,
            loadLinkedFormSpec: ft => tauriClient.readBundleFormSpec(ft),
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
        return null;
      }
      const matched = stack[matchedIndex];

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

      deliverSubObservationCompletion(matched.parentMessageId, completion);
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

      <FormPreviewAdvancedParamsDialog
        open={advancedOpen}
        paramsJson={advancedDraftParams}
        savedJson={advancedDraftSaved}
        parseError={advancedParseError}
        disabled={!selectedFormType}
        onParamsChange={setAdvancedDraftParams}
        onSavedChange={setAdvancedDraftSaved}
        onApply={() => void applyAdvancedDialog()}
        onCancel={() => setAdvancedOpen(false)}
      />

      {listError ? <p className="notice error">{listError}</p> : null}
      {specError ? <p className="notice error">{specError}</p> : null}
      {parseError && !advancedOpen ? (
        <p className="notice error">{parseError}</p>
      ) : null}

      <section className="panel panel-embed-flush form-preview-embed-panel">
        <CustomAppDeviceViewport
          toolbarStart={
            <div className="form-preview-toolbar-fields">
              <select
                id="form-type-select"
                aria-label="Form type"
                value={selectedFormType}
                disabled={listLoading}
                onChange={e => {
                  const v = e.target.value;
                  setSelectedFormType(v);
                  void loadSpec(v);
                }}>
                <option value="">
                  {listLoading ? 'Loading…' : 'Form type'}
                </option>
                {formOptions}
              </select>
              <select
                id="ui-locale-select"
                aria-label="UI language"
                value={uiLocalePreference}
                onChange={e => {
                  const v = e.target.value as UiLocalePreference;
                  setUiLocalePreference(v);
                  setDesktopLocalePreference(v);
                  if (spec) {
                    void (async () => {
                      const p = parseJsonObject(paramsJson, 'params');
                      const sv = parseJsonObject(savedJson, 'savedData');
                      if (p.ok && sv.ok) {
                        setFormInitData(
                          await buildInitFromSpec(
                            spec,
                            p.value,
                            sv.value,
                            previewObservationId,
                          ),
                        );
                      }
                    })();
                  }
                }}>
                <option value="auto">UI Language (auto)</option>
                <option value="en">English</option>
                <option value="pt">Português</option>
                <option value="fr">Français</option>
              </select>
              <select
                id="form-locale-select"
                aria-label="Form language"
                value={formLocalePreference}
                disabled={scannedFormLocales.length === 0}
                onChange={e => {
                  const v = e.target.value;
                  setFormLocalePreference(v);
                  setDesktopFormLocalePreference(v);
                  if (spec) {
                    void (async () => {
                      const p = parseJsonObject(paramsJson, 'params');
                      const sv = parseJsonObject(savedJson, 'savedData');
                      if (p.ok && sv.ok) {
                        setFormInitData(
                          await buildInitFromSpec(
                            spec,
                            { ...p.value, formLocale: v },
                            sv.value,
                            previewObservationId,
                          ),
                        );
                      }
                    })();
                  }
                }}>
                <option value={FORM_LOCALE_DEFAULT}>
                  Form language (default)
                </option>
                {scannedFormLocales.map(code => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="secondary btn-icon form-preview-advanced-btn"
                disabled={!selectedFormType}
                aria-label="Advanced params"
                title="Advanced params"
                onClick={openAdvancedDialog}>
                <span className="material-symbols-outlined" aria-hidden>
                  data_object
                </span>
              </button>
              {specLoading ? (
                <span className="muted form-preview-toolbar-status">
                  Loading form spec…
                </span>
              ) : null}
              {!listLoading && forms.length === 0 ? (
                <span className="muted form-preview-toolbar-status">
                  No forms in bundle.
                </span>
              ) : null}
            </div>
          }>
          {({ fillFrame, devicePixelRatio }) => (
            <FormplayerEmbed
              key={`${devMirrorGeneration}-${selectedFormType || 'none'}-${devicePixelRatio}`}
              ref={iframeRef}
              fillFrame={fillFrame}
              devicePixelRatio={devicePixelRatio}
              onContentWindowReady={cw => {
                rootContentWindowRef.current = cw;
              }}
              formInitData={formInitData}
              emptyMessage="Choose a form type to load schema and ui from the active bundle, then adjust params / saved JSON in Advanced params."
            />
          )}
        </CustomAppDeviceViewport>
      </section>
    </div>
  );
}
