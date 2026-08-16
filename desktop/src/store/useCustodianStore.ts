import { create } from 'zustand';
import { tauriClient } from '../lib/tauriClient';
import { SYNKRONUS_CLIENT_VERSION } from '../lib/synkConstants';
import {
  ensureCustodianSyncEventPipeline,
  registerSyncJobWaiter,
  setCustodianSyncProgressHandler,
  SyncPausedError,
} from '../lib/syncTauriEvents';
import { partitionPendingPushObservations } from '../lib/pushAttachmentAudit';
import { getOrCreateClientId, syncGateway } from '../services/synk';
import { isSyncHttpUnauthorized } from '../services/synk/syncErrors';
import type {
  AppHealth,
  AuthSession,
  ObservationIndexPromptState,
  ObservationRecord,
  SaveObservationRequest,
  ServerProfile,
  SyncJobRowOut,
  SyncLoginRequest,
  SyncProgressPayload,
  SyncPullRequest,
  SyncPushRequest,
  SyncResumeJobRequest,
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

let lastHealthPollDuringSync = 0;

/** Avoid banner text like `Working … (3/10) (3/10)` when the message already embeds a fraction. */
const INLINE_FRACTION = /\(\s*\d+\s*\/\s*\d+\s*\)/;

function syncBannerLineFromProgress(p: SyncProgressPayload): string {
  const base = p.message.trimEnd();
  if (p.total > 0 && !INLINE_FRACTION.test(base)) {
    return `${base} (${p.done}/${p.total})`;
  }
  return base;
}

function attachSyncProgressToStore(
  set: (partial: Partial<CustodianState>) => void,
  get: () => CustodianState,
  capture: { current: string },
): (p: SyncProgressPayload) => void {
  return (p: SyncProgressPayload) => {
    const line = syncBannerLineFromProgress(p);
    capture.current = line;
    const now = Date.now();
    if (now - lastHealthPollDuringSync > 2000) {
      lastHealthPollDuringSync = now;
      void get().loadHealth();
    }
    set({
      syncActivity: {
        op: p.op,
        statusText: line,
      },
    });
  };
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
    } catch (refreshError) {
      const cred = await tauriClient.credentialGet(id);
      const password = cred.password ?? '';
      if (!password.trim()) {
        // No password fallback: surface the refresh failure (401 clears session
        // in recover; network errors keep the stored refresh token).
        throw refreshError;
      }
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

function clearActiveProfileAuthSession(
  set: (partial: Partial<CustodianState>) => void,
  get: () => CustodianState,
): void {
  const id = get().activeProfileId;
  if (!id || !get().authSessionsByProfileId[id]) {
    return;
  }
  const auth = { ...get().authSessionsByProfileId };
  delete auth[id];
  persistAuthMap(auth);
  set({ authSessionsByProfileId: auth });
}

async function awaitSyncJobTerminal(
  jobId: string,
  set: (partial: Partial<CustodianState>) => void,
  get: () => CustodianState,
  buildResume: () => SyncResumeJobRequest,
  initialWait: Promise<void>,
): Promise<void> {
  let wait = initialWait;
  for (;;) {
    try {
      await wait;
      return;
    } catch (e) {
      if (
        e instanceof SyncPausedError &&
        (e.code === 'needs_auth' || e.code === 'transient')
      ) {
        if (e.code === 'needs_auth') {
          await reauthenticateActiveProfile(set, get);
        }
        wait = registerSyncJobWaiter(jobId);
        await tauriClient.syncResumeJob(buildResume());
        continue;
      }
      throw e;
    }
  }
}

async function awaitSyncCompletion(
  jobId: string,
  set: (partial: Partial<CustodianState>) => void,
  get: () => CustodianState,
  buildResume: () => SyncResumeJobRequest,
): Promise<void> {
  await awaitSyncJobTerminal(
    jobId,
    set,
    get,
    buildResume,
    registerSyncJobWaiter(jobId),
  );
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
  syncActivity: {
    op: 'pull' | 'push' | 'reset';
    statusText: string;
  } | null;
  bundleActivity: {
    jobId: string;
    statusText: string;
    done: number;
    total: number;
  } | null;
  exportActivity: {
    statusText: string;
    done: number;
    total: number;
  } | null;
  /** Persisted Rust sync job awaiting resume (transient stall, auth, or cold start). */
  syncPausedJob: SyncJobRowOut | null;
  /** Bumped after each successful `refresh_custom_app_dev_mirror` (Workbench embeds). */
  devMirrorGeneration: number;
  devBusy: boolean;
  devError: string | null;
  observationIndexPrompt: ObservationIndexPromptState | null;
  indexCreateBusy: boolean;
  indexCreateError: string | null;
  refreshDevMirror: () => Promise<boolean>;
  setDevError: (message: string | null) => void;
  setBundleActivity: (activity: CustodianState['bundleActivity']) => void;
  clearBundleActivity: () => void;
  setExportActivity: (activity: CustodianState['exportActivity']) => void;
  clearExportActivity: () => void;
  dismissObservationIndexPrompt: () => void;
  createPendingObservationIndexes: () => Promise<boolean>;
  refreshSettings: () => Promise<void>;
  selectActiveProfile: (profileId: string) => Promise<void>;
  upsertProfileRemote: (profile: ServerProfile) => Promise<void>;
  deleteProfileRemote: (profileId: string) => Promise<void>;
  setSelectedObservationId: (id: string | null) => void;
  clearError: () => void;
  clearSyncMessage: () => void;
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
  synkLogin: (request: SyncLoginRequest) => Promise<void>;
  synkPull: (request?: SyncPullRequest) => Promise<void>;
  synkPush: (request?: SyncPushRequest) => Promise<number>;
  /**
   * Admin API: wipes server observations and attachment manifest, increments repository
   * generation, then pulls so the client archives the prior generation and aligns.
   */
  synkResetServerRepository: (request?: { baseUrl?: string }) => Promise<void>;
  refreshPausedSyncJob: () => Promise<void>;
  resumePausedSyncEngineJob: () => Promise<void>;
  /** Returns true when the active profile has a bearer token (silent refresh/login if needed). */
  ensureActiveProfileAuth: () => Promise<boolean>;
  /** Re-runs refresh-token / saved-password login (e.g. after HTTP 401). */
  recoverActiveProfileAuth: () => Promise<boolean>;
  syncPauseInFlight: () => Promise<void>;
  syncContinueInFlight: () => Promise<void>;
  syncCancelJob: (jobId?: string | null) => Promise<void>;
  resetLocalWorkspaceData: () => Promise<void>;
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
  syncActivity: null,
  bundleActivity: null,
  exportActivity: null,
  syncPausedJob: null,
  devMirrorGeneration: 0,
  devBusy: false,
  devError: null,
  observationIndexPrompt: null,
  indexCreateBusy: false,
  indexCreateError: null,

  setDevError: message => set({ devError: message }),

  setBundleActivity: activity => set({ bundleActivity: activity }),
  clearBundleActivity: () => set({ bundleActivity: null }),
  setExportActivity: activity => set({ exportActivity: activity }),
  clearExportActivity: () => set({ exportActivity: null }),

  ensureActiveProfileAuth: async () => {
    try {
      await reauthenticateActiveProfile(set, get);
      return true;
    } catch (e) {
      if (isSyncHttpUnauthorized(e)) {
        clearActiveProfileAuthSession(set, get);
      }
      return false;
    }
  },

  recoverActiveProfileAuth: async () => {
    try {
      await reauthenticateActiveProfile(set, get);
      return true;
    } catch (e) {
      if (isSyncHttpUnauthorized(e)) {
        clearActiveProfileAuthSession(set, get);
      }
      return false;
    }
  },

  dismissObservationIndexPrompt: () =>
    set({ observationIndexPrompt: null, indexCreateError: null }),

  createPendingObservationIndexes: async () => {
    set({ indexCreateBusy: true, indexCreateError: null });
    try {
      const result = await tauriClient.createObservationSqliteIndexes();
      if (result.createdCount === 0) {
        set({
          observationIndexPrompt: null,
          indexCreateError: null,
        });
        return true;
      }
      set({
        observationIndexPrompt: null,
        indexCreateError: null,
      });
      return true;
    } catch (e) {
      set({
        indexCreateError: e instanceof Error ? e.message : String(e),
      });
      return false;
    } finally {
      set({ indexCreateBusy: false });
    }
  },

  refreshDevMirror: async () => {
    set({ devBusy: true });
    try {
      const mirrorResult = await tauriClient.refreshCustomAppDevMirror();
      const pending = mirrorResult.pendingSqliteIndexStatements ?? [];
      const needsIndexes =
        mirrorResult.sqliteIndexesNeeded === true && pending.length > 0;
      set(state => ({
        devError: null,
        devMirrorGeneration: state.devMirrorGeneration + 1,
        observationIndexPrompt: needsIndexes
          ? {
              pendingStatements: pending,
              indexDefsLoaded: mirrorResult.indexDefsLoaded ?? pending.length,
            }
          : null,
      }));
      return true;
    } catch (e) {
      set({
        devError: e instanceof Error ? e.message : String(e),
      });
      return false;
    } finally {
      set({ devBusy: false });
    }
  },

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
      await get().refreshPausedSyncJob();
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
      await get().refreshPausedSyncJob();
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

  clearSyncMessage: () => set({ syncMessage: null }),

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
      await ensureCustodianSyncEventPipeline();
      const capture = { current: '' };
      setCustodianSyncProgressHandler(
        attachSyncProgressToStore(set, get, capture),
      );
      set({
        syncMessage: null,
        syncActivity: { op: 'pull', statusText: 'Pulling…' },
      });
      try {
        const id = get().activeProfileId;
        const authSession = get().authSessionsByProfileId[id];
        if (!authSession) {
          throw new Error('Authenticate first before pull.');
        }
        const baseUrl = (request?.baseUrl ?? authSession.baseUrl).trim();
        const token = request?.token ?? authSession.token;
        const clientId = getOrCreateClientId(id);
        const { jobId } = await tauriClient.syncStart({
          op: 'pull',
          baseUrl,
          bearerToken: token,
          clientId,
          xOdeVersion: SYNKRONUS_CLIENT_VERSION,
        });
        const resumePayloadBound = (): SyncResumeJobRequest => ({
          jobId,
          baseUrl,
          bearerToken: get().authSessionsByProfileId[id].token,
          clientId: getOrCreateClientId(id),
          xOdeVersion: SYNKRONUS_CLIENT_VERSION,
        });
        await awaitSyncCompletion(jobId, set, get, resumePayloadBound);
        await get().loadObservations();
        await get().loadHealth();
        set({
          syncMessage: capture.current.trim() || 'Pull finished.',
        });
      } finally {
        setCustodianSyncProgressHandler(null);
        set({ syncActivity: null });
        await get().refreshPausedSyncJob();
      }
    }),

  synkPush: async request =>
    withErrorHandling(set, async () => {
      await ensureCustodianSyncEventPipeline();
      const capture = { current: '' };
      setCustodianSyncProgressHandler(
        attachSyncProgressToStore(set, get, capture),
      );
      set({
        syncMessage: null,
        syncActivity: { op: 'push', statusText: 'Preparing push…' },
      });
      try {
        const id = get().activeProfileId;
        const authSession = get().authSessionsByProfileId[id];
        if (!authSession) {
          throw new Error('Authenticate first before push.');
        }
        const baseUrl = (request?.baseUrl ?? authSession.baseUrl).trim();
        const token = request?.token ?? authSession.token;
        const pendingPushObservations =
          await tauriClient.listDirtyObservations();
        if (pendingPushObservations.length === 0) {
          set({ syncMessage: 'No pending observations to push.' });
          return 0;
        }

        const forceMissing = Boolean(request?.forcePushMissingAttachments);
        const { readyToPush, missingAttachmentIssues } =
          await partitionPendingPushObservations(
            pendingPushObservations,
            forceMissing,
          );

        const skipSummary =
          missingAttachmentIssues.length > 0 && !forceMissing
            ? ` Skipped ${missingAttachmentIssues.length} observation(s) with missing attachment file(s): ${missingAttachmentIssues
                .map(
                  s =>
                    `${s.id} (form: ${s.formType}; missing: ${s.missing.map(n => `"${n}"`).join(', ')})`,
                )
                .join('; ')}.`
            : '';

        const forceMissingSummary =
          missingAttachmentIssues.length > 0 && forceMissing
            ? ` Included ${missingAttachmentIssues.length} observation(s) with missing attachment(s) (forced): ${missingAttachmentIssues
                .map(
                  s =>
                    `${s.id} (form: ${s.formType}; missing: ${s.missing.map(n => `"${n}"`).join(', ')})`,
                )
                .join('; ')}.`
            : '';

        if (
          missingAttachmentIssues.length > 0 &&
          forceMissing &&
          request?.onMissingAttachmentReport
        ) {
          request.onMissingAttachmentReport(
            missingAttachmentIssues.map(
              s =>
                `Force push — observation ${s.id}, form "${s.formType}", missing file(s): ${s.missing.join(', ')}`,
            ),
          );
        }

        if (readyToPush.length === 0) {
          set({
            syncMessage: `Nothing pushed.${skipSummary}`.trim(),
          });
          return 0;
        }

        const clientId = getOrCreateClientId(id);
        const { jobId } = await tauriClient.syncStart({
          op: 'push',
          baseUrl,
          bearerToken: token,
          clientId,
          xOdeVersion: SYNKRONUS_CLIENT_VERSION,
          pushPrepare: {
            readyObservationIds: readyToPush.map(o => o.id),
            skipSummary: skipSummary.trim() ? skipSummary : undefined,
          },
        });
        const resumePayloadBound = (): SyncResumeJobRequest => ({
          jobId,
          baseUrl,
          bearerToken: get().authSessionsByProfileId[id].token,
          clientId: getOrCreateClientId(id),
          xOdeVersion: SYNKRONUS_CLIENT_VERSION,
        });
        await awaitSyncCompletion(jobId, set, get, resumePayloadBound);
        await get().loadObservations();
        await get().loadHealth();
        const acceptedMatch = capture.current.match(/(\d+)\s+accepted/);
        const accepted =
          acceptedMatch !== null
            ? Number(acceptedMatch[1])
            : readyToPush.length;
        set({
          syncMessage:
            `${capture.current.trim()}${skipSummary}${forceMissingSummary}`.trim(),
        });
        return accepted;
      } finally {
        setCustodianSyncProgressHandler(null);
        set({ syncActivity: null });
        await get().refreshPausedSyncJob();
      }
    }),

  synkResetServerRepository: async request =>
    withErrorHandling(set, async () => {
      await ensureCustodianSyncEventPipeline();
      const capture = { current: '' };
      setCustodianSyncProgressHandler(
        attachSyncProgressToStore(set, get, capture),
      );
      set({
        syncMessage: null,
        syncActivity: {
          op: 'reset',
          statusText: 'Resetting server repository…',
        },
      });
      try {
        const id = get().activeProfileId;
        const authSession = get().authSessionsByProfileId[id];
        if (!authSession) {
          throw new Error(
            'Authenticate first before resetting the server repository.',
          );
        }
        const baseUrl = (request?.baseUrl ?? authSession.baseUrl).trim();
        const token = authSession.token;
        const clientId = getOrCreateClientId(id);
        const { jobId } = await tauriClient.syncStart({
          op: 'reset',
          baseUrl,
          bearerToken: token,
          clientId,
          xOdeVersion: SYNKRONUS_CLIENT_VERSION,
        });
        const resumePayloadBound = (): SyncResumeJobRequest => ({
          jobId,
          baseUrl,
          bearerToken: get().authSessionsByProfileId[id].token,
          clientId: getOrCreateClientId(id),
          xOdeVersion: SYNKRONUS_CLIENT_VERSION,
        });
        await awaitSyncCompletion(jobId, set, get, resumePayloadBound);
        await get().loadWorkspace();
        await get().loadObservations();
        await get().loadHealth();
        set({
          syncMessage:
            capture.current.trim() ||
            'Server repository reset and pull finished.',
        });
      } finally {
        setCustodianSyncProgressHandler(null);
        set({ syncActivity: null });
        await get().refreshPausedSyncJob();
      }
    }),

  refreshPausedSyncJob: async () => {
    try {
      const row = await tauriClient.syncGetStatus();
      const paused =
        row && (row.status === 'paused' || row.status === 'failed')
          ? row
          : null;
      set({ syncPausedJob: paused });
    } catch {
      set({ syncPausedJob: null });
    }
  },

  resumePausedSyncEngineJob: async () =>
    withErrorHandling(set, async () => {
      const row = get().syncPausedJob;
      if (!row) {
        throw new Error('No paused sync job to resume.');
      }
      await ensureCustodianSyncEventPipeline();
      const capture = { current: '' };
      setCustodianSyncProgressHandler(
        attachSyncProgressToStore(set, get, capture),
      );
      set({
        syncActivity: {
          op: row.op as 'pull' | 'push' | 'reset',
          statusText: row.progressMessage ?? 'Resuming sync…',
        },
      });
      try {
        const id = get().activeProfileId;
        const authSession = get().authSessionsByProfileId[id];
        if (!authSession) {
          throw new Error('Authenticate first before resuming sync.');
        }
        const baseUrl = (authSession.baseUrl ?? '').trim();
        const resumePayloadBound = (): SyncResumeJobRequest => ({
          jobId: row.id,
          baseUrl,
          bearerToken: get().authSessionsByProfileId[id].token,
          clientId: getOrCreateClientId(id),
          xOdeVersion: SYNKRONUS_CLIENT_VERSION,
        });
        const initialWait = registerSyncJobWaiter(row.id);
        await tauriClient.syncResumeJob(resumePayloadBound());
        await awaitSyncJobTerminal(
          row.id,
          set,
          get,
          resumePayloadBound,
          initialWait,
        );
        await get().loadWorkspace();
        await get().loadObservations();
        await get().loadHealth();
        if (capture.current.trim()) {
          set({ syncMessage: capture.current.trim() });
        }
      } finally {
        setCustodianSyncProgressHandler(null);
        set({ syncActivity: null });
        await get().refreshPausedSyncJob();
      }
    }),

  syncPauseInFlight: async () => {
    await tauriClient.syncPause();
  },

  syncContinueInFlight: async () => {
    await tauriClient.syncContinue();
  },

  syncCancelJob: async jobId => {
    await tauriClient.syncCancel(jobId ?? undefined);
    set({ syncActivity: null });
    await get().refreshPausedSyncJob();
    await get().loadHealth();
  },

  resetLocalWorkspaceData: async () =>
    withErrorHandling(set, async () => {
      await tauriClient.resetLocalWorkspaceData();
      await reloadProfileScopedData(set, get);
      set({
        selectedObservationId: null,
        syncMessage:
          'Local data reset: observations cleared, attachments removed, sync offsets reset.',
      });
    }),
}));

export function selectActiveProfileState(state: CustodianState) {
  return state.profiles.find(p => p.id === state.activeProfileId) ?? null;
}

export function selectAuthSessionForActiveProfile(state: CustodianState) {
  return state.authSessionsByProfileId[state.activeProfileId] ?? null;
}

export function selectSyncActivity(state: CustodianState) {
  return state.syncActivity;
}

export function selectBundleActivity(state: CustodianState) {
  return state.bundleActivity;
}

export function selectExportActivity(state: CustodianState) {
  return state.exportActivity;
}

export function selectPausedSyncJob(state: CustodianState) {
  return state.syncPausedJob;
}
