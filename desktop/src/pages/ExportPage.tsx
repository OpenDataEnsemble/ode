import { useCallback, useEffect, useMemo, useState } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { confirm } from '@tauri-apps/plugin-dialog';
import { openPath, revealItemInDir } from '@tauri-apps/plugin-opener';
import { listen } from '@tauri-apps/api/event';
import { tauriClient } from '../lib/tauriClient';
import { messageFromUnknown } from '../lib/errors';
import {
  openSessionFolderDialog,
  rememberSessionFolderDialogPath,
  SESSION_FOLDER_DIALOG_KEYS,
} from '../lib/sessionFolderDialog';
import { workspaceAttachmentsDir } from '../lib/workspacePaths';
import {
  buildExportLoadSnippet,
  EXPORT_SNIPPET_LANGS,
  resolveSnippetParquetFiles,
} from '../lib/exportLoadSnippets';
import {
  selectActiveProfileState,
  useCustodianStore,
} from '../store/useCustodianStore';
import { useExportPageStore } from '../store/useExportPageStore';
import { useToastStore } from '../store/useToastStore';
import type { ExportParquetResult } from '../types/domain';

type ExportProgressPayload = {
  phase?: string;
  message?: string;
  done?: number;
  total?: number;
};

function formatLastExportAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

export function ExportPage() {
  const activeProfile = useCustodianStore(selectActiveProfileState);
  const upsertProfileRemote = useCustodianStore(s => s.upsertProfileRemote);
  const formTypes = useCustodianStore(s => s.formTypes);
  const loadFormTypes = useCustodianStore(s => s.loadFormTypes);
  const setExportActivity = useCustodianStore(s => s.setExportActivity);
  const clearExportActivity = useCustodianStore(s => s.clearExportActivity);
  const pushToast = useToastStore(s => s.pushToast);

  const hydratedProfileId = useExportPageStore(s => s.hydratedProfileId);
  const destinationParent = useExportPageStore(s => s.destinationParent);
  const includePending = useExportPageStore(s => s.includePending);
  const includeAttachments = useExportPageStore(s => s.includeAttachments);
  const snippetLang = useExportPageStore(s => s.snippetLang);
  const lastResult = useExportPageStore(s => s.lastResult);
  const lastExportAt = useExportPageStore(s => s.lastExportAt);
  const error = useExportPageStore(s => s.error);
  const busy = useExportPageStore(s => s.busy);
  const hydrateFromProfile = useExportPageStore(s => s.hydrateFromProfile);
  const clearHydration = useExportPageStore(s => s.clearHydration);
  const setDestinationParent = useExportPageStore(s => s.setDestinationParent);
  const setIncludePending = useExportPageStore(s => s.setIncludePending);
  const setIncludeAttachments = useExportPageStore(
    s => s.setIncludeAttachments,
  );
  const setSnippetLang = useExportPageStore(s => s.setSnippetLang);
  const setError = useExportPageStore(s => s.setError);
  const setBusy = useExportPageStore(s => s.setBusy);
  const recordSuccessfulExport = useExportPageStore(
    s => s.recordSuccessfulExport,
  );

  const [copyFlash, setCopyFlash] = useState(false);

  const workspacePath = activeProfile?.workspacePath?.trim() ?? '';
  const workspaceAttachmentsPath = workspacePath
    ? workspaceAttachmentsDir(workspacePath)
    : '';

  useEffect(() => {
    if (!activeProfile) {
      clearHydration();
      return;
    }
    if (hydratedProfileId === activeProfile.id) {
      return;
    }
    hydrateFromProfile(activeProfile);
  }, [activeProfile, hydratedProfileId, hydrateFromProfile, clearHydration]);

  useEffect(() => {
    void loadFormTypes();
  }, [loadFormTypes]);

  const persistExportPrefs = useCallback(
    async (patch: {
      exportDestinationParent?: string | null;
      lastExportAt?: string | null;
      lastExport?: ExportParquetResult | null;
    }) => {
      if (!activeProfile) {
        return;
      }
      await upsertProfileRemote({ ...activeProfile, ...patch });
    },
    [activeProfile, upsertProfileRemote],
  );

  const snippetFiles = useMemo(
    () =>
      resolveSnippetParquetFiles(
        lastResult?.parquetFiles,
        formTypes.length > 0
          ? formTypes
          : lastResult
            ? Object.keys(lastResult.formTypeCounts)
            : null,
      ),
    [lastResult, formTypes],
  );

  const snippetCode = useMemo(
    () => buildExportLoadSnippet(snippetLang, snippetFiles),
    [snippetLang, snippetFiles],
  );

  const pickDestination = useCallback(async () => {
    if (!isTauri()) {
      setError(
        'ODE Desktop must run in the Tauri shell (not a browser tab). From desktop/, run: pnpm tauri dev',
      );
      return;
    }
    const parent = await openSessionFolderDialog({
      key: SESSION_FOLDER_DIALOG_KEYS.exportFolder,
      title: 'Choose export destination folder',
    });
    if (!parent) {
      return;
    }
    rememberSessionFolderDialogPath(
      SESSION_FOLDER_DIALOG_KEYS.exportFolder,
      parent,
    );
    setDestinationParent(parent);
    setError(null);
    try {
      await persistExportPrefs({ exportDestinationParent: parent });
    } catch (e) {
      setError(
        messageFromUnknown(e, 'Could not save destination folder to profile'),
      );
    }
  }, [setDestinationParent, setError, persistExportPrefs]);

  const runExport = useCallback(async () => {
    if (!isTauri()) {
      setError(
        'ODE Desktop must run in the Tauri shell (not a browser tab). From desktop/, run: pnpm tauri dev',
      );
      return;
    }
    if (!workspacePath) {
      setError('No workspace configured for the active profile.');
      return;
    }
    const parent = destinationParent?.trim();
    if (!parent) {
      setError('Choose a destination folder first.');
      return;
    }

    setError(null);

    let destPreview: string;
    try {
      destPreview = await tauriClient.previewExportDir(parent);
    } catch (e) {
      setError(messageFromUnknown(e, 'Could not resolve export folder'));
      return;
    }

    const destExists = await tauriClient.hostPathIsDirectory(destPreview);
    let overwrite = false;
    if (destExists) {
      const ok = await confirm(
        `Export folder already exists:\n${destPreview}\n\nOverwrite it?`,
        {
          title: 'Overwrite export folder?',
          kind: 'warning',
          okLabel: 'Overwrite',
          cancelLabel: 'Cancel',
        },
      );
      if (!ok) {
        return;
      }
      overwrite = true;
    }

    setBusy(true);
    setExportActivity({
      statusText: 'Reading observations…',
      done: 0,
      total: 1,
    });
    let unlisten: (() => void) | undefined;
    try {
      unlisten = await listen<ExportProgressPayload>('export/progress', e => {
        const msg = e.payload?.message?.trim() || 'Exporting…';
        const done = Math.max(0, e.payload?.done ?? 0);
        const total = Math.max(1, e.payload?.total ?? 1);
        setExportActivity({ statusText: msg, done, total });
      });

      await new Promise<void>(resolve => {
        window.setTimeout(resolve, 0);
      });

      const result = await tauriClient.exportObservationsParquet({
        parentDir: parent,
        includePending,
        includeAttachments,
        overwrite,
        profileLabel: activeProfile?.label ?? null,
      });
      const exportedAt = recordSuccessfulExport(result);
      try {
        await persistExportPrefs({
          exportDestinationParent: parent,
          lastExportAt: exportedAt,
          lastExport: result,
        });
      } catch (persistErr) {
        pushToast({
          message: messageFromUnknown(
            persistErr,
            'Export succeeded but could not save last-export to profile',
          ),
          variant: 'warn',
        });
      }
      const formEntries = Object.entries(result.formTypeCounts).sort(
        ([a], [b]) => a.localeCompare(b),
      );
      const detailLines = [
        ...formEntries.map(([ft, n]) => `${ft}: ${n}`),
        ...(result.includeAttachments
          ? [
              `Attachments copied: ${result.attachmentsCopied}${
                result.attachmentsMissing > 0
                  ? ` (${result.attachmentsMissing} missing)`
                  : ''
              }`,
            ]
          : []),
      ];
      const formCount = formEntries.length;
      const rowLabel = result.totalRows === 1 ? 'row' : 'rows';
      const formTypeLabel = formCount === 1 ? 'form type' : 'form types';
      pushToast({
        message:
          formCount === 0
            ? `Export finished — no observations matched. ${result.exportDir}`
            : `Exported ${result.totalRows} ${rowLabel} across ${formCount} ${formTypeLabel}.\n${result.exportDir}`,
        variant: 'success',
        detailLines: detailLines.length > 0 ? detailLines : undefined,
      });
      void loadFormTypes();
    } catch (e) {
      setError(messageFromUnknown(e, 'Export failed'));
    } finally {
      unlisten?.();
      clearExportActivity();
      setBusy(false);
    }
  }, [
    workspacePath,
    destinationParent,
    includePending,
    includeAttachments,
    activeProfile?.label,
    setExportActivity,
    clearExportActivity,
    pushToast,
    setError,
    setBusy,
    recordSuccessfulExport,
    persistExportPrefs,
    loadFormTypes,
  ]);

  async function copySnippet() {
    if (!snippetCode) {
      return;
    }
    try {
      await navigator.clipboard.writeText(snippetCode);
      setCopyFlash(true);
      window.setTimeout(() => setCopyFlash(false), 1500);
    } catch {
      pushToast({ message: 'Could not copy to clipboard', variant: 'warn' });
    }
  }

  async function openLastExportFolder() {
    const dir = lastResult?.exportDir?.trim();
    if (!dir) {
      return;
    }
    try {
      // Prefer reveal (file manager) — more reliable for directories on Linux than openPath.
      await revealItemInDir(dir);
    } catch {
      try {
        await openPath(dir);
      } catch (openErr) {
        pushToast({
          message: messageFromUnknown(openErr, 'Could not open export folder'),
          variant: 'error',
        });
      }
    }
  }

  const canExport = Boolean(destinationParent && workspacePath && !busy);

  return (
    <section className="page">
      <header className="page-header export-page-header">
        <h2>Export</h2>
        {lastExportAt ? (
          <p className="muted export-last-at">
            Last export: {formatLastExportAt(lastExportAt)}
          </p>
        ) : null}
      </header>

      <div className="panel">
        <p className="muted">
          Export observations from this profile&apos;s local workspace as
          Parquet files (one file per form type).
        </p>

        <label className="field-row-checkbox">
          <input
            type="checkbox"
            checked={includePending}
            disabled={busy}
            onChange={e => setIncludePending(e.target.checked)}
          />
          <span>Include pending observations</span>
        </label>

        <label className="field-row-checkbox">
          <input
            type="checkbox"
            checked={includeAttachments}
            disabled={busy}
            onChange={e => setIncludeAttachments(e.target.checked)}
          />
          <span>
            Include attachments (copy referenced files into{' '}
            <code>attachments/</code>)
          </span>
        </label>

        <div className="export-path-hint">
          <p
            className="muted"
            style={{ marginBottom: '0.35rem', fontSize: '0.9rem' }}>
            Hint: Prefix basename references in observation data with this
            folder to resolve files in the live workspace:
          </p>
          <code className="path-value-wrap">
            {workspaceAttachmentsPath || '—'}
          </code>
        </div>

        <div className="export-dest-block">
          <label className="export-dest-label" htmlFor="export-dest-path">
            Destination folder
          </label>
          <div className="export-dest-row">
            <input
              id="export-dest-path"
              readOnly
              className="field-block"
              value={destinationParent ?? ''}
              placeholder="No folder selected"
              aria-label="Export destination folder"
            />
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => void pickDestination()}>
              Browse…
            </button>
          </div>
        </div>

        <div className="button-row" style={{ marginTop: '1rem' }}>
          <button
            type="button"
            className="btn-icon"
            disabled={!canExport}
            onClick={() => void runExport()}>
            <span className="material-symbols-outlined" aria-hidden>
              download
            </span>
            {busy ? 'Exporting…' : 'Export'}
          </button>
          {lastResult?.exportDir ? (
            <button
              type="button"
              className="secondary btn-icon"
              disabled={busy}
              onClick={() => void openLastExportFolder()}>
              <span className="material-symbols-outlined" aria-hidden>
                folder_open
              </span>
              Open last export
            </button>
          ) : null}
        </div>

        {error ? (
          <div className="notice error" role="alert">
            {error}
          </div>
        ) : null}
      </div>

      <div className="panel export-snippets-panel">
        <h3>Load in analysis tools</h3>
        <p className="muted">
          {lastResult?.parquetFiles &&
          Object.keys(lastResult.parquetFiles).length > 0
            ? 'Paths match the last export. Scripts are also written under snippets/ in that folder.'
            : 'Replace [INSERT PATH TO PARQUET FILE] after exporting, or copy again once paths are known.'}
        </p>
        <div className="tab-bar export-snippet-tab-bar" role="tablist">
          {EXPORT_SNIPPET_LANGS.map(lang => (
            <button
              key={lang.id}
              type="button"
              role="tab"
              className={`tab${snippetLang === lang.id ? ' tab-active' : ''}`}
              aria-selected={snippetLang === lang.id}
              onClick={() => setSnippetLang(lang.id)}>
              {lang.label}
            </button>
          ))}
          <div className="tab-bar-actions">
            <button
              type="button"
              className="export-snippet-copy"
              title={copyFlash ? 'Copied' : 'Copy snippet'}
              aria-label={copyFlash ? 'Copied' : 'Copy snippet'}
              onClick={() => void copySnippet()}>
              <span className="material-symbols-outlined" aria-hidden>
                {copyFlash ? 'check' : 'content_copy'}
              </span>
            </button>
          </div>
        </div>
        <pre className="export-snippet-code" tabIndex={0}>
          {snippetCode}
        </pre>
      </div>
    </section>
  );
}
