import { useCallback, useState } from 'react';
import { tauriClient } from '../lib/tauriClient';
import {
  flattenObservations,
  parseObservationJsonFile,
  summarizeImportFiles,
  type ImportPreflightSummary,
  type ParsedObservationFile,
} from '../lib/importSummary';
import { useCustodianStore } from '../store/useCustodianStore';

function isJsonFile(file: File) {
  const n = file.name.toLowerCase();
  return n.endsWith('.json') || file.type === 'application/json';
}

export function ImportPage() {
  const { loadObservations, loadHealth } = useCustodianStore();
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<ImportPreflightSummary | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const processFiles = useCallback(async (fileList: FileList | File[]) => {
    setMessage(null);
    setError(null);
    const files = Array.from(fileList);
    const jsonFiles = files.filter(isJsonFile);
    const nonJson = files.length - jsonFiles.length;
    const parsed: ParsedObservationFile[] = [];
    for (const f of jsonFiles) {
      parsed.push(await parseObservationJsonFile(f));
    }
    setSummary(summarizeImportFiles(parsed, nonJson));
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer.files?.length) {
        void processFiles(e.dataTransfer.files);
      }
    },
    [processFiles],
  );

  async function runImport() {
    if (!summary || summary.observationCount === 0) {
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const observations = flattenObservations(summary.files);
      const result = await tauriClient.importObservations(observations);
      await loadObservations();
      await loadHealth();
      setMessage(
        `Imported ${result.imported} observations (${result.conflicts} conflicts).`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setBusy(false);
    }
  }

  function clearStaged() {
    setSummary(null);
    setMessage(null);
    setError(null);
  }

  return (
    <section className="page">
      <header className="page-header">
        <h2>Import observations</h2>
        <p>
          Drop JSON files (one or more observations per file) or choose files.
          Review the summary, then import into the active profile’s local
          repository.
        </p>
      </header>

      <div
        className="import-dropzone"
        onDragOver={e => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onDrop={onDrop}>
        <span className="material-symbols-outlined" aria-hidden>
          upload_file
        </span>
        <p>
          <strong>Drop files here</strong> or use the file picker (multi-select).
        </p>
        <input
          type="file"
          multiple
          accept=".json,application/json"
          onChange={e => {
            const list = e.target.files;
            if (list?.length) {
              void processFiles(list);
            }
            e.target.value = '';
          }}
        />
      </div>

      {summary ? (
        <div className="panel">
          <h3>Pre-flight summary</h3>
          <ul className="import-summary-list">
            <li>
              <strong>{summary.observationCount}</strong> observations
            </li>
            <li>
              <strong>{summary.formTypeCount}</strong> distinct form types
            </li>
            <li>
              <strong>{summary.attachmentHintCount}</strong> attachment hints
              (non-JSON files + payload heuristics)
            </li>
          </ul>
          {summary.files.some(f => f.error) ? (
            <div className="import-errors">
              <h4>File issues</h4>
              <ul>
                {summary.files
                  .filter(f => f.error)
                  .map(f => (
                    <li key={f.fileName}>
                      {f.fileName}: {f.error}
                    </li>
                  ))}
              </ul>
            </div>
          ) : null}
          <div className="button-row">
            <button
              type="button"
              disabled={busy || summary.observationCount === 0}
              onClick={() => void runImport()}>
              {busy ? 'Importing…' : 'Import into local store'}
            </button>
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={clearStaged}>
              Clear
            </button>
          </div>
        </div>
      ) : null}

      {message ? <p className="notice success">{message}</p> : null}
      {error ? <p className="notice error">{error}</p> : null}
    </section>
  );
}
