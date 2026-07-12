import { useCallback, useEffect, useMemo, useState } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { confirm, open } from '@tauri-apps/plugin-dialog';
import { tauriClient } from '../lib/tauriClient';
import {
  groupIssuesBySeverityAndCategory,
  normalizeBasename,
  runImportValidation,
  type ImportIssue,
  type ImportIssueCategory,
  type ImportValidationReport,
} from '../lib/importValidation';
import type { BundleFormSpec } from '../types/domain';
import {
  flattenObservations,
  mapPool,
  parseObservationJsonPathsViaRust,
  summarizeImportFiles,
} from '../lib/importSummary';
import {
  selectImportActivity,
  useImportStagingStore,
} from '../store/useImportStagingStore';
import { messageFromUnknown } from '../lib/errors';
import { ensureBundleApplyEventPipeline } from '../lib/bundleTauriEvents';
import { useCustodianStore } from '../store/useCustodianStore';
import {
  openSessionFolderDialog,
  SESSION_FOLDER_DIALOG_KEYS,
} from '../lib/sessionFolderDialog';

const MAX_INDIVIDUAL_FILES = 20;

/** Host copy batch size — keeps IPC payloads and UI updates manageable. */
const ATTACHMENT_COPY_CHUNK_SIZE = 400;

/** Observation write batch size — one index rebuild after the final batch only. */
const IMPORT_WRITE_CHUNK_SIZE = 2000;

function formatAttachmentCopyProgress(done: number, total: number): string {
  if (total <= 0) {
    return 'Copying attachments…';
  }
  const pct = Math.min(100, Math.round((done / total) * 100));
  return `Copying attachments (${done}/${total}, ${pct}%)…`;
}

function formatBytes(n: number) {
  if (n < 1024) {
    return `${n} B`;
  }
  if (n < 1024 * 1024) {
    return `${(n / 1024).toFixed(1)} KB`;
  }
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function normalizeDialogPaths(
  selected: string | string[] | null | undefined,
): string[] {
  if (selected == null) {
    return [];
  }
  return Array.isArray(selected) ? selected : [selected];
}

/** Limits React updates while still feeling responsive (global banner). */
function createThrottledImportStatus(
  setImportActivity: (a: { statusText: string } | null) => void,
  minIntervalMs = 90,
) {
  let lastFire = 0;
  let pending: string | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const fire = (text: string) => {
    setImportActivity({ statusText: text });
    lastFire = Date.now();
    pending = null;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const push = (text: string) => {
    const now = Date.now();
    if (now - lastFire >= minIntervalMs) {
      fire(text);
      return;
    }
    pending = text;
    if (!timer) {
      timer = setTimeout(
        () => {
          timer = null;
          if (pending != null) {
            fire(pending);
          }
        },
        minIntervalMs - (now - lastFire),
      );
    }
  };

  const dispose = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    pending = null;
  };

  return { push, dispose };
}

const CATEGORY_LABELS: Record<ImportIssueCategory, string> = {
  schema: 'Schema',
  observation: 'Observations',
  attachment: 'Attachments',
  other: 'Other',
};

function ValidationAccordion({ issues }: { issues: ImportIssue[] }) {
  const grouped = groupIssuesBySeverityAndCategory(issues);
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set());

  function toggle(key: string) {
    setOpenKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const sections: { key: string; title: string; items: ImportIssue[] }[] = [];
  for (const severity of ['errors', 'warnings'] as const) {
    const bucket = grouped[severity];
    for (const cat of Object.keys(CATEGORY_LABELS) as ImportIssueCategory[]) {
      const items = bucket[cat];
      if (items.length === 0) continue;
      sections.push({
        key: `${severity}-${cat}`,
        title: `${severity === 'errors' ? 'Errors' : 'Warnings'} — ${CATEGORY_LABELS[cat]} (${items.length})`,
        items,
      });
    }
  }

  if (sections.length === 0) {
    return <p className="notice success">No issues reported.</p>;
  }

  return (
    <div className="validation-accordion">
      {sections.map(sec => (
        <div key={sec.key} className="validation-accordion-item">
          <button
            type="button"
            className="validation-accordion-header"
            aria-expanded={openKeys.has(sec.key)}
            onClick={() => toggle(sec.key)}>
            <span className="material-symbols-outlined" aria-hidden>
              {openKeys.has(sec.key) ? 'expand_more' : 'chevron_right'}
            </span>
            {sec.title}
          </button>
          {openKeys.has(sec.key) ? (
            <div className="validation-accordion-body">
              <ul>
                {sec.items.slice(0, 30).map((issue, i) => (
                  <li key={`${issue.code}-${i}`}>{issue.message}</li>
                ))}
              </ul>
              {sec.items.length > 30 ? (
                <p className="muted">… and {sec.items.length - 30} more</p>
              ) : null}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function ImportPage() {
  const { loadObservations, loadHealth } = useCustodianStore();
  const [dragOver, setDragOver] = useState(false);
  const [previewReport, setPreviewReport] =
    useState<ImportValidationReport | null>(null);

  const stagedJson = useImportStagingStore(s => s.stagedJson);
  const stagedAttachments = useImportStagingStore(s => s.stagedAttachments);
  const message = useImportStagingStore(s => s.message);
  const error = useImportStagingStore(s => s.error);
  const importActivity = useImportStagingStore(selectImportActivity);
  const busy = importActivity !== null;

  const addScanEntries = useImportStagingStore(s => s.addScanEntries);
  const removeStagedJson = useImportStagingStore(s => s.removeStagedJson);
  const removeStagedAttachment = useImportStagingStore(
    s => s.removeStagedAttachment,
  );
  const clearStagedFiles = useImportStagingStore(s => s.clearStagedFiles);
  const clearStagingLists = useImportStagingStore(s => s.clearStagingLists);
  const setMessage = useImportStagingStore(s => s.setMessage);
  const setError = useImportStagingStore(s => s.setError);
  const setImportActivity = useImportStagingStore(s => s.setImportActivity);

  const stagingSummary = useMemo(() => {
    const jsonCount = stagedJson.length;
    const attCount = stagedAttachments.length;
    const bytes =
      stagedJson.reduce((a, s) => a + s.size, 0) +
      stagedAttachments.reduce((a, s) => a + s.size, 0);
    return { jsonCount, attCount, bytes };
  }, [stagedJson, stagedAttachments]);

  useEffect(() => {
    if (!isTauri()) {
      return undefined;
    }
    let unlisten: (() => void) | undefined;
    let alive = true;
    void (async () => {
      try {
        const { getCurrentWebview } = await import('@tauri-apps/api/webview');
        if (!alive) {
          return;
        }
        unlisten = await getCurrentWebview().onDragDropEvent(event => {
          if (event.payload.type === 'enter' || event.payload.type === 'over') {
            setDragOver(true);
          } else if (event.payload.type === 'leave') {
            setDragOver(false);
          } else if (event.payload.type === 'drop') {
            setDragOver(false);
            const paths = event.payload.paths;
            if (!paths.length) {
              return;
            }
            void (async () => {
              try {
                setImportActivity({
                  statusText: 'Collecting dropped paths for staging…',
                });
                const expanded = await tauriClient.expandImportStagingPaths(
                  paths,
                  MAX_INDIVIDUAL_FILES,
                );
                if (expanded.length) {
                  addScanEntries(expanded);
                }
              } catch (e) {
                setError(
                  messageFromUnknown(e, 'Could not stage dropped files'),
                );
              } finally {
                setImportActivity(null);
              }
            })();
          }
        });
      } catch {
        /* ignore */
      }
    })();
    return () => {
      alive = false;
      unlisten?.();
    };
  }, [addScanEntries, setError, setImportActivity]);

  const pickImportFolder = useCallback(async () => {
    try {
      const selected = await openSessionFolderDialog({
        key: SESSION_FOLDER_DIALOG_KEYS.importFolder,
        multiple: true,
        title: 'Choose folder(s) to import',
      });
      if (!selected?.length) {
        return;
      }
      setImportActivity({
        statusText: 'Scanning folder for import files…',
      });
      const expanded = await tauriClient.expandImportStagingPaths(
        selected,
        null,
      );
      if (expanded.length) {
        addScanEntries(expanded);
      }
    } catch (e) {
      setError(messageFromUnknown(e, 'Folder selection failed'));
    } finally {
      setImportActivity(null);
    }
  }, [addScanEntries, setError, setImportActivity]);

  const pickJsonFiles = useCallback(async () => {
    try {
      const selected = await open({
        multiple: true,
        filters: [{ name: 'JSON', extensions: ['json'] }],
        title: 'Choose observation JSON files',
      });
      const paths = normalizeDialogPaths(selected);
      if (!paths.length) {
        return;
      }
      setImportActivity({ statusText: 'Collecting selected JSON files…' });
      const expanded = await tauriClient.expandImportStagingPaths(
        paths,
        MAX_INDIVIDUAL_FILES,
      );
      if (expanded.length) {
        addScanEntries(expanded);
      }
    } catch (e) {
      setError(messageFromUnknown(e, 'File selection failed'));
    } finally {
      setImportActivity(null);
    }
  }, [addScanEntries, setError, setImportActivity]);

  const pickAttachmentFiles = useCallback(async () => {
    try {
      const selected = await open({
        multiple: true,
        title: 'Choose attachment files',
      });
      const paths = normalizeDialogPaths(selected);
      if (!paths.length) {
        return;
      }
      setImportActivity({ statusText: 'Collecting selected attachments…' });
      const expanded = await tauriClient.expandImportStagingPaths(
        paths,
        MAX_INDIVIDUAL_FILES,
      );
      if (expanded.length) {
        addScanEntries(expanded);
      }
    } catch (e) {
      setError(messageFromUnknown(e, 'File selection failed'));
    } finally {
      setImportActivity(null);
    }
  }, [addScanEntries, setError, setImportActivity]);

  const runFullImport = useCallback(async () => {
    if (stagedJson.length === 0) {
      return;
    }
    const statusCtl = createThrottledImportStatus(setImportActivity);
    setPreviewReport(null);
    setMessage(null);
    setError(null);
    statusCtl.push('Reading observation JSON…');

    try {
      await ensureBundleApplyEventPipeline();
      const parsed = await parseObservationJsonPathsViaRust(
        stagedJson.map(s => ({ name: s.name, nativePath: s.nativePath })),
        (done, tot) => statusCtl.push(`Reading JSON (${done}/${tot})…`),
      );

      const formTypes = new Set<string>();
      for (const p of parsed) {
        if (p.error) {
          continue;
        }
        for (const obs of p.observations) {
          if (obs.formType?.trim()) {
            formTypes.add(obs.formType.trim());
          }
        }
      }

      const formSpecsByType = new Map<string, BundleFormSpec>();
      const ftArr = [...formTypes].sort();
      if (ftArr.length > 0) {
        let schemaDone = 0;
        await mapPool(ftArr, 8, async ft => {
          try {
            const spec = await tauriClient.readBundleFormSpec(ft);
            formSpecsByType.set(ft, spec);
          } catch {
            /* missing schema reported inside runImportValidation */
          } finally {
            schemaDone += 1;
            statusCtl.push(
              `Loading form schemas (${schemaDone}/${ftArr.length})…`,
            );
          }
        });
      }

      statusCtl.push('Validating…');
      const basenames = stagedAttachments.map(s => s.name);
      const report = runImportValidation({
        parsedFiles: parsed,
        formSpecsByType,
        stagedAttachmentBasenames: basenames,
        onFileValidated: (fi, tot, name) =>
          statusCtl.push(`Validating (${fi + 1}/${tot}) ${name}…`),
      });

      if (report.issues.length > 0) {
        const errCount = report.issues.filter(
          i => i.severity === 'error',
        ).length;
        const warnCount = report.issues.filter(
          i => i.severity === 'warning',
        ).length;
        const ok = await confirm(
          `${errCount} error(s), ${warnCount} warning(s). Import anyway?`,
          { title: 'Validation issues', kind: 'warning' },
        );
        if (!ok) {
          setPreviewReport(report);
          return;
        }
      }

      const observations = flattenObservations(report.parsedFiles);
      const writeTotal = observations.length;
      let imported = 0;
      let conflicts = 0;
      let indexRebuildScheduled = false;

      for (
        let offset = 0;
        offset < writeTotal;
        offset += IMPORT_WRITE_CHUNK_SIZE
      ) {
        const chunk = observations.slice(
          offset,
          offset + IMPORT_WRITE_CHUNK_SIZE,
        );
        const written = Math.min(offset + chunk.length, writeTotal);
        const isLast = written >= writeTotal;
        statusCtl.push(`Writing observations (${written}/${writeTotal})…`);
        const chunkResult = await tauriClient.importObservations(chunk, {
          markPending: true,
          scheduleIndexRebuild: isLast,
        });
        imported += chunkResult.imported;
        conflicts += chunkResult.conflicts;
        indexRebuildScheduled =
          indexRebuildScheduled || !!chunkResult.indexRebuildScheduled;
      }

      const result = { imported, conflicts, indexRebuildScheduled };

      const stagedNorm = new Map<string, string>();
      for (const s of stagedAttachments) {
        const k = normalizeBasename(s.name);
        if (k && !stagedNorm.has(k)) {
          stagedNorm.set(k, s.name);
        }
      }

      const refNorm = new Set(
        report.referencedAttachmentNames
          .map(n => normalizeBasename(n))
          .filter(Boolean),
      );

      const copyItems: { sourcePath: string; attachmentId: string }[] = [];
      for (const s of stagedAttachments) {
        const kn = normalizeBasename(s.name);
        if (!kn || !refNorm.has(kn)) {
          continue;
        }
        const attachmentId = stagedNorm.get(kn) ?? s.name;
        copyItems.push({
          sourcePath: s.nativePath,
          attachmentId,
        });
      }

      const copyErrors: string[] = [];
      let attachmentsCopied = 0;
      if (copyItems.length > 0) {
        const copyTotal = copyItems.length;
        const copyStatusCtl = createThrottledImportStatus(
          setImportActivity,
          250,
        );
        copyStatusCtl.push(formatAttachmentCopyProgress(0, copyTotal));
        const { listen } = await import('@tauri-apps/api/event');
        let unlisten: (() => void) | undefined;
        try {
          for (
            let offset = 0;
            offset < copyItems.length;
            offset += ATTACHMENT_COPY_CHUNK_SIZE
          ) {
            const chunk = copyItems.slice(
              offset,
              offset + ATTACHMENT_COPY_CHUNK_SIZE,
            );
            const chunkIndex =
              Math.floor(offset / ATTACHMENT_COPY_CHUNK_SIZE) + 1;
            const chunkCount = Math.ceil(
              copyItems.length / ATTACHMENT_COPY_CHUNK_SIZE,
            );
            if (chunkCount > 1) {
              copyStatusCtl.push(
                `Copying attachments batch ${chunkIndex}/${chunkCount}…`,
              );
            }
            unlisten?.();
            unlisten = await listen<{
              done: number;
              total: number;
              attachmentId: string;
            }>('import/attachment-copy-progress', e => {
              const globalDone = offset + e.payload.done;
              copyStatusCtl.push(
                formatAttachmentCopyProgress(globalDone, copyTotal),
              );
            });
            const batchResult =
              await tauriClient.copyWorkspaceAttachmentsBatch(chunk);
            copyErrors.push(...batchResult.errors);
            attachmentsCopied += batchResult.copied;
            copyStatusCtl.push(
              formatAttachmentCopyProgress(
                Math.min(offset + chunk.length, copyTotal),
                copyTotal,
              ),
            );
          }
        } finally {
          unlisten?.();
          copyStatusCtl.dispose();
        }
      }

      statusCtl.push('Refreshing local repository state…');
      await loadObservations();
      await loadHealth();

      const baseMsg = `Imported ${result.imported} observations (${result.conflicts} conflicts).`;
      const indexMsg = result.indexRebuildScheduled
        ? ' Rebuilding observation indexes in the background (see activity banner).'
        : '';
      const attMsg =
        copyItems.length > 0
          ? ` Copied ${attachmentsCopied}/${copyItems.length} referenced attachment(s) to queue.${copyErrors.length ? ` Errors: ${copyErrors.slice(0, 5).join('; ')}${copyErrors.length > 5 ? '…' : ''}` : ''}`
          : '';
      setMessage(`${baseMsg}${indexMsg}${attMsg}`);
      clearStagedFiles();
      setPreviewReport(null);
    } catch (e) {
      setError(messageFromUnknown(e, 'Import failed'));
    } finally {
      statusCtl.dispose();
      setImportActivity(null);
    }
  }, [
    stagedJson,
    stagedAttachments,
    setMessage,
    setError,
    setImportActivity,
    clearStagedFiles,
    loadObservations,
    loadHealth,
  ]);

  const preflightSummary = previewReport
    ? summarizeImportFiles(previewReport.parsedFiles, 0)
    : null;

  return (
    <section className="page">
      <header className="page-header">
        <h2>Import</h2>
      </header>

      <div className="panel">
        <div className="button-row">
          <button
            type="button"
            className="secondary btn-icon"
            disabled={busy}
            onClick={() => void pickImportFolder()}>
            <span className="material-symbols-outlined" aria-hidden>
              folder_open
            </span>
            Import folders…
          </button>
          <button
            type="button"
            className="secondary btn-icon"
            disabled={busy}
            onClick={() => void pickJsonFiles()}>
            <span className="material-symbols-outlined" aria-hidden>
              description
            </span>
            Add JSON…
          </button>
          <button
            type="button"
            className="secondary btn-icon"
            disabled={busy}
            onClick={() => void pickAttachmentFiles()}>
            <span className="material-symbols-outlined" aria-hidden>
              attach_file
            </span>
            Add attachments…
          </button>
        </div>

        <div
          className={`import-drop-zone${dragOver ? ' import-staging-pane--drag' : ''}`}>
          Drop up to {MAX_INDIVIDUAL_FILES} JSON / attachment files, or one or
          more folders (use Import folders for large trees — e.g. observations
          and attachments together).
        </div>

        <p className="muted import-staging-stats">
          <span>
            {stagingSummary.jsonCount} JSON · {stagingSummary.attCount}{' '}
            attachments
            {stagingSummary.jsonCount + stagingSummary.attCount > 0
              ? ` (${formatBytes(stagingSummary.bytes)})`
              : ''}
          </span>
          {stagingSummary.jsonCount + stagingSummary.attCount > 0 ? (
            <button
              type="button"
              className="linkish"
              disabled={busy}
              onClick={() => clearStagingLists()}>
              Clear staging
            </button>
          ) : null}
        </p>

        {stagingSummary.jsonCount + stagingSummary.attCount > 0 ? (
          <div className="import-staging-lists">
            {stagedJson.length > 0 ? (
              <div className="import-staging-section">
                <h4>JSON ({stagedJson.length})</h4>
                {stagedJson.map(s => (
                  <div key={s.nativePath} className="import-staging-row">
                    <button
                      type="button"
                      className="import-staging-row-remove"
                      aria-label={`Remove ${s.name}`}
                      disabled={busy}
                      onClick={() => removeStagedJson(s.nativePath)}>
                      ×
                    </button>
                    <span className="material-symbols-outlined" aria-hidden>
                      description
                    </span>
                    <span className="import-staging-row-name">{s.name}</span>
                    <span className="muted">{formatBytes(s.size)}</span>
                  </div>
                ))}
              </div>
            ) : null}

            {stagedAttachments.length > 0 ? (
              <div className="import-staging-section">
                <h4>Attachments ({stagedAttachments.length})</h4>
                {stagedAttachments.map(s => (
                  <div key={s.nativePath} className="import-staging-row">
                    <button
                      type="button"
                      className="import-staging-row-remove"
                      aria-label={`Remove ${s.name}`}
                      disabled={busy}
                      onClick={() => removeStagedAttachment(s.nativePath)}>
                      ×
                    </button>
                    <span className="material-symbols-outlined" aria-hidden>
                      attach_file
                    </span>
                    <span className="import-staging-row-name">{s.name}</span>
                    <span className="muted">{formatBytes(s.size)}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="button-row" style={{ marginTop: 'var(--space-lg)' }}>
          <button
            type="button"
            className="btn-icon"
            disabled={busy || stagedJson.length === 0}
            onClick={() => void runFullImport()}>
            <span className="material-symbols-outlined" aria-hidden>
              download
            </span>
            {busy ? 'Working…' : 'Import into local store'}
          </button>
        </div>
      </div>

      {previewReport && preflightSummary ? (
        <div className="panel">
          <h3>Validation summary</h3>
          <p className="muted">
            {preflightSummary.observationCount} observations ·{' '}
            {preflightSummary.formTypeCount} form types
          </p>
          <ValidationAccordion issues={previewReport.issues} />
        </div>
      ) : null}

      {message ? <p className="notice success">{message}</p> : null}
      {error ? <p className="notice error">{error}</p> : null}
    </section>
  );
}
