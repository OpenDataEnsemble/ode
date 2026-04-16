import { create } from 'zustand';
import {
  Configuration,
  DefaultApi,
  RepositoryResetRequestConfirmEnum,
  ResponseError,
} from '../generated/synkronus-client';
import { tauriClient } from '../lib/tauriClient';
import { SYNKRONUS_CLIENT_VERSION } from '../lib/synkConstants';
import {
  getOrCreateClientId,
  isSyncHttpUnauthorized,
  syncGateway,
} from '../services/synk';
import type {
  AppHealth,
  AuthSession,
  ImportResult,
  ObservationRecord,
  SaveObservationRequest,
  ServerProfile,
  SyncLoginRequest,
  SyncPullRequest,
  SyncPushRequest,
  WorkspaceItem,
} from '../types/domain';

const LEGACY_SERVER_URL_KEY = 'custodian.server_url';
const AUTH_MAP_KEY = 'custodian.auth.byProfile.v1';

function loadAuthMap(): Record<string, AuthSession> {
  if (typeof window === 'undefined') {
    return {};
  }
  try {
    const raw = localStorage.getItem(AUTH_MAP_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as Record<string, AuthSession>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function persistAuthMap(map: Record<string, AuthSession>) {
  if (typeof window === 'undefined') {
    return;
  }
  localStorage.setItem(AUTH_MAP_KEY, JSON.stringify(map));
}

async function pullSyncWithAttachments(
  baseUrl: string,
  token: string,
  clientId: string,
): Promise<ImportResult> {
  const syncState = await tauriClient.getSyncState();
  let repoGen = syncState.repositoryGeneration;
  const obsVer = syncState.observationSyncVersion;

  const pullPage = (since: number | undefined, repo: number) =>
    syncGateway.pull({
      baseUrl,
      token,
      clientId,
      sinceVersion: since,
      repositoryGeneration: repo,
      limit: 500,
    });

  let page = await pullPage(obsVer > 0 ? obsVer : undefined, repoGen);

  if (page.repositoryGeneration > repoGen) {
    await tauriClient.archiveWorkspaceForRepositoryGeneration();
    await tauriClient.setSyncState({
      repositoryGeneration: page.repositoryGeneration,
      observationSyncVersion: 0,
      lastAttachmentVersion: 0,
    });
    repoGen = page.repositoryGeneration;
    page = await pullPage(undefined, repoGen);
  }

  let imported = 0;
  let conflicts = 0;
  let last = page;
  while (true) {
    const imp = await tauriClient.importObservations(last.observations);
    imported += imp.imported;
    conflicts += imp.conflicts;
    if (!last.hasMore) {
      break;
    }
    last = await pullPage(last.changeCutoff, last.repositoryGeneration);
  }

  await tauriClient.setSyncState({
    observationSyncVersion: last.changeCutoff,
    repositoryGeneration: last.repositoryGeneration,
  });

  const attState = await tauriClient.getSyncState();
  const api = new DefaultApi(
    new Configuration({
      basePath: baseUrl.replace(/\/+$/, ''),
      accessToken: token,
    }),
  );

  let attachmentsDownloaded = 0;
  try {
    const manifest = await api.getAttachmentManifest({
      xOdeVersion: SYNKRONUS_CLIENT_VERSION,
      xRepositoryGeneration: attState.repositoryGeneration,
      attachmentManifestRequest: {
        client_id: clientId,
        since_version: attState.lastAttachmentVersion,
      },
    });

    for (const op of manifest.operations) {
      if (op.operation === 'download' && op.download_url) {
        const res = await fetch(op.download_url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          continue;
        }
        const buf = new Uint8Array(await res.arrayBuffer());
        await tauriClient.writeWorkspaceAttachment(op.attachment_id, buf);
        attachmentsDownloaded += 1;
      } else if (op.operation === 'delete') {
        await tauriClient.removeWorkspaceAttachment(op.attachment_id);
      }
    }

    await tauriClient.setSyncState({
      lastAttachmentVersion: manifest.current_version,
      repositoryGeneration:
        manifest.repository_generation ?? last.repositoryGeneration,
    });
  } catch {
    // Attachment endpoints may be unavailable; observation import still succeeded.
  }

  return { imported, conflicts, attachmentsDownloaded };
}

async function callAdminRepositoryReset(baseUrl: string, token: string) {
  const api = new DefaultApi(
    new Configuration({
      basePath: baseUrl.replace(/\/+$/, ''),
      accessToken: token,
    }),
  );
  return api.adminRepositoryReset({
    xOdeVersion: SYNKRONUS_CLIENT_VERSION,
    repositoryResetRequest: {
      confirm: RepositoryResetRequestConfirmEnum.ResetRepository,
    },
  });
}

async function reauthenticateActiveProfile(
  set: (partial: Partial<CustodianState>) => void,
  get: () => CustodianState,
): Promise<void> {
  const id = get().activeProfileId;
  const profile = get().profiles.find(p => p.id === id);
  if (!profile) {
    throw new Error('No active profile.');
  }
  const baseUrl = (profile.serverUrl ?? '').trim();
  if (!baseUrl) {
    throw new Error('Set server URL in Profiles before syncing.');
  }
  const username = (profile.username ?? '').trim();
  if (!username) {
    throw new Error(
      'Session expired. Set username in Profiles, then authenticate (or save a password).',
    );
  }
  const session = get().authSessionsByProfileId[id];

  if (session?.refreshToken) {
    try {
      const next = await syncGateway.refreshSession({
        baseUrl: (session.baseUrl ?? '').trim() || baseUrl,
        refreshToken: session.refreshToken,
      });
      const merged = { ...get().authSessionsByProfileId, [id]: next };
      persistAuthMap(merged);
      set({ authSessionsByProfileId: merged });
      return;
    } catch {
      // Fall through to password login.
    }
  }

  const cred = await tauriClient.credentialGet(id);
  const password = cred.password ?? '';
  if (!password.trim()) {
    throw new Error(
      'Session expired. Authenticate in Profiles (save a password or enter it when authenticating).',
    );
  }
  const next = await syncGateway.login({
    baseUrl,
    username,
    password,
  });
  const merged = { ...get().authSessionsByProfileId, [id]: next };
  persistAuthMap(merged);
  set({ authSessionsByProfileId: merged });
}

interface CustodianState {
  settingsHydrated: boolean;
  dataDirectory: string;
  profiles: ServerProfile[];
  activeProfileId: string;
  authSessionsByProfileId: Record<string, AuthSession>;
  workspacePath: string | null;
  workspaceItems: WorkspaceItem[];
  observations: ObservationRecord[];
  /** Total rows matching current list query (paged list). */
  observationsTotal: number;
  /** Distinct form types in the repository (for Observations filter). */
  formTypes: string[];
  observationListParams: {
    query: string;
    formType: string | null;
    page: number;
    pageSize: number;
  };
  selectedObservationId: string | null;
  health: AppHealth | null;
  loading: boolean;
  error: string | null;
  syncMessage: string | null;
  refreshSettings: () => Promise<void>;
  selectActiveProfile: (profileId: string) => Promise<void>;
  upsertProfileRemote: (profile: ServerProfile) => Promise<void>;
  deleteProfileRemote: (profileId: string) => Promise<void>;
  setSelectedObservationId: (id: string | null) => void;
  clearError: () => void;
  loadWorkspace: () => Promise<void>;
  setWorkspace: (path: string) => Promise<void>;
  refreshWorkspaceItems: (relativePath?: string) => Promise<void>;
  loadObservations: (
    query?: string,
    opts?: { formType?: string | null; page?: number; pageSize?: number },
  ) => Promise<void>;
  loadFormTypes: () => Promise<void>;
  loadHealth: () => Promise<void>;
  saveObservation: (request: SaveObservationRequest) => Promise<void>;
  restoreLastBackup: (observationId: string) => Promise<void>;
  synkLogin: (request: SyncLoginRequest) => Promise<void>;
  synkPull: (request: SyncPullRequest) => Promise<ImportResult>;
  synkPush: (request: SyncPushRequest) => Promise<number>;
  /**
   * Admin API: wipes server observations and attachment manifest, increments repository
   * generation, then pulls so the client archives the prior generation and aligns.
   */
  synkResetServerRepository: (request?: {
    baseUrl?: string;
  }) => Promise<ImportResult>;
  repairRepository: () => Promise<void>;
}

/** Tauri invoke often rejects with a string; preserve the real message for the UI. */
function formatUnknownError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string' && error.trim()) {
    return error;
  }
  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
  ) {
    return (error as { message: string }).message;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

/** Workspace + observation list + health for the active profile (no nested withErrorHandling). */
async function reloadProfileScopedData(
  set: (partial: Partial<CustodianState>) => void,
  get: () => CustodianState,
) {
  const workspacePath = await tauriClient.getWorkspace();
  set({ workspacePath });
  if (workspacePath) {
    const workspaceItems = await tauriClient.listWorkspaceItems();
    set({ workspaceItems });
  } else {
    set({ workspaceItems: [] });
  }
  const prev = get().observationListParams;
  const res = await tauriClient.listObservationsPage(prev.query, {
    formType: prev.formType,
    limit: prev.pageSize,
    offset: prev.page * prev.pageSize,
  });
  set({
    observations: res.rows,
    observationsTotal: res.total,
    observationListParams: {
      query: prev.query,
      formType: prev.formType,
      page: prev.page,
      pageSize: prev.pageSize,
    },
  });
  const health = await tauriClient.getAppHealth();
  set({ health });
}

async function withErrorHandling<T>(
  set: (partial: Partial<CustodianState>) => void,
  action: () => Promise<T>,
) {
  try {
    set({ loading: true, error: null });
    return await action();
  } catch (error) {
    const message = formatUnknownError(error);
    set({ error: message });
    throw error;
  } finally {
    set({ loading: false });
  }
}

export const useCustodianStore = create<CustodianState>((set, get) => ({
  settingsHydrated: false,
  dataDirectory: '',
  profiles: [],
  activeProfileId: '',
  authSessionsByProfileId: loadAuthMap(),
  workspacePath: null,
  workspaceItems: [],
  observations: [],
  observationsTotal: 0,
  formTypes: [],
  observationListParams: {
    query: '',
    formType: null,
    page: 0,
    pageSize: 50,
  },
  selectedObservationId: null,
  health: null,
  loading: false,
  error: null,
  syncMessage: null,

  refreshSettings: async () => {
    try {
      let s = await tauriClient.getSettings();
      let profiles = s.profiles;
      const legacy =
        typeof window !== 'undefined'
          ? window.localStorage.getItem(LEGACY_SERVER_URL_KEY)?.trim()
          : '';
      const active = profiles.find(p => p.id === s.activeProfileId);
      if (legacy && active && !active.serverUrl?.trim()) {
        await tauriClient.upsertProfile({ ...active, serverUrl: legacy });
        localStorage.removeItem(LEGACY_SERVER_URL_KEY);
        s = await tauriClient.getSettings();
        profiles = s.profiles;
      }
      // Re-read before applying: concurrent refreshSettings() or profile changes can
      // make the initial `s` stale (e.g. Add profile then an older refresh completes).
      s = await tauriClient.getSettings();
      profiles = s.profiles;
      set({
        settingsHydrated: true,
        activeProfileId: s.activeProfileId,
        profiles,
        dataDirectory: s.dataDirectory,
        error: null,
      });
      const workspacePath = await tauriClient.getWorkspace();
      set({ workspacePath });
      if (workspacePath) {
        const workspaceItems = await tauriClient.listWorkspaceItems();
        set({ workspaceItems });
      } else {
        set({ workspaceItems: [] });
      }
    } catch (error) {
      const message = formatUnknownError(error);
      set({ settingsHydrated: true, error: message });
    }
  },

  selectActiveProfile: async profileId => {
    await withErrorHandling(set, async () => {
      await tauriClient.setActiveProfile(profileId);
      const s = await tauriClient.getSettings();
      set({
        activeProfileId: s.activeProfileId,
        profiles: s.profiles,
        syncMessage: null,
      });
      await reloadProfileScopedData(set, get);
    });
  },

  upsertProfileRemote: async profile => {
    await withErrorHandling(set, async () => {
      await tauriClient.upsertProfile(profile);
      const s = await tauriClient.getSettings();
      set({ profiles: s.profiles, activeProfileId: s.activeProfileId });
      if (profile.id === get().activeProfileId) {
        await get().loadWorkspace();
      }
    });
  },

  deleteProfileRemote: async profileId => {
    await withErrorHandling(set, async () => {
      await tauriClient.deleteProfile(profileId);
      const auth = { ...get().authSessionsByProfileId };
      delete auth[profileId];
      persistAuthMap(auth);
      const s = await tauriClient.getSettings();
      set({
        profiles: s.profiles,
        activeProfileId: s.activeProfileId,
        authSessionsByProfileId: auth,
      });
      await reloadProfileScopedData(set, get);
    });
  },

  setSelectedObservationId: id => set({ selectedObservationId: id }),
  clearError: () => set({ error: null }),

  loadWorkspace: async () =>
    withErrorHandling(set, async () => {
      const workspacePath = await tauriClient.getWorkspace();
      set({ workspacePath });
      if (workspacePath) {
        await get().refreshWorkspaceItems();
      } else {
        set({ workspaceItems: [] });
      }
    }),

  setWorkspace: async path =>
    withErrorHandling(set, async () => {
      await tauriClient.setWorkspace(path);
      const s = await tauriClient.getSettings();
      set({
        workspacePath: await tauriClient.getWorkspace(),
        profiles: s.profiles,
      });
      await get().refreshWorkspaceItems();
      await get().loadHealth();
    }),

  refreshWorkspaceItems: async relativePath =>
    withErrorHandling(set, async () => {
      const workspaceItems = await tauriClient.listWorkspaceItems(relativePath);
      set({ workspaceItems });
    }),

  loadObservations: async (query, opts) =>
    withErrorHandling(set, async () => {
      const prev = get().observationListParams;
      const q = query !== undefined ? query : prev.query;
      const formType =
        opts?.formType !== undefined ? opts.formType : prev.formType;
      const page = opts?.page ?? prev.page;
      const pageSize = opts?.pageSize ?? prev.pageSize;
      const res = await tauriClient.listObservationsPage(q, {
        formType,
        limit: pageSize,
        offset: page * pageSize,
      });
      set({
        observations: res.rows,
        observationsTotal: res.total,
        observationListParams: {
          query: q,
          formType,
          page,
          pageSize,
        },
      });
    }),

  loadFormTypes: async () =>
    withErrorHandling(set, async () => {
      const formTypes = await tauriClient.listFormTypes();
      set({ formTypes });
    }),

  loadHealth: async () =>
    withErrorHandling(set, async () => {
      const health = await tauriClient.getAppHealth();
      set({ health });
    }),

  saveObservation: async request =>
    withErrorHandling(set, async () => {
      await tauriClient.saveObservation(request);
      await get().loadObservations();
      await get().loadHealth();
      set({ syncMessage: 'Saved locally. Observation is now pending push.' });
    }),

  restoreLastBackup: async observationId =>
    withErrorHandling(set, async () => {
      await tauriClient.restoreLastBackup(observationId);
      await get().loadObservations();
      await get().loadHealth();
      set({ syncMessage: 'Restored last known good backup.' });
    }),

  synkLogin: async request =>
    withErrorHandling(set, async () => {
      const authSession = await syncGateway.login(request);
      const id = get().activeProfileId;
      const next = { ...get().authSessionsByProfileId, [id]: authSession };
      persistAuthMap(next);
      set({
        authSessionsByProfileId: next,
        syncMessage: 'Authenticated with Synkronus.',
      });
    }),

  synkPull: async request =>
    withErrorHandling(set, async () => {
      const runPull = async () => {
        const id = get().activeProfileId;
        const authSession = get().authSessionsByProfileId[id];
        if (!authSession) {
          throw new Error('Authenticate first before pull.');
        }
        const baseUrl = request.baseUrl ?? authSession.baseUrl;
        const token = request.token ?? authSession.token;
        const result = await pullSyncWithAttachments(
          baseUrl,
          token,
          getOrCreateClientId(id),
        );
        await get().loadObservations();
        await get().loadHealth();
        const att = result.attachmentsDownloaded ?? 0;
        set({
          syncMessage: `Pulled ${result.imported} observations (${result.conflicts} conflicts), ${att} attachment file(s).`,
        });
        return result;
      };
      try {
        return await runPull();
      } catch (error) {
        if (isSyncHttpUnauthorized(error)) {
          await reauthenticateActiveProfile(set, get);
          return await runPull();
        }
        throw error;
      }
    }),

  synkPush: async request =>
    withErrorHandling(set, async () => {
      const runPush = async () => {
        const id = get().activeProfileId;
        const authSession = get().authSessionsByProfileId[id];
        if (!authSession) {
          throw new Error('Authenticate first before push.');
        }
        const dirtyObservations = get().observations.filter(o => o.dirty);
        if (dirtyObservations.length === 0) {
          set({ syncMessage: 'No dirty observations to push.' });
          return 0;
        }

        const syncState = await tauriClient.getSyncState();
        const pushResult = await syncGateway.push({
          baseUrl: request.baseUrl ?? authSession.baseUrl,
          token: request.token ?? authSession.token,
          clientId: getOrCreateClientId(id),
          observations: dirtyObservations,
          repositoryGeneration: syncState.repositoryGeneration,
        });

        if (pushResult.acceptedIds.length > 0) {
          await tauriClient.markObservationsPushed(pushResult.acceptedIds);
        }
        await tauriClient.setSyncState({
          repositoryGeneration: pushResult.repositoryGeneration,
        });
        await get().loadObservations();
        await get().loadHealth();
        set({
          syncMessage:
            pushResult.failedIds.length > 0
              ? `Pushed ${pushResult.acceptedIds.length} observations, ${pushResult.failedIds.length} failed (${pushResult.warningCount} warnings).`
              : `Pushed ${pushResult.acceptedIds.length} dirty observations.`,
        });
        return pushResult.acceptedIds.length;
      };
      try {
        return await runPush();
      } catch (error) {
        if (isSyncHttpUnauthorized(error)) {
          await reauthenticateActiveProfile(set, get);
          return await runPush();
        }
        throw error;
      }
    }),

  synkResetServerRepository: async request =>
    withErrorHandling(set, async () => {
      const run = async () => {
        const id = get().activeProfileId;
        const authSession = get().authSessionsByProfileId[id];
        if (!authSession) {
          throw new Error(
            'Authenticate first before resetting the server repository.',
          );
        }
        const baseUrl = (request?.baseUrl ?? authSession.baseUrl).trim();
        const token = authSession.token;
        const reset = await callAdminRepositoryReset(baseUrl, token);
        const result = await pullSyncWithAttachments(
          baseUrl,
          token,
          getOrCreateClientId(id),
        );
        await get().loadWorkspace();
        await get().loadObservations();
        await get().loadHealth();
        const att = result.attachmentsDownloaded ?? 0;
        set({
          syncMessage:
            `Server repository reset (generation ${reset.repository_generation}). ` +
            `Pulled ${result.imported} observations (${result.conflicts} conflicts), ${att} attachment file(s).`,
        });
        return result;
      };
      try {
        return await run();
      } catch (error) {
        if (error instanceof ResponseError && error.response.status === 401) {
          await reauthenticateActiveProfile(set, get);
          return await run();
        }
        throw error;
      }
    }),

  repairRepository: async () =>
    withErrorHandling(set, async () => {
      const health = await tauriClient.repairRepository();
      set({ health, syncMessage: 'Repository maintenance completed.' });
    }),
}));

export function selectActiveProfileState(state: CustodianState) {
  return state.profiles.find(p => p.id === state.activeProfileId) ?? null;
}

export function selectAuthSessionForActiveProfile(state: CustodianState) {
  return state.authSessionsByProfileId[state.activeProfileId] ?? null;
}
