import { useCallback, useRef, useState } from 'react';
import { tauriClient } from '../lib/tauriClient';
import { collectFilesFromDataTransfer } from '../lib/collectDroppedFiles';
import {
  normalizeBasename,
  runImportValidation,
} from '../lib/importValidation';
import type { BundleFormSpec } from '../types/domain';
import {
  flattenObservations,
  parseObservationJsonFiles,
  summarizeImportFiles,
} from '../lib/importSummary';
import {
  selectCurrentStagingKey,
  selectImportActivity,
  useImportStagingStore,
} from '../store/useImportStagingStore';
import { useCustodianStore } from '../store/useCustodianStore';

function formatBytes(n: number) {
  if (n < 1024) {
    return `${n} B`;
  }
  if (n < 1024 * 1024) {
    return `${(n / 1024).toFixed(1)} KB`;
  }
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function ImportPage() {
  const { loadObservations, loadHealth } = useCustodianStore();
  const [validating, setValidating] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const folderPickerRef = useRef<HTMLInputElement>(null);

  const stagedJson = useImportStagingStore(s => s.stagedJson);
  const stagedAttachments = useImportStagingStore(s => s.stagedAttachments);
  const validationReport = useImportStagingStore(s => s.validationReport);
  const lastValidatedStagingKey = useImportStagingStore(
    s => s.lastValidatedStagingKey,
  );
  const message = useImportStagingStore(s => s.message);
  const error = useImportStagingStore(s => s.error);
  const importActivity = useImportStagingStore(selectImportActivity);
  const busy = importActivity !== null;

  const addFiles = useImportStagingStore(s => s.addFiles);
  const removeJson = useImportStagingStore(s => s.removeJson);
  const removeAttachment = useImportStagingStore(s => s.removeAttachment);
  const clearStagingLists = useImportStagingStore(s => s.clearStagingLists);
  const setValidationResult = useImportStagingStore(s => s.setValidationResult);
  const setValidationFailed = useImportStagingStore(s => s.setValidationFailed);
  const setMessage = useImportStagingStore(s => s.setMessage);
  const setError = useImportStagingStore(s => s.setError);
  const setImportActivity = useImportStagingStore(s => s.setImportActivity);

  const currentStagingKey = useImportStagingStore(selectCurrentStagingKey);

  const importAllowed =
    validationReport !== null &&
    lastValidatedStagingKey === currentStagingKey &&
    validationReport.observationCount > 0;

  const onDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
    setDragOver(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const next = e.relatedTarget as Node | null;
    const el = e.currentTarget as HTMLElement;
    if (next && el.contains(next)) {
      return;
    }
    setDragOver(false);
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  const onDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
      try {
        const files = await collectFilesFromDataTransfer(e.dataTransfer);
        if (files.length) {
          addFiles(files);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Could not read dropped files',
        );
      }
    },
    [addFiles, setError],
  );

  const runValidate = useCallback(async () => {
    if (stagedJson.length === 0) {
      return;
    }
    setValidating(true);
    setMessage(null);
    setError(null);
    try {
      const parsed = await parseObservationJsonFiles(
        stagedJson.map(s => s.file),
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
      for (const ft of formTypes) {
        try {
          const spec = await tauriClient.readBundleFormSpec(ft);
          formSpecsByType.set(ft, spec);
        } catch {
          /* missing schema reported inside runImportValidation */
        }
      }

      const basenames = stagedAttachments.map(s => s.file.name);
      const report = runImportValidation({
        parsedFiles: parsed,
        formSpecsByType,
        stagedAttachmentBasenames: basenames,
      });
      setValidationResult(report, stagedJson, stagedAttachments);
    } catch (e) {
      setValidationFailed(e instanceof Error ? e.message : 'Validation failed');
    } finally {
      setValidating(false);
    }
  }, [
    stagedJson,
    stagedAttachments,
    setValidationResult,
    setValidationFailed,
    setMessage,
    setError,
  ]);

  async function runImport() {
    if (!importAllowed || !validationReport) {
      return;
    }
    const hasIssues = validationReport.issues.length > 0;
    if (hasIssues) {
      const ok = window.confirm(
        [
          'Validation reported issues (schema errors, missing attachments, etc.).',
          'Import anyway? This will write observations to the local store as parsed.',
        ].join('\n\n'),
      );
      if (!ok) {
        return;
      }
    }
    setImportActivity({ statusText: 'Preparing import…' });
    setError(null);
    setMessage(null);
    try {
      const observations = flattenObservations(validationReport.parsedFiles);
      setImportActivity({
        statusText: 'Importing observations into local store…',
      });
      const result = await tauriClient.importObservations(observations, {
        markPending: true,
      });

      const stagedNorm = new Map<string, string>();
      for (const s of stagedAttachments) {
        const k = normalizeBasename(s.file.name);
        if (k && !stagedNorm.has(k)) {
          stagedNorm.set(k, s.file.name);
        }
      }
      let attachmentsWritten = 0;
      const writeErrors: string[] = [];
      if (stagedAttachments.length > 0) {
        setImportActivity({
          statusText: `Copying attachments (0/${stagedAttachments.length})…`,
        });
      }
      for (const s of stagedAttachments) {
        const k = normalizeBasename(s.file.name);
        const attachmentId = stagedNorm.get(k) ?? s.file.name;
        try {
          const bytes = new Uint8Array(await s.file.arrayBuffer());
          await tauriClient.writeWorkspaceAttachment(attachmentId, bytes);
          attachmentsWritten += 1;
          setImportActivity({
            statusText: `Copying attachments (${attachmentsWritten}/${stagedAttachments.length})…`,
          });
        } catch (e) {
          writeErrors.push(
            `${s.file.name}: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }

      setImportActivity({ statusText: 'Refreshing local repository state…' });
      await loadObservations();
      await loadHealth();
      const baseMsg = `Imported ${result.imported} observations (${result.conflicts} conflicts).`;
      const attMsg =
        stagedAttachments.length > 0
          ? ` Copied ${attachmentsWritten}/${stagedAttachments.length} attachment file(s) to the workspace queue.${writeErrors.length > 0 ? ` Errors: ${writeErrors.join('; ')}` : ''}`
          : '';
      setMessage(`${baseMsg}${attMsg}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setImportActivity(null);
    }
  }

  const preflightSummary = validationReport
    ? summarizeImportFiles(validationReport.parsedFiles, 0)
    : null;

  return (
    <section className="page">
      <header className="page-header">
        <h2>Import observations</h2>
        <p>
          Stage JSON observation files and optional attachment files. Validate
          against the active app bundle schemas, review issues, then import into
          the active profile&apos;s local repository. Your staged files stay
          here while you navigate elsewhere in the app.
        </p>
      </header>

      <div
        className={`import-staging-pane${dragOver ? ' import-staging-pane--drag' : ''}`}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={e => void onDrop(e)}>
        <div className="import-staging-toolbar">
          <button
            type="button"
            className="secondary"
            disabled={
              busy ||
              validating ||
              (stagedJson.length === 0 && stagedAttachments.length === 0)
            }
            onClick={() => clearStagingLists()}>
            Clear lists
          </button>
          <button
            type="button"
            className="secondary"
            disabled={busy || validating}
            onClick={() => folderPickerRef.current?.click()}>
            Add folder…
          </button>
          <input
            ref={folderPickerRef}
            type="file"
            className="import-folder-input"
            multiple
            {...({
              webkitdirectory: '',
              directory: '',
            } as Record<string, string>)}
            onChange={e => {
              const list = e.target.files;
              if (list?.length) {
                addFiles(list);
              }
              e.target.value = '';
            }}
          />
        </div>
        <div className="import-staging-grid">
          <div className="import-staging-column">
            <h3>JSON files</h3>
            <p className="import-staging-hint">
              Observations (one or more per file). Dropped files with a
              <code>.json</code> name go here.
            </p>
            <ul className="import-file-list">
              {stagedJson.length === 0 ? (
                <li className="import-file-list-empty">No JSON files staged</li>
              ) : (
                stagedJson.map(s => (
                  <li key={s.id}>
                    <span className="import-file-name" title={s.file.name}>
                      {s.file.name}
                    </span>
                    <span className="import-file-meta">
                      {formatBytes(s.file.size)}
                    </span>
                    <button
                      type="button"
                      className="secondary import-file-remove"
                      onClick={() => removeJson(s.id)}
                      disabled={busy || validating}
                      aria-label={`Remove ${s.file.name}`}>
                      <span className="material-symbols-outlined" aria-hidden>
                        close
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
            <input
              type="file"
              multiple
              accept=".json,application/json"
              onChange={e => {
                const list = e.target.files;
                if (list?.length) {
                  addFiles(list);
                }
                e.target.value = '';
              }}
            />
          </div>

          <div className="import-staging-column">
            <h3>Attachments</h3>
            <p className="import-staging-hint">
              Non-JSON files (images, PDFs, etc.) referenced from observation
              payloads.
            </p>
            <ul className="import-file-list">
              {stagedAttachments.length === 0 ? (
                <li className="import-file-list-empty">
                  No attachments staged
                </li>
              ) : (
                stagedAttachments.map(s => (
                  <li key={s.id}>
                    <span className="import-file-name" title={s.file.name}>
                      {s.file.name}
                    </span>
                    <span className="import-file-meta">
                      {formatBytes(s.file.size)}
                    </span>
                    <button
                      type="button"
                      className="secondary import-file-remove"
                      onClick={() => removeAttachment(s.id)}
                      disabled={busy || validating}
                      aria-label={`Remove ${s.file.name}`}>
                      <span className="material-symbols-outlined" aria-hidden>
                        close
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
            <input
              type="file"
              multiple
              onChange={e => {
                const list = e.target.files;
                if (list?.length) {
                  addFiles(list);
                }
                e.target.value = '';
              }}
            />
          </div>
        </div>

        <p className="import-dropzone-footer">
          <span className="material-symbols-outlined" aria-hidden>
            upload_file
          </span>
          Drop files or folders here — folder contents are added recursively.
        </p>
      </div>

      <div className="panel import-actions-panel">
        <div className="button-row">
          <button
            type="button"
            disabled={validating || stagedJson.length === 0}
            onClick={() => void runValidate()}>
            {validating ? 'Validating…' : 'Validate'}
          </button>
          <button
            type="button"
            disabled={busy || !importAllowed}
            onClick={() => void runImport()}>
            {busy ? 'Importing…' : 'Import into local store'}
          </button>
        </div>
        {validationReport &&
        lastValidatedStagingKey !== currentStagingKey &&
        stagedJson.length > 0 ? (
          <p className="notice inline-warn" role="status">
            Staging changed since last validation — run Validate again before
            import.
          </p>
        ) : null}
      </div>

      {validationReport && preflightSummary ? (
        <div className="panel import-issues-panel">
          <h3>Last validation</h3>
          <ul className="import-summary-list">
            <li>
              <strong>{preflightSummary.observationCount}</strong> observations
            </li>
            <li>
              <strong>{preflightSummary.formTypeCount}</strong> distinct form
              types
            </li>
            <li>
              <strong>
                {validationReport.stagedAttachmentBasenames.length}
              </strong>{' '}
              staged attachments
            </li>
            <li>
              <strong>
                {validationReport.referencedAttachmentNames.length}
              </strong>{' '}
              referenced attachment names (from payloads)
            </li>
          </ul>

          {validationReport.issues.length > 0 ? (
            <div className="import-errors">
              <h4>Issues ({validationReport.issues.length})</h4>
              <ul className="import-issues-list">
                {validationReport.issues.map((issue, i) => (
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
