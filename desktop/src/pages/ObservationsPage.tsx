import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { tauriClient } from '../lib/tauriClient';
import {
  createNewObservationSaveRequest,
  DEFAULT_OBSERVATION_FORM_VERSION,
  parseTagsCommaSeparated,
  tagsToCommaSeparated,
} from '../lib/observation';
import { useCustodianStore } from '../store/useCustodianStore';
import type { FormPreviewEditState } from '../lib/formPreviewNavigation';
import type {
  ObservationExtras,
  ObservationRecord,
  SaveObservationRequest,
} from '../types/domain';

function toPayloadText(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function statusClass(obs: ObservationRecord) {
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
  if (item.syncStatus === 'conflict') {
    return 'Conflict';
  }
  if (item.dirty || item.syncStatus === 'dirty') {
    return 'Pending';
  }
  if (item.syncStatus === 'clean') {
    return 'Synced';
  }
  return item.syncStatus;
}

function syncStatusDetail(
  status: ObservationRecord['syncStatus'],
): string {
  if (status === 'conflict') {
    return 'Conflict';
  }
  if (status === 'dirty') {
    return 'Pending';
  }
  if (status === 'clean') {
    return 'Synced';
  }
  return status;
}

type FilterMode = 'all' | 'pending' | 'conflicts' | 'recent';

export function ObservationsPage() {
  const navigate = useNavigate();
  const {
    observations,
    observationsTotal,
    observationListParams,
    formTypes,
    selectedObservationId,
    setSelectedObservationId,
    loadObservations,
    loadFormTypes,
    saveObservation,
    restoreLastBackup,
    error,
  } = useCustodianStore();

  const [search, setSearch] = useState('');
  const [formTypeFilter, setFormTypeFilter] = useState<string>('');
  const [filter, setFilter] = useState<FilterMode>('all');
  const [detailObservation, setDetailObservation] =
    useState<ObservationRecord | null>(null);
  const [hasUnsavedDraft, setHasUnsavedDraft] = useState(false);

  const [draftData, setDraftData] = useState('');
  const [draftFormType, setDraftFormType] = useState('');
  const [draftUpdatedAt, setDraftUpdatedAt] = useState('');
  const [draftFormVersion, setDraftFormVersion] = useState(
    DEFAULT_OBSERVATION_FORM_VERSION,
  );
  const [draftCreatedAt, setDraftCreatedAt] = useState('');
  const [draftDeleted, setDraftDeleted] = useState(false);
  const [draftSyncedAt, setDraftSyncedAt] = useState('');
  const [draftGeoText, setDraftGeoText] = useState('');
  const [draftAuthor, setDraftAuthor] = useState('');
  const [draftDeviceId, setDraftDeviceId] = useState('');
  const [draftTagsText, setDraftTagsText] = useState('');

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
    if (!selectedObservationId) {
      setDetailObservation(null);
      return;
    }
    const fromList = observations.find(o => o.id === selectedObservationId);
    if (fromList) {
      setDetailObservation(fromList);
      return;
    }
    let cancelled = false;
    void tauriClient
      .getObservation(selectedObservationId)
      .then(r => {
        if (!cancelled) {
          setDetailObservation(r);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDetailObservation(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedObservationId, observations]);

  const filteredObservations = useMemo(() => {
    let list = observations;
    if (filter === 'pending') {
      list = list.filter(o => o.dirty);
    } else if (filter === 'conflicts') {
      list = list.filter(o => o.syncStatus === 'conflict');
    } else if (filter === 'recent') {
      list = list.filter(isRecentlyModified);
    }
    return list;
  }, [observations, filter]);

  const selected = useMemo(() => {
    if (!selectedObservationId) {
      return null;
    }
    return (
      observations.find(item => item.id === selectedObservationId) ??
      detailObservation
    );
  }, [observations, selectedObservationId, detailObservation]);

  useEffect(() => {
    if (!selected) {
      setDraftData('');
      setDraftFormType('');
      setDraftUpdatedAt('');
      setDraftFormVersion(DEFAULT_OBSERVATION_FORM_VERSION);
      setDraftCreatedAt('');
      setDraftDeleted(false);
      setDraftSyncedAt('');
      setDraftGeoText('');
      setDraftAuthor('');
      setDraftDeviceId('');
      setDraftTagsText('');
      setHasUnsavedDraft(false);
      return;
    }
    const x = selected.extras;
    setDraftData(toPayloadText(selected.payload));
    setDraftFormType(selected.formType ?? '');
    setDraftUpdatedAt(selected.updatedAt ?? '');
    setDraftFormVersion(x?.formVersion ?? DEFAULT_OBSERVATION_FORM_VERSION);
    setDraftCreatedAt(x?.createdAt ?? selected.updatedAt ?? '');
    setDraftDeleted(x?.deleted ?? false);
    setDraftSyncedAt(x?.syncedAt ?? '');
    setDraftGeoText(
      x?.geolocation != null && typeof x.geolocation === 'object'
        ? JSON.stringify(x.geolocation, null, 2)
        : '',
    );
    setDraftAuthor(x?.author ?? '');
    setDraftDeviceId(x?.deviceId ?? '');
    setDraftTagsText(tagsToCommaSeparated(x?.tags));
    setHasUnsavedDraft(false);
  }, [selected]);

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

  async function saveNow() {
    if (!selected) return;
    let dataObj: unknown;
    try {
      dataObj = JSON.parse(draftData);
    } catch {
      window.alert('Data must be valid JSON before saving.');
      return;
    }
    if (!dataObj || typeof dataObj !== 'object' || Array.isArray(dataObj)) {
      window.alert('Data must be a JSON object (Synkronus Observation.data).');
      return;
    }
    let geolocation: unknown = null;
    if (draftGeoText.trim()) {
      try {
        geolocation = JSON.parse(draftGeoText);
      } catch {
        window.alert('Geolocation must be valid JSON (object per OpenAPI).');
        return;
      }
      if (
        geolocation !== null &&
        (typeof geolocation !== 'object' || Array.isArray(geolocation))
      ) {
        window.alert('Geolocation must be a JSON object.');
        return;
      }
    }
    const now = new Date().toISOString();
    const updatedIso = draftUpdatedAt.trim() || now;
    const extras: ObservationExtras = {
      formVersion: draftFormVersion.trim() || DEFAULT_OBSERVATION_FORM_VERSION,
      createdAt: draftCreatedAt.trim() || updatedIso,
      deleted: draftDeleted,
      syncedAt: draftSyncedAt.trim() || null,
      geolocation,
      author: draftAuthor.trim() || null,
      deviceId: draftDeviceId.trim() || null,
      tags: parseTagsCommaSeparated(draftTagsText),
    };
    const req: SaveObservationRequest = {
      id: selected.id,
      payload: dataObj,
      formType: draftFormType.trim() || null,
      updatedAt: updatedIso,
      extras,
    };
    await saveObservation(req);
    setHasUnsavedDraft(false);
  }

  async function addNewObservation() {
    const req: SaveObservationRequest = createNewObservationSaveRequest();
    await saveObservation(req);
    setSelectedObservationId(req.id);
  }

  function editInFormplayer() {
    if (!selected) {
      return;
    }
    let dataObj: unknown;
    try {
      dataObj = JSON.parse(draftData);
    } catch {
      window.alert('Data must be valid JSON before opening in formplayer.');
      return;
    }
    if (!dataObj || typeof dataObj !== 'object' || Array.isArray(dataObj)) {
      window.alert('Data must be a JSON object (Synkronus Observation.data).');
      return;
    }
    const ft = draftFormType.trim();
    if (!ft) {
      window.alert('Set form_type before opening in formplayer.');
      return;
    }
    const payload: FormPreviewEditState = {
      formType: ft,
      observationId: selected.id,
      params: {},
      savedData: dataObj as Record<string, unknown>,
    };
    navigate('/workbench/form-preview', {
      state: { formPreviewEdit: payload },
    });
  }

  function touchDraft() {
    setHasUnsavedDraft(true);
  }

  return (
    <section className="page page-observations">
      <header className="page-header page-header-inline">
        <div>
          <h2>Observations</h2>
          <p>
            Inspect, correct, and resolve observations in your local repository.
            Use filters to focus on pending changes and conflicts.
          </p>
        </div>
        <div className="button-row">
          <button type="button" onClick={() => void addNewObservation()}>
            New observation
          </button>
        </div>
      </header>

      <div className="split split-observations">
        <div className="panel panel-observations-list">
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
          <label className="form-type-filter-label">
            Form type
            <select
              value={formTypeFilter}
              onChange={e => setFormTypeFilter(e.target.value)}>
              <option value="">(all)</option>
              {formTypes.map(ft => (
                <option key={ft} value={ft}>
                  {ft}
                </option>
              ))}
            </select>
          </label>
          <p className="muted small-hint">
            Paged list (search + form type). Chip filters apply to the current
            page. Repository totals are on{' '}
            <Link to="/data/overview">Overview</Link>.
          </p>
          <div className="observations-list-scroll">
            <ul className="list">
              {filteredObservations.map(item => (
                <li key={item.id} className="observation-row">
                  <button
                    type="button"
                    className="linkish"
                    onClick={() => setSelectedObservationId(item.id)}>
                    <span>{item.id}</span>
                    <small>{item.formType ?? 'no-form-type'}</small>
                  </button>
                  <span className="observation-row-badges">
                    <span
                      className={`status-pill ${statusClass(item)}`}
                      title={
                        item.syncStatus === 'conflict'
                          ? 'Conflict — review before push'
                          : item.dirty
                            ? 'Pending push'
                            : item.syncStatus === 'clean'
                              ? 'Synced with server'
                              : undefined
                      }>
                      {syncPillLabel(item)}
                    </span>
                  </span>
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

        <div className="panel panel-observations-editor">
          {!selected ? (
            <p className="muted">
              Select an observation to edit the full Synkronus Observation shape
              (OpenAPI), including <code>data</code> and optional metadata.
            </p>
          ) : (
            <>
              <div className="editor-header">
                <h3>{selected.id}</h3>
                <div className="button-row">
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => void restoreLastBackup(selected.id)}>
                    Restore backup
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    disabled={!draftFormType.trim()}
                    onClick={() => editInFormplayer()}>
                    Edit in formplayer
                  </button>
                  <button type="button" onClick={() => void saveNow()}>
                    Save local
                  </button>
                </div>
              </div>

              <div className="observation-form">
                <fieldset>
                  <legend>Repository</legend>
                  <dl className="kv-grid observation-meta">
                    <dt>Last saved (local)</dt>
                    <dd>{formatDate(selected.lastSavedAt)}</dd>
                    <dt>Remote updated</dt>
                    <dd>{formatDate(selected.remoteUpdatedAt)}</dd>
                    <dt>Pending push</dt>
                    <dd>{selected.dirty ? 'Yes' : 'No'}</dd>
                    <dt>Sync status</dt>
                    <dd>
                      {selected.syncStatus === 'conflict' ? (
                        <strong className="text-danger">Conflict</strong>
                      ) : (
                        syncStatusDetail(selected.syncStatus)
                      )}
                      {selected.hasConflictCopy
                        ? ' · conflict copy stored'
                        : null}
                    </dd>
                    <dt>Last pushed</dt>
                    <dd>{formatDate(selected.lastPushedAt)}</dd>
                  </dl>
                </fieldset>

                <fieldset>
                  <legend>Observation (OpenAPI)</legend>
                  <div className="field-row">
                    <label htmlFor="obs-id">observation_id</label>
                    <input
                      id="obs-id"
                      readOnly
                      value={selected.id}
                      aria-readonly="true"
                    />
                  </div>
                  <div className="field-row">
                    <label htmlFor="obs-form-type">form_type</label>
                    <input
                      id="obs-form-type"
                      value={draftFormType}
                      onChange={e => {
                        setDraftFormType(e.target.value);
                        touchDraft();
                      }}
                    />
                  </div>
                  <div className="field-row">
                    <label htmlFor="obs-form-version">form_version</label>
                    <input
                      id="obs-form-version"
                      value={draftFormVersion}
                      onChange={e => {
                        setDraftFormVersion(e.target.value);
                        touchDraft();
                      }}
                    />
                  </div>
                  <div className="field-row">
                    <label htmlFor="obs-created">created_at</label>
                    <input
                      id="obs-created"
                      placeholder="ISO 8601 date-time"
                      value={draftCreatedAt}
                      onChange={e => {
                        setDraftCreatedAt(e.target.value);
                        touchDraft();
                      }}
                    />
                  </div>
                  <div className="field-row">
                    <label htmlFor="obs-updated">updated_at</label>
                    <input
                      id="obs-updated"
                      placeholder="ISO 8601 date-time"
                      value={draftUpdatedAt}
                      onChange={e => {
                        setDraftUpdatedAt(e.target.value);
                        touchDraft();
                      }}
                    />
                  </div>
                  <div className="field-row field-row-checkbox">
                    <label htmlFor="obs-deleted">deleted</label>
                    <input
                      id="obs-deleted"
                      type="checkbox"
                      checked={draftDeleted}
                      onChange={e => {
                        setDraftDeleted(e.target.checked);
                        touchDraft();
                      }}
                    />
                  </div>
                  <div className="field-row">
                    <label htmlFor="obs-synced">synced_at</label>
                    <input
                      id="obs-synced"
                      placeholder="Optional, ISO 8601"
                      value={draftSyncedAt}
                      onChange={e => {
                        setDraftSyncedAt(e.target.value);
                        touchDraft();
                      }}
                    />
                  </div>
                  <div className="field-row">
                    <label htmlFor="obs-author">author</label>
                    <input
                      id="obs-author"
                      value={draftAuthor}
                      onChange={e => {
                        setDraftAuthor(e.target.value);
                        touchDraft();
                      }}
                    />
                  </div>
                  <div className="field-row">
                    <label htmlFor="obs-device">device_id</label>
                    <input
                      id="obs-device"
                      value={draftDeviceId}
                      onChange={e => {
                        setDraftDeviceId(e.target.value);
                        touchDraft();
                      }}
                    />
                  </div>
                  <div className="field-row field-row-tags">
                    <label htmlFor="obs-tags">tags</label>
                    <input
                      id="obs-tags"
                      placeholder="Comma-separated"
                      value={draftTagsText}
                      onChange={e => {
                        setDraftTagsText(e.target.value);
                        touchDraft();
                      }}
                    />
                  </div>
                  <div className="field-row field-row-stack">
                    <label htmlFor="obs-geo">geolocation</label>
                    <textarea
                      id="obs-geo"
                      className="editor editor-geo"
                      placeholder='Optional JSON object, e.g. {"latitude":59.3,"longitude":18.1}'
                      value={draftGeoText}
                      onChange={e => {
                        setDraftGeoText(e.target.value);
                        touchDraft();
                      }}
                    />
                  </div>
                </fieldset>

                <fieldset>
                  <legend>data</legend>
                  <p className="muted small-hint">
                    Arbitrary JSON object (form fields). Required by OpenAPI.
                  </p>
                  <textarea
                    className="editor"
                    value={draftData}
                    onChange={event => {
                      setDraftData(event.target.value);
                      touchDraft();
                    }}
                  />
                </fieldset>
              </div>

              <p className="muted">
                {hasUnsavedDraft
                  ? 'Unsaved changes in editor.'
                  : selected.dirty
                    ? 'Saved locally but not pushed.'
                    : 'Saved and synced.'}
              </p>
            </>
          )}
        </div>
      </div>
      {error ? <p className="notice error">{error}</p> : null}
    </section>
  );
}
