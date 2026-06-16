import { create } from 'zustand';
import type { ImportStagingScanEntry } from '../types/domain';
import { computeStagingKey, stagingFileKey } from '../lib/importValidation';

export interface ImportStagedFile {
  id: string;
  /** Absolute host path — import copy + JSON reads use native filesystem I/O. */
  nativePath: string;
  name: string;
  size: number;
  lastModified: number;
}

interface ImportStagingState {
  stagedJson: ImportStagedFile[];
  stagedAttachments: ImportStagedFile[];
  message: string | null;
  error: string | null;
  importActivity: { statusText: string } | null;
  addScanEntries: (entries: ImportStagingScanEntry[]) => void;
  removeStagedJson: (nativePath: string) => void;
  removeStagedAttachment: (nativePath: string) => void;
  /** Clears staged JSON + attachment lists. */
  clearStagingLists: () => void;
  setMessage: (m: string | null) => void;
  setError: (e: string | null) => void;
  setImportActivity: (activity: { statusText: string } | null) => void;
}

function scanEntryToStaged(e: ImportStagingScanEntry): ImportStagedFile {
  return {
    id: crypto.randomUUID(),
    nativePath: e.path,
    name: e.fileName,
    size: e.size,
    lastModified: e.lastModifiedMs,
  };
}

function emptyStagingState(): Pick<
  ImportStagingState,
  'stagedJson' | 'stagedAttachments' | 'message' | 'error' | 'importActivity'
> {
  return {
    stagedJson: [],
    stagedAttachments: [],
    message: null,
    error: null,
    importActivity: null,
  };
}

export const useImportStagingStore = create<ImportStagingState>(set => ({
  stagedJson: [],
  stagedAttachments: [],
  message: null,
  error: null,
  importActivity: null,

  addScanEntries: entries =>
    set(s => {
      const jsonKeys = new Set(s.stagedJson.map(x => stagingFileKey(x)));
      const attKeys = new Set(s.stagedAttachments.map(x => stagingFileKey(x)));
      const nextJson = [...s.stagedJson];
      const nextAtt = [...s.stagedAttachments];
      for (const e of entries) {
        const row = scanEntryToStaged(e);
        const k = stagingFileKey(row);
        if (e.isJson) {
          if (!jsonKeys.has(k)) {
            jsonKeys.add(k);
            nextJson.push(row);
          }
        } else if (!attKeys.has(k)) {
          attKeys.add(k);
          nextAtt.push(row);
        }
      }
      return {
        stagedJson: nextJson,
        stagedAttachments: nextAtt,
        message: null,
        error: null,
      };
    }),

  removeStagedJson: nativePath =>
    set(s => ({
      stagedJson: s.stagedJson.filter(f => f.nativePath !== nativePath),
    })),

  removeStagedAttachment: nativePath =>
    set(s => ({
      stagedAttachments: s.stagedAttachments.filter(
        f => f.nativePath !== nativePath,
      ),
    })),

  clearStagingLists: () => set(emptyStagingState()),

  setMessage: m => set({ message: m }),
  setError: e => set({ error: e }),
  setImportActivity: activity => set({ importActivity: activity }),
}));

export function selectCurrentStagingKey(state: ImportStagingState): string {
  return computeStagingKey(
    state.stagedJson.map(s => ({
      name: s.name,
      size: s.size,
      lastModified: s.lastModified,
    })),
    state.stagedAttachments.map(s => ({
      name: s.name,
      size: s.size,
      lastModified: s.lastModified,
    })),
  );
}

export function selectImportActivity(state: ImportStagingState) {
  return state.importActivity;
}
