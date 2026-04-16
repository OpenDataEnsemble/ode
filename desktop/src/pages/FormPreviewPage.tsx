import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FormFinalizeDialog } from '../components/FormFinalizeDialog';
import { FormplayerEmbed } from '../components/FormplayerEmbed';
import {
  buildFormPreviewInit,
  parseJsonObject,
} from '../lib/buildFormPreviewInit';
import { loadBundleFormplayerExtensions } from '../lib/bundleExtensionLoader';
import type { FinalizeRequest } from '../lib/formPreviewBridge';
import { handleFormPreviewBridgeMessage } from '../lib/formPreviewBridge';
import type { FormPreviewEditState } from '../lib/formPreviewNavigation';
import { tauriClient } from '../lib/tauriClient';
import { WORKSPACE_BUNDLE_ACTIVE_DIR } from '../lib/workspacePaths';
import type { FormInitData } from '../lib/formplayerHost';
import type { ActiveBundleFormEntry, BundleFormSpec } from '../types/domain';

const DEFAULT_JSON = '{}';

type LocationState = {
  formPreviewEdit?: FormPreviewEditState;
};

export function FormPreviewPage() {
  const location = useLocation();
  const navigate = useNavigate();

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
  }, [loadForms]);

  const buildInitFromSpec = useCallback(
    async (
      s: BundleFormSpec,
      params: Record<string, unknown>,
      savedData: Record<string, unknown>,
      observationId: string | null,
    ) => {
      const ext = await loadBundleFormplayerExtensions(s.formType);
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
    [],
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

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== iframeRef.current?.contentWindow) {
        return;
      }
      void handleFormPreviewBridgeMessage(e.data, {
        iframe: iframeRef.current,
        onFinalize,
      });
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onFinalize]);

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
      <div className="split split-form-preview">
        <aside className="panel panel-form-preview-sidebar card">
          <h2>Form preview</h2>
          <p className="page-lead">
            Load forms from the active app bundle under{' '}
            <code>{WORKSPACE_BUNDLE_ACTIVE_DIR}</code> (same layout as Formulus:
            each form folder has <code>schema.json</code> and{' '}
            <code>ui.json</code>
            ). Optional <code>ext.json</code> at <code>forms/ext.json</code> and
            per-form <code>forms/&lt;type&gt;/ext.json</code>, plus{' '}
            <code>question_types</code> / <code>validators</code> next to or
            under <code>forms/</code>, match the Formulus bundle. Use{' '}
            <strong>params</strong> for host / prefill data (e.g.{' '}
            <code>defaultData</code>) and <strong>saved data</strong> for
            edit-style payloads — same shape as <code>FormInitData</code> in{' '}
            <code>FormulusInterfaceDefinition</code>. Build formplayer from{' '}
            <code>formulus-formplayer/</code> (
            <code>npm run build:ode-desktop</code>) or{' '}
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
                page so <code>bundles/active/forms/</code> contains form
                folders.
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
