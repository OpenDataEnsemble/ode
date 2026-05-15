import { useCallback, useEffect, useMemo, useState } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { tauriClient } from '../lib/tauriClient';
import {
  normalizeBasename,
  runImportValidation,
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
import { useCustodianStore } from '../store/useCustodianStore';

const MAX_ISSUES_SHOWN = 50;
const MAX_INDIVIDUAL_FILES = 20;

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
function throttledImportStatus(
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

  return (text: string) => {
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
                  e instanceof Error
                    ? e.message
                    : 'Could not stage dropped files',
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
      const selected = await open({
        directory: true,
        multiple: false,
        recursive: true,
        title: 'Choose folder to import',
      });
      const paths = normalizeDialogPaths(selected);
      if (!paths.length) {
        return;
      }
      setImportActivity({
        statusText: 'Scanning folder for import files…',
      });
      const expanded = await tauriClient.expandImportStagingPaths(paths, null);
      if (expanded.length) {
        addScanEntries(expanded);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Folder selection failed');
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
      setError(e instanceof Error ? e.message : 'File selection failed');
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
      setError(e instanceof Error ? e.message : 'File selection failed');
    } finally {
      setImportActivity(null);
    }
  }, [addScanEntries, setError, setImportActivity]);

  const runFullImport = useCallback(async () => {
    if (stagedJson.length === 0) {
      return;
    }
    const pushStatus = throttledImportStatus(setImportActivity);
    setPreviewReport(null);
    setMessage(null);
    setError(null);
    pushStatus('Reading observation JSON…');

    try {
      const parsed = await parseObservationJsonPathsViaRust(
        stagedJson.map(s => ({ name: s.name, nativePath: s.nativePath })),
        (done, tot) => pushStatus(`Reading JSON (${done}/${tot})…`),
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
            pushStatus(`Loading form schemas (${schemaDone}/${ftArr.length})…`);
          }
        });
      }

      pushStatus('Validating…');
      const basenames = stagedAttachments.map(s => s.name);
      const report = runImportValidation({
        parsedFiles: parsed,
        formSpecsByType,
        stagedAttachmentBasenames: basenames,
        onFileValidated: (fi, tot, name) =>
          pushStatus(`Validating (${fi + 1}/${tot}) ${name}…`),
      });

      if (report.issues.length > 0) {
        const ok = window.confirm(
          [
            'Validation reported issues (schema errors, missing attachments, etc.).',
            'Import anyway? This will write observations to the local store as parsed.',
          ].join('\n\n'),
        );
        if (!ok) {
          setPreviewReport(report);
          setImportActivity(null);
          return;
        }
      }

      const observations = flattenObservations(report.parsedFiles);
      pushStatus(`Writing ${observations.length} observations to local store…`);
      const result = await tauriClient.importObservations(observations, {
        markPending: true,
      });

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

      let copyErrors: string[] = [];
      let attachmentsCopied = 0;
      if (copyItems.length > 0) {
        pushStatus(`Copying attachments (0/${copyItems.length})…`);
        const { listen } = await import('@tauri-apps/api/event');
        const unlisten = await listen<{
          done: number;
          total: number;
          attachmentId: string;
        }>('import/attachment-copy-progress', e => {
          pushStatus(
            `Copying attachments (${e.payload.done}/${e.payload.total}) ${e.payload.attachmentId}…`,
          );
        });
        try {
          const batchResult =
            await tauriClient.copyWorkspaceAttachmentsBatch(copyItems);
          copyErrors = batchResult.errors;
          attachmentsCopied = batchResult.copied;
        } finally {
          unlisten();
        }
      }

      pushStatus('Refreshing local repository state…');
      await loadObservations();
      await loadHealth();

      const baseMsg = `Imported ${result.imported} observations (${result.conflicts} conflicts).`;
      const attMsg =
        copyItems.length > 0
          ? ` Copied ${attachmentsCopied}/${copyItems.length} referenced attachment(s) to queue.${copyErrors.length ? ` Errors: ${copyErrors.slice(0, 5).join('; ')}${copyErrors.length > 5 ? '…' : ''}` : ''}`
          : '';
      setMessage(`${baseMsg}${attMsg}`);
      setPreviewReport(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setImportActivity(null);
    }
  }, [
    stagedJson,
    stagedAttachments,
    setMessage,
    setError,
    setImportActivity,
    loadObservations,
    loadHealth,
  ]);

  const preflightSummary = previewReport
    ? summarizeImportFiles(previewReport.parsedFiles, 0)
    : null;

  const issuesToShow = previewReport?.issues.slice(0, MAX_ISSUES_SHOWN) ?? [];
  const hiddenIssueCount =
    previewReport && previewReport.issues.length > MAX_ISSUES_SHOWN
      ? previewReport.issues.length - MAX_ISSUES_SHOWN
      : 0;

  return (
    <section className="page">
      <header className="page-header">
        <h2>Import observations</h2>
        <p>
          Pick a folder for large imports, or add up to {MAX_INDIVIDUAL_FILES}{' '}
          JSON / attachment files at a time. Drop files onto this window or use
          the buttons below. Import reads and validates on the host, then writes
          to the active profile&apos;s local repository.
        </p>
      </header>

      <div
        className={`import-staging-pane${dragOver ? ' import-staging-pane--drag' : ''}`}>
        <div className="import-staging-toolbar">
          <button
            type="button"
            className="secondary"
            disabled={
              busy ||
              (stagedJson.length === 0 && stagedAttachments.length === 0)
            }
            onClick={() => clearStagingLists()}>
            Clear staging
          </button>
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={() => void pickImportFolder()}>
            Add folder…
          </button>
        </div>

        <div className="import-staging-summary">
          <p className="import-staging-stats" role="status">
            <strong>{stagingSummary.jsonCount}</strong> JSON file
            {stagingSummary.jsonCount !== 1 ? 's' : ''}
            {', '}
            <strong>{stagingSummary.attCount}</strong> attachment
            {stagingSummary.attCount !== 1 ? 's' : ''}
            {stagingSummary.jsonCount + stagingSummary.attCount > 0 ? (
              <> ({formatBytes(stagingSummary.bytes)} total)</>
            ) : null}
          </p>
          <div className="import-file-picker-actions">
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => void pickJsonFiles()}>
              Add JSON files (max {MAX_INDIVIDUAL_FILES})…
            </button>
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => void pickAttachmentFiles()}>
              Add attachments (max {MAX_INDIVIDUAL_FILES})…
            </button>
          </div>
        </div>

        <p className="import-dropzone-footer">
          <span className="material-symbols-outlined" aria-hidden>
            upload_file
          </span>
          Drop up to {MAX_INDIVIDUAL_FILES} paths without a folder, or drop a
          folder (use “Add folder…” for deep trees). Progress appears in the
          sidebar banner.
        </p>
      </div>

      <div className="panel import-actions-panel">
        <div className="button-row">
          <button
            type="button"
            disabled={busy || stagedJson.length === 0}
            onClick={() => void runFullImport()}>
            {busy ? 'Working…' : 'Import into local store'}
          </button>
        </div>
      </div>

      {previewReport && preflightSummary ? (
        <div className="panel import-issues-panel">
          <h3>Import cancelled — validation summary</h3>
          <p className="notice inline-warn" role="status">
            Fix issues or confirm import next time. Large imports should use{' '}
            <strong>Add folder…</strong>.
          </p>
          <ul className="import-summary-list">
            <li>
              <strong>{preflightSummary.observationCount}</strong> observations
            </li>
            <li>
              <strong>{preflightSummary.formTypeCount}</strong> distinct form
              types
            </li>
            <li>
              <strong>{previewReport.stagedAttachmentBasenames.length}</strong>{' '}
              staged attachments
            </li>
            <li>
              <strong>{previewReport.referencedAttachmentNames.length}</strong>{' '}
              referenced attachment names
            </li>
          </ul>

          {previewReport.issues.length > 0 ? (
            <div className="import-errors">
              <h4>
                Issues ({previewReport.issues.length}
                {hiddenIssueCount ? `, showing ${issuesToShow.length}` : ''})
              </h4>
              <ul className="import-issues-list">
                {issuesToShow.map((issue, i) => (
                  <li
                    key={`${issue.code}-${issue.message}-${issue.observationId ?? ''}-${i}`}
                    data-severity={issue.severity}>
                    <span className="import-issue-severity">
                      {issue.severity}
                    </span>
                    {issue.fileName ? (
                      <span className="import-issue-file">
                        {issue.fileName}:{' '}
                      </span>
                    ) : null}
                    {issue.message}
                  </li>
                ))}
              </ul>
              {hiddenIssueCount > 0 ? (
                <p className="import-issues-more">
                  … and {hiddenIssueCount} more (not shown).
                </p>
              ) : null}
            </div>
          ) : (
            <p className="notice success">No issues reported.</p>
          )}
        </div>
      ) : null}

      {message ? <p className="notice success">{message}</p> : null}
      {error ? <p className="notice error">{error}</p> : null}
    </section>
  );
}
