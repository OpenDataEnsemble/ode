import { confirm } from '@tauri-apps/plugin-dialog';
import { openPath } from '@tauri-apps/plugin-opener';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UnsavedChangesDialog } from '../components/UnsavedChangesDialog';
import {
  createNewObservationSaveRequest,
  DEFAULT_OBSERVATION_FORM_VERSION,
  parseTagsCommaSeparated,
  tagsToCommaSeparated,
} from '../lib/observation';
import {
  MAX_OBSERVATION_TABS,
  observationTabLabel,
} from '../lib/observationTabs';
import { referencedNamesForObservation } from '../lib/importValidation';
import { validateObservationPayload } from '../lib/importValidation';
import type { FormPreviewEditState } from '../lib/formPreviewNavigation';
import { confirmDestructiveAction } from '../lib/destructivePolicy';
import { tauriClient } from '../lib/tauriClient';
import { workspaceAttachmentsDir } from '../lib/workspacePaths';
import {
  selectActiveProfileState,
  useCustodianStore,
} from '../store/useCustodianStore';
import { useToastStore } from '../store/useToastStore';
import type {
  BundleFormSpec,
  ObservationExtras,
  ObservationRecord,
  SaveObservationRequest,
} from '../types/domain';

function toPayloadText(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function statusClass(obs: ObservationRecord) {
  if (obs.extras?.deleted) return 'danger';
  if (obs.syncStatus === 'conflict') return 'danger';
  if (obs.dirty) return 'warn';
  return 'ok';
}

const RECENT_DAYS = 7;

function isRecentlyModified(obs: ObservationRecord): boolean {
  const raw = obs.lastSavedAt ?? obs.updatedAt;
  if (!raw) return false;
  const t = new Date(raw).getTime();
  if (Number.isNaN(t)) return false;
  const cutoff = Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000;
  return t >= cutoff;
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function syncPillLabel(item: ObservationRecord): string {
  if (item.syncStatus === 'conflict') return 'Conflict';
  if (item.dirty || item.syncStatus === 'dirty') return 'Pending';
  if (item.syncStatus === 'clean') return 'Synced';
  return item.syncStatus;
}

function syncStatusDetail(status: ObservationRecord['syncStatus']): string {
  if (status === 'conflict') return 'Conflict';
  if (status === 'dirty') return 'Pending';
  if (status === 'clean') return 'Synced';
  return status;
}

type FilterMode = 'all' | 'pending' | 'conflicts' | 'recent' | 'deleted';

export interface ObservationEditorDraft {
  data: string;
  formType: string;
  updatedAt: string;
  formVersion: string;
  createdAt: string;
  deleted: boolean;
  syncedAt: string;
  geoText: string;
  author: string;
  deviceId: string;
  tagsText: string;
  dirty: boolean;
  validationSummary: string | null;
}

function draftFromRecord(record: ObservationRecord): ObservationEditorDraft {
  const x = record.extras;
  return {
    data: toPayloadText(record.payload),
    formType: record.formType ?? '',
    updatedAt: record.updatedAt ?? '',
    formVersion: x?.formVersion ?? DEFAULT_OBSERVATION_FORM_VERSION,
    createdAt: x?.createdAt ?? record.updatedAt ?? '',
    deleted: x?.deleted ?? false,
    syncedAt: x?.syncedAt ?? '',
    geoText:
      x?.geolocation != null && typeof x.geolocation === 'object'
        ? JSON.stringify(x.geolocation, null, 2)
        : '',
    author: x?.author ?? '',
    deviceId: x?.deviceId ?? '',
    tagsText: tagsToCommaSeparated(x?.tags),
    dirty: false,
    validationSummary: null,
  };
}

function fileUrlToPath(url: string): string {
  if (url.startsWith('file://')) {
    try {
      return decodeURIComponent(url.replace(/^file:\/\//, ''));
    } catch {
      return url.replace(/^file:\/\//, '');
    }
  }
  return url;
}

export function ObservationsPage() {
  const navigate = useNavigate();
  const pushToast = useToastStore(s => s.pushToast);
  const activeProfile = useCustodianStore(selectActiveProfileState);
  const {
    observations,
    observationsTotal,
    observationListParams,
    formTypes,
    loadObservations,
    loadFormTypes,
    saveObservation,
    error,
  } = useCustodianStore();

  const [search, setSearch] = useState('');
  const [formTypeFilter, setFormTypeFilter] = useState<string>('');
  const [filter, setFilter] = useState<FilterMode>('all');
  const [activeTab, setActiveTab] = useState<'list' | string>('list');
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ObservationEditorDraft>>(
    {},
  );
  const [records, setRecords] = useState<Record<string, ObservationRecord>>({});
  const [formSpecs, setFormSpecs] = useState<Record<string, BundleFormSpec>>(
    {},
  );
  const [pendingCloseId, setPendingCloseId] = useState<string | null>(null);

  const formTypeSkipFirst = useRef(true);

  useEffect(() => {
    void loadFormTypes();
    void loadObservations();
  }, [loadFormTypes, loadObservations]);

  useEffect(() => {
    if (formTypeSkipFirst.current) {
      formTypeSkipFirst.current = false;
      return;
    }
    void loadObservations(undefined, {
      formType: formTypeFilter || null,
      page: 0,
      pageSize: observationListParams.pageSize,
    });
  }, [formTypeFilter, loadObservations, observationListParams.pageSize]);

  useEffect(() => {
    setRecords(prev => {
      const next = { ...prev };
      for (const o of observations) {
        next[o.id] = o;
      }
      return next;
    });
  }, [observations]);

  const loadRecord = useCallback(async (id: string) => {
    const fromList = useCustodianStore
      .getState()
      .observations.find(o => o.id === id);
    if (fromList) {
      setRecords(r => ({ ...r, [id]: fromList }));
      return fromList;
    }
    const r = await tauriClient.getObservation(id);
    setRecords(rec => ({ ...rec, [id]: r }));
    return r;
  }, []);

  const ensureFormSpec = useCallback(
    async (formType: string) => {
      const ft = formType.trim();
      if (!ft || formSpecs[ft]) {
        return formSpecs[ft];
      }
      try {
        const spec = await tauriClient.readBundleFormSpec(ft);
        setFormSpecs(s => ({ ...s, [ft]: spec }));
        return spec;
      } catch {
        return undefined;
      }
    },
    [formSpecs],
  );

  const filteredObservations = useMemo(() => {
    let list = observations;
    if (filter === 'pending') {
      list = list.filter(o => o.dirty);
    } else if (filter === 'conflicts') {
      list = list.filter(o => o.syncStatus === 'conflict');
    } else if (filter === 'recent') {
      list = list.filter(isRecentlyModified);
    } else if (filter === 'deleted') {
      list = list.filter(o => o.extras?.deleted);
    }
    return list;
  }, [observations, filter]);

  async function searchNow() {
    await loadObservations(search, {
      formType: formTypeFilter || null,
      page: 0,
      pageSize: observationListParams.pageSize,
    });
  }

  const page = observationListParams.page;
  const pageSize = observationListParams.pageSize;
  const totalPages = Math.max(1, Math.ceil(observationsTotal / pageSize));

  async function goPage(next: number) {
    const clamped = Math.max(0, Math.min(next, totalPages - 1));
    await loadObservations(search, {
      formType: formTypeFilter || null,
      page: clamped,
      pageSize,
    });
  }

  function updateDraft(id: string, patch: Partial<ObservationEditorDraft>) {
    setDrafts(d => ({
      ...d,
      [id]: { ...d[id]!, ...patch, dirty: true },
    }));
  }

  async function openObservationTab(id: string) {
    if (!openTabs.includes(id)) {
      if (openTabs.length >= MAX_OBSERVATION_TABS) {
        pushToast({
          message: `Maximum ${MAX_OBSERVATION_TABS} editor tabs open. Close a tab first.`,
          variant: 'warn',
        });
        return;
      }
      setOpenTabs(t => [...t, id]);
    }
    setActiveTab(id);
    if (!drafts[id]) {
      const rec = await loadRecord(id);
      setDrafts(d => ({ ...d, [id]: draftFromRecord(rec) }));
      if (rec.formType) {
        void ensureFormSpec(rec.formType);
      }
    }
  }

  function requestCloseTab(id: string) {
    const draft = drafts[id];
    if (draft?.dirty) {
      setPendingCloseId(id);
      return;
    }
    closeTab(id);
  }

  function closeTab(id: string) {
    setOpenTabs(t => {
      const remaining = t.filter(x => x !== id);
      setActiveTab(prev => {
        if (prev !== id) return prev;
        return remaining.length > 0 ? remaining[remaining.length - 1]! : 'list';
      });
      return remaining;
    });
    setDrafts(d => {
      const next = { ...d };
      delete next[id];
      return next;
    });
  }

  function closeAllTabs() {
    const dirty = openTabs.some(id => drafts[id]?.dirty);
    if (dirty) {
      pushToast({
        message: 'Save or discard changes before closing all tabs.',
        variant: 'warn',
      });
      return;
    }
    setOpenTabs([]);
    setDrafts({});
    setActiveTab('list');
  }

  async function handleUnsavedChoice(choice: 'save' | 'discard' | 'cancel') {
    const id = pendingCloseId;
    setPendingCloseId(null);
    if (!id || choice === 'cancel') {
      return;
    }
    if (choice === 'save') {
      const ok = await saveTab(id);
      if (!ok) return;
    }
    closeTab(id);
  }

  function parseDraftForSave(
    id: string,
    draft: ObservationEditorDraft,
  ): SaveObservationRequest | null {
    let dataObj: unknown;
    try {
      dataObj = JSON.parse(draft.data);
    } catch {
      pushToast({ message: 'Data must be valid JSON.', variant: 'error' });
      return null;
    }
    if (!dataObj || typeof dataObj !== 'object' || Array.isArray(dataObj)) {
      pushToast({ message: 'Data must be a JSON object.', variant: 'error' });
      return null;
    }
    let geolocation: unknown = null;
    if (draft.geoText.trim()) {
      try {
        geolocation = JSON.parse(draft.geoText);
      } catch {
        pushToast({
          message: 'Geolocation must be valid JSON.',
          variant: 'error',
        });
        return null;
      }
      if (
        geolocation !== null &&
        (typeof geolocation !== 'object' || Array.isArray(geolocation))
      ) {
        pushToast({
          message: 'Geolocation must be a JSON object.',
          variant: 'error',
        });
        return null;
      }
    }
    const now = new Date().toISOString();
    const updatedIso = draft.updatedAt.trim() || now;
    const extras: ObservationExtras = {
      formVersion: draft.formVersion.trim() || DEFAULT_OBSERVATION_FORM_VERSION,
      createdAt: draft.createdAt.trim() || updatedIso,
      deleted: draft.deleted,
      syncedAt: draft.syncedAt.trim() || null,
      geolocation,
      author: draft.author.trim() || null,
      deviceId: draft.deviceId.trim() || null,
      tags: parseTagsCommaSeparated(draft.tagsText),
    };
    return {
      id,
      payload: dataObj,
      formType: draft.formType.trim() || null,
      updatedAt: updatedIso,
      extras,
    };
  }

  async function saveTab(
    id: string,
    draftOverride?: ObservationEditorDraft,
  ): Promise<boolean> {
    const draft = draftOverride ?? drafts[id];
    const record = records[id];
    if (!draft || !record) return false;

    const req = parseDraftForSave(id, draft);
    if (!req) return false;

    const ft = draft.formType.trim();
    if (ft) {
      const spec = formSpecs[ft] ?? (await ensureFormSpec(ft));
      const issues = validateObservationPayload(id, ft, req.payload, spec);
      const errors = issues.filter(i => i.severity === 'error');
      if (errors.length > 0) {
        const summary = `${errors.length} validation error(s). Save anyway?`;
        setDrafts(d => ({
          ...d,
          [id]: {
            ...d[id]!,
            validationSummary: errors.map(e => e.message).join('\n'),
          },
        }));
        const proceed = await confirm(summary, {
          title: 'Validation failed',
          kind: 'warning',
        });
        if (!proceed) return false;
      }
    }

    await saveObservation(req);
    const refreshed = await loadRecord(id);
    setDrafts(d => ({
      ...d,
      [id]: { ...draftFromRecord(refreshed), validationSummary: null },
    }));
    return true;
  }

  async function deleteTab(id: string) {
    const draft = drafts[id];
    if (!draft || draft.deleted) {
      return;
    }
    if (
      !(await confirmDestructiveAction(
        'bulk_delete',
        `Mark observation "${id}" as deleted and save?`,
      ))
    ) {
      return;
    }
    await saveTab(id, { ...draft, deleted: true });
  }

  async function addNewObservation() {
    const req = createNewObservationSaveRequest();
    await saveObservation(req);
    await loadObservations();
    await openObservationTab(req.id);
  }

  async function openAttachmentsFolder() {
    const ws = activeProfile?.workspacePath?.trim();
    if (!ws) {
      pushToast({ message: 'No workspace configured.', variant: 'warn' });
      return;
    }
    try {
      await openPath(workspaceAttachmentsDir(ws));
    } catch (e) {
      pushToast({
        message: e instanceof Error ? e.message : String(e),
        variant: 'error',
      });
    }
  }

  async function openAttachmentFile(name: string) {
    try {
      const url = await tauriClient.resolveAttachmentFileUrl(name);
      if (!url) {
        pushToast({
          message: `Attachment not found: ${name}`,
          variant: 'warn',
        });
        return;
      }
      await openPath(fileUrlToPath(url));
    } catch (e) {
      pushToast({
        message: e instanceof Error ? e.message : String(e),
        variant: 'error',
      });
    }
  }

  function editInFormplayer(id: string) {
    const draft = drafts[id];
    const record = records[id];
    if (!draft || !record) return;
    let dataObj: unknown;
    try {
      dataObj = JSON.parse(draft.data);
    } catch {
      pushToast({ message: 'Data must be valid JSON.', variant: 'error' });
      return;
    }
    const ft = draft.formType.trim();
    if (!ft) {
      pushToast({ message: 'Set form_type first.', variant: 'warn' });
      return;
    }
    const payload: FormPreviewEditState = {
      formType: ft,
      observationId: id,
      params: {},
      savedData: dataObj as Record<string, unknown>,
    };
    navigate('/workbench/form-preview', {
      state: { formPreviewEdit: payload },
    });
  }

  function renderEditorTab(id: string) {
    const draft = drafts[id];
    const record = records[id];
    if (!draft || !record) {
      return <p className="muted">Loading…</p>;
    }

    let dataObj: unknown = null;
    try {
      dataObj = JSON.parse(draft.data);
    } catch {
      /* attachment list skipped */
    }

    const ft = draft.formType.trim();
    const spec = ft ? formSpecs[ft] : undefined;
    const attachmentNames =
      dataObj !== null
        ? [...referencedNamesForObservation(spec?.formSchema, dataObj)]
        : [];

    return (
      <div className="observation-form">
        <div className="button-row editor-header">
          <button
            type="button"
            className="btn-icon"
            onClick={() => void saveTab(id)}>
            <span className="material-symbols-outlined" aria-hidden>
              save
            </span>
            Save
          </button>
          <button
            type="button"
            className="secondary danger btn-icon"
            disabled={draft.deleted}
            onClick={() => void deleteTab(id)}>
            <span className="material-symbols-outlined" aria-hidden>
              delete
            </span>
            Delete
          </button>
          <button
            type="button"
            className="secondary btn-icon"
            disabled={!ft}
            onClick={() => editInFormplayer(id)}>
            <span className="material-symbols-outlined" aria-hidden>
              edit
            </span>
            Edit in formplayer
          </button>
        </div>

        {draft.validationSummary ? (
          <p className="notice warn">{draft.validationSummary}</p>
        ) : null}

        <div className="section-heading">
          <h4>Repository</h4>
          <hr />
        </div>
        <table className="form-table form-table-compact">
          <tbody>
            <tr>
              <th scope="row">Last saved (local)</th>
              <td>{formatDate(record.lastSavedAt)}</td>
            </tr>
            <tr>
              <th scope="row">Remote updated</th>
              <td>{formatDate(record.remoteUpdatedAt)}</td>
            </tr>
            <tr>
              <th scope="row">Pending push</th>
              <td>{record.dirty ? 'Yes' : 'No'}</td>
            </tr>
            <tr>
              <th scope="row">Sync status</th>
              <td>
                {record.syncStatus === 'conflict' ? (
                  <strong className="text-danger">Conflict</strong>
                ) : (
                  syncStatusDetail(record.syncStatus)
                )}
              </td>
            </tr>
            <tr>
              <th scope="row">Last pushed</th>
              <td>{formatDate(record.lastPushedAt)}</td>
            </tr>
          </tbody>
        </table>

        <div className="section-heading">
          <h4>Metadata</h4>
          <hr />
        </div>
        <table className="form-table">
          <tbody>
            <tr>
              <th scope="row">observation_id</th>
              <td>
                <input id={`obs-id-${id}`} readOnly value={id} />
              </td>
            </tr>
            <tr>
              <th scope="row">form_type</th>
              <td>
                <input
                  id={`obs-ft-${id}`}
                  value={draft.formType}
                  onChange={e => updateDraft(id, { formType: e.target.value })}
                />
              </td>
            </tr>
            <tr>
              <th scope="row">form_version</th>
              <td>
                <input
                  id={`obs-fv-${id}`}
                  value={draft.formVersion}
                  onChange={e =>
                    updateDraft(id, { formVersion: e.target.value })
                  }
                />
              </td>
            </tr>
            <tr>
              <th scope="row">created_at</th>
              <td>
                <input
                  id={`obs-created-${id}`}
                  value={draft.createdAt}
                  onChange={e => updateDraft(id, { createdAt: e.target.value })}
                />
              </td>
            </tr>
            <tr>
              <th scope="row">updated_at</th>
              <td>
                <input
                  id={`obs-updated-${id}`}
                  value={draft.updatedAt}
                  onChange={e => updateDraft(id, { updatedAt: e.target.value })}
                />
              </td>
            </tr>
            <tr>
              <th scope="row">Deleted</th>
              <td>
                <input
                  id={`obs-deleted-${id}`}
                  type="checkbox"
                  checked={draft.deleted}
                  onChange={e => updateDraft(id, { deleted: e.target.checked })}
                />
              </td>
            </tr>
            <tr>
              <th scope="row">synced_at</th>
              <td>
                <input
                  id={`obs-synced-${id}`}
                  value={draft.syncedAt}
                  onChange={e => updateDraft(id, { syncedAt: e.target.value })}
                />
              </td>
            </tr>
            <tr>
              <th scope="row">author</th>
              <td>
                <input
                  id={`obs-author-${id}`}
                  value={draft.author}
                  onChange={e => updateDraft(id, { author: e.target.value })}
                />
              </td>
            </tr>
            <tr>
              <th scope="row">device_id</th>
              <td>
                <input
                  id={`obs-device-${id}`}
                  value={draft.deviceId}
                  onChange={e => updateDraft(id, { deviceId: e.target.value })}
                />
              </td>
            </tr>
            <tr>
              <th scope="row">tags</th>
              <td>
                <input
                  id={`obs-tags-${id}`}
                  value={draft.tagsText}
                  onChange={e => updateDraft(id, { tagsText: e.target.value })}
                />
              </td>
            </tr>
            <tr>
              <th scope="row">geolocation</th>
              <td>
                <textarea
                  id={`obs-geo-${id}`}
                  className="editor editor-geo"
                  value={draft.geoText}
                  onChange={e => updateDraft(id, { geoText: e.target.value })}
                />
              </td>
            </tr>
            <tr>
              <th scope="row">Attachments</th>
              <td>
                <div className="attachments-row">
                  {attachmentNames.length === 0 ? (
                    <span className="muted">None referenced</span>
                  ) : (
                    attachmentNames.map(name => (
                      <button
                        key={name}
                        type="button"
                        className="linkish"
                        onClick={() => void openAttachmentFile(name)}>
                        {name}
                      </button>
                    ))
                  )}
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <div className="section-heading">
          <h4>data</h4>
          <hr />
        </div>
        <textarea
          className="editor"
          value={draft.data}
          onChange={e => updateDraft(id, { data: e.target.value })}
        />
      </div>
    );
  }

  function renderListTab() {
    return (
      <div className="observations-list-full">
        <div className="filter-bar">
          <div
            className="filter-chips"
            role="group"
            aria-label="Observation filters">
            {(
              [
                ['all', 'All'],
                ['pending', 'Pending'],
                ['conflicts', 'Conflicts'],
                ['recent', `Recent (${RECENT_DAYS}d)`],
                ['deleted', 'Deleted'],
              ] as const
            ).map(([key, lab]) => (
              <button
                key={key}
                type="button"
                className={
                  filter === key ? 'filter-chip active' : 'filter-chip'
                }
                onClick={() => setFilter(key)}>
                {lab}
              </button>
            ))}
          </div>
          <select
            className="filter-bar-select"
            aria-label="Form type filter"
            value={formTypeFilter}
            onChange={e => setFormTypeFilter(e.target.value)}>
            <option value="">Formtype (all)</option>
            {formTypes.map(ft => (
              <option key={ft} value={ft}>
                {ft}
              </option>
            ))}
          </select>
        </div>
        <div className="search-row">
          <input
            value={search}
            placeholder="Search by id or form type"
            onChange={event => setSearch(event.target.value)}
          />
          <button
            type="button"
            className="secondary"
            onClick={() => void searchNow()}>
            Search
          </button>
        </div>
        <div className="observations-list-scroll">
          <ul className="list">
            {filteredObservations.map(item => (
              <li key={item.id}>
                <button
                  type="button"
                  className={`observation-list-row${activeTab === item.id ? ' observation-list-row-active' : ''}`}
                  onClick={() => void openObservationTab(item.id)}>
                  <span className="observation-list-primary">
                    {item.formType ?? 'no-form-type'}
                  </span>
                  <span
                    className={`status-pill ${statusClass(item)}`}
                    title={syncPillLabel(item)}>
                    {syncPillLabel(item)}
                  </span>
                  {item.extras?.deleted ? (
                    <span className="tag-deleted">Deleted</span>
                  ) : null}
                  <span className="observation-list-id">{item.id}</span>
                  <span className="observation-list-updated">
                    {formatDate(item.updatedAt ?? item.extras?.createdAt)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="observations-pager">
          <button
            type="button"
            className="secondary"
            disabled={page <= 0}
            onClick={() => void goPage(page - 1)}>
            Previous
          </button>
          <span className="muted observations-pager-status">
            Page {page + 1} of {totalPages} ({observationsTotal} matches)
          </span>
          <button
            type="button"
            className="secondary"
            disabled={page >= totalPages - 1}
            onClick={() => void goPage(page + 1)}>
            Next
          </button>
        </div>
      </div>
    );
  }

  return (
    <section className="page page-observations page-observations-tabs">
      <header className="page-header page-header-inline">
        <h2>Observations</h2>
        <div className="button-row">
          <button
            type="button"
            className="secondary btn-icon"
            title="Open attachments folder"
            onClick={() => void openAttachmentsFolder()}>
            <span className="material-symbols-outlined" aria-hidden>
              folder_open
            </span>
          </button>
          <button
            type="button"
            className="btn-compact"
            title="Create an observation manually"
            onClick={() => void addNewObservation()}>
            New observation
          </button>
        </div>
      </header>

      <div className="tab-bar" role="tablist">
        <button
          type="button"
          role="tab"
          className={`tab${activeTab === 'list' ? ' tab-active' : ''}`}
          aria-selected={activeTab === 'list'}
          onClick={() => setActiveTab('list')}>
          List
        </button>
        {openTabs.map(id => {
          const dirty = drafts[id]?.dirty;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              className={`tab${activeTab === id ? ' tab-active' : ''}${dirty ? ' tab-dirty' : ''}`}
              aria-selected={activeTab === id}
              onClick={() => setActiveTab(id)}>
              {observationTabLabel(id)}
              <span
                role="button"
                tabIndex={0}
                className="tab-close"
                aria-label={`Close ${id}`}
                onClick={e => {
                  e.stopPropagation();
                  requestCloseTab(id);
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.stopPropagation();
                    e.preventDefault();
                    requestCloseTab(id);
                  }
                }}>
                ×
              </span>
            </button>
          );
        })}
        {openTabs.length > 0 ? (
          <div className="tab-bar-actions">
            <button
              type="button"
              className="secondary btn-compact"
              title="Close all tabs"
              onClick={closeAllTabs}>
              ××
            </button>
          </div>
        ) : null}
      </div>

      <div className="tab-content" role="tabpanel">
        {activeTab === 'list' ? renderListTab() : renderEditorTab(activeTab)}
      </div>

      <UnsavedChangesDialog
        open={pendingCloseId !== null}
        onChoice={choice => void handleUnsavedChoice(choice)}
      />

      {error ? <p className="notice error">{error}</p> : null}
    </section>
  );
}
