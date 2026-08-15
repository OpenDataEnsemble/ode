import { create } from 'zustand';
import type { ExportParquetResult, ServerProfile } from '../types/domain';
import type { ExportSnippetLang } from '../lib/exportLoadSnippets';

interface ExportPageState {
  /** Profile whose export prefs are currently loaded into this store. */
  hydratedProfileId: string | null;
  /** Parent folder chosen for export (`YYYYMMDD` leaf is created underneath). */
  destinationParent: string | null;
  includePending: boolean;
  includeAttachments: boolean;
  snippetLang: ExportSnippetLang;
  lastResult: ExportParquetResult | null;
  /** ISO timestamp of last successful export (persisted on the profile). */
  lastExportAt: string | null;
  error: string | null;
  busy: boolean;
  hydrateFromProfile: (profile: ServerProfile) => void;
  clearHydration: () => void;
  setDestinationParent: (path: string | null) => void;
  setIncludePending: (v: boolean) => void;
  setIncludeAttachments: (v: boolean) => void;
  setSnippetLang: (lang: ExportSnippetLang) => void;
  setLastResult: (result: ExportParquetResult | null) => void;
  setLastExportAt: (iso: string | null) => void;
  setError: (error: string | null) => void;
  setBusy: (busy: boolean) => void;
  recordSuccessfulExport: (result: ExportParquetResult) => string;
}

function trimPath(path: string | null | undefined): string | null {
  const t = path?.trim();
  return t ? t : null;
}

export const useExportPageStore = create<ExportPageState>(set => ({
  hydratedProfileId: null,
  destinationParent: null,
  includePending: false,
  includeAttachments: false,
  snippetLang: 'r',
  lastResult: null,
  lastExportAt: null,
  error: null,
  busy: false,

  hydrateFromProfile: profile =>
    set({
      hydratedProfileId: profile.id,
      destinationParent: trimPath(profile.exportDestinationParent),
      lastExportAt: trimPath(profile.lastExportAt),
      lastResult: profile.lastExport ?? null,
      error: null,
      busy: false,
    }),
  clearHydration: () =>
    set({
      hydratedProfileId: null,
      destinationParent: null,
      lastResult: null,
      lastExportAt: null,
      error: null,
      busy: false,
    }),
  setDestinationParent: path =>
    set({
      destinationParent: trimPath(path),
    }),
  setIncludePending: includePending => set({ includePending }),
  setIncludeAttachments: includeAttachments => set({ includeAttachments }),
  setSnippetLang: snippetLang => set({ snippetLang }),
  setLastResult: lastResult => set({ lastResult }),
  setLastExportAt: lastExportAt => set({ lastExportAt }),
  setError: error => set({ error }),
  setBusy: busy => set({ busy }),
  recordSuccessfulExport: result => {
    const lastExportAt = new Date().toISOString();
    set({
      lastResult: result,
      lastExportAt,
      error: null,
    });
    return lastExportAt;
  },
}));
