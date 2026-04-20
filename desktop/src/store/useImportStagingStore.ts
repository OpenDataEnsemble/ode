import { create } from 'zustand';
import {
  computeStagingKey,
  fileKeyForStaging,
  type ImportValidationReport,
} from '../lib/importValidation';

function isJsonFile(file: File) {
  const n = file.name.toLowerCase();
  return n.endsWith('.json') || file.type === 'application/json';
}

export interface ImportStagedFile {
  id: string;
  file: File;
}

interface ImportStagingState {
  stagedJson: ImportStagedFile[];
  stagedAttachments: ImportStagedFile[];
  validationReport: ImportValidationReport | null;
  lastValidatedStagingKey: string | null;
  message: string | null;
  error: string | null;
  addFiles: (fileList: FileList | File[]) => void;
  removeJson: (id: string) => void;
  removeAttachment: (id: string) => void;
  /** Clears staged JSON + attachment lists and invalidates validation. */
  clearStagingLists: () => void;
  setValidationResult: (
    report: ImportValidationReport,
    json: ImportStagedFile[],
    attachments: ImportStagedFile[],
  ) => void;
  setValidationFailed: (err: string) => void;
  setMessage: (m: string | null) => void;
  setError: (e: string | null) => void;
}

function emptyStagingState(): Pick<
  ImportStagingState,
  | 'stagedJson'
  | 'stagedAttachments'
  | 'validationReport'
  | 'lastValidatedStagingKey'
  | 'message'
  | 'error'
> {
  return {
    stagedJson: [],
    stagedAttachments: [],
    validationReport: null,
    lastValidatedStagingKey: null,
    message: null,
    error: null,
  };
}

export const useImportStagingStore = create<ImportStagingState>(set => ({
  stagedJson: [],
  stagedAttachments: [],
  validationReport: null,
  lastValidatedStagingKey: null,
  message: null,
  error: null,

  addFiles: fileList => {
    const files = Array.from(fileList);
    set(s => {
      const jsonKeys = new Set(s.stagedJson.map(x => fileKeyForStaging(x.file)));
      const attKeys = new Set(
        s.stagedAttachments.map(x => fileKeyForStaging(x.file)),
      );
      let nextJson = [...s.stagedJson];
      let nextAtt = [...s.stagedAttachments];
      for (const f of files) {
        if (isJsonFile(f)) {
          const k = fileKeyForStaging(f);
          if (!jsonKeys.has(k)) {
            jsonKeys.add(k);
            nextJson.push({ id: crypto.randomUUID(), file: f });
          }
        } else {
          const k = fileKeyForStaging(f);
          if (!attKeys.has(k)) {
            attKeys.add(k);
            nextAtt.push({ id: crypto.randomUUID(), file: f });
          }
        }
      }
      return {
        stagedJson: nextJson,
        stagedAttachments: nextAtt,
        lastValidatedStagingKey: null,
        message: null,
        error: null,
      };
    });
  },

  removeJson: id =>
    set(s => ({
      stagedJson: s.stagedJson.filter(x => x.id !== id),
      lastValidatedStagingKey: null,
      message: null,
      error: null,
    })),

  removeAttachment: id =>
    set(s => ({
      stagedAttachments: s.stagedAttachments.filter(x => x.id !== id),
      lastValidatedStagingKey: null,
      message: null,
      error: null,
    })),

  clearStagingLists: () => set(emptyStagingState()),

  setValidationResult: (report, json, attachments) =>
    set({
      validationReport: report,
      lastValidatedStagingKey: computeStagingKey(json, attachments),
      error: null,
    }),

  setValidationFailed: err =>
    set({
      validationReport: null,
      lastValidatedStagingKey: null,
      error: err,
    }),

  setMessage: m => set({ message: m }),
  setError: e => set({ error: e }),
}));

export function selectCurrentStagingKey(state: ImportStagingState): string {
  return computeStagingKey(state.stagedJson, state.stagedAttachments);
}
