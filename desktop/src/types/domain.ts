export type SyncStatus = 'clean' | 'dirty' | 'conflict';

export interface WorkspaceItem {
  path: string;
  name: string;
  isDir: boolean;
}

/**
 * Optional Synkronus `Observation` fields stored in `observation_extras` JSON
 * (see `ODE/synkronus/openapi/synkronus.yaml` — Observation).
 */
export interface ObservationExtras {
  formVersion?: string | null;
  createdAt?: string | null;
  deleted?: boolean | null;
  syncedAt?: string | null;
  geolocation?: unknown | null;
  author?: string | null;
  deviceId?: string | null;
  tags?: string[] | null;
}

/** Local row; `payload` is Synkronus `data`; `extras` holds optional envelope fields. */
export interface ObservationRecord {
  id: string;
  /** Synkronus `data` — must be a JSON object for sync. */
  payload: unknown;
  /** Synkronus `form_type`. */
  formType?: string | null;
  /** Synkronus `updated_at` (ISO 8601). */
  updatedAt?: string | null;
  remoteUpdatedAt?: string | null;
  /** Local row not yet successfully pushed (pending push). */
  dirty: boolean;
  syncStatus: SyncStatus;
  hasConflictCopy: boolean;
  lastSavedAt: string;
  lastPushedAt?: string | null;
  extras?: ObservationExtras | null;
}

export interface SaveObservationRequest {
  /** Synkronus `observation_id`. */
  id: string;
  /** Synkronus `data` — must be a JSON object for sync. */
  payload: unknown;
  /** Synkronus `form_type`. */
  formType?: string | null;
  /** Synkronus `updated_at`; if omitted, the backend uses the save time. */
  updatedAt?: string | null;
  extras?: ObservationExtras | null;
}

export interface ApiObservation {
  observationId: string;
  data: unknown;
  formType?: string | null;
  updatedAt?: string | null;
}

export interface ImportResult {
  imported: number;
  conflicts: number;
  /** Local attachment files written during pull (when attachment sync runs). */
  attachmentsDownloaded?: number;
  /** Download attempts that failed after a manifest op (e.g. HTTP error). */
  attachmentsFailed?: number;
}

/** Result of uploading outbound attachment files before `syncPush`. */
export interface OutboundAttachmentUploadResult {
  uploaded: number;
  skippedConflicts: number;
  /** Extras/queue entries with no local file (skipped without failing the run). */
  skippedMissing: number;
  failed: number;
  errorSummary?: string | null;
}

export interface WorkspaceAttachmentPresenceEntry {
  fileName: string;
  present: boolean;
}

export interface SyncStateInfo {
  /** `0` means not aligned with Synkronus yet (omit epoch on API calls; fresh profile). */
  repositoryGeneration: number;
  observationSyncVersion: number;
  lastAttachmentVersion: number;
}

export interface SetSyncStateRequest {
  repositoryGeneration?: number;
  observationSyncVersion?: number;
  lastAttachmentVersion?: number;
}

export interface ListObservationsPageResult {
  rows: ObservationRecord[];
  total: number;
}

export interface AppHealth {
  workspacePath?: string | null;
  dbPath: string;
  totalObservations: number;
  /** Count of observations pending push (see {@link ObservationRecord.dirty}). */
  dirtyCount: number;
  /** Regular files across the local attachment layout (draft, synced, queues, loose). */
  totalAttachmentCount: number;
  /** Files in `attachments/pending` (and legacy `pending_upload`) awaiting upload. */
  pendingAttachmentCount: number;
  conflictCount: number;
  lastSaveAt?: string | null;
  lastPullAt?: string | null;
  lastPushAt?: string | null;
}

export interface AuthSession {
  baseUrl: string;
  token: string;
  refreshToken?: string;
  expiresAt?: number;
}

/** Client-side server tier for confirmation strictness (mirrors Rust `ProfileEnvironment`). */
export type ProfileEnvironment = 'production' | 'staging' | 'development';

/** Default sidebar mode when opening the app or switching profiles (mirrors Rust `DefaultAppMode`). */
export type DefaultAppMode = 'data_management' | 'workbench';

/** One Synkronus server + local paths + DB (see Rust `ServerProfile`). */
export interface ServerProfile {
  id: string;
  label: string;
  serverUrl: string;
  username?: string | null;
  workspacePath?: string | null;
  databasePath: string;
  attachmentsPath?: string | null;
  /** Client-only guardrail; not sent to Synkronus as an API mode. */
  environment?: ProfileEnvironment | null;
  /** Which mode subtree to open by default for this profile. */
  defaultAppMode?: DefaultAppMode | null;
}

export interface AppSettings {
  activeProfileId: string;
  profiles: ServerProfile[];
  dataDirectory: string;
}

/** Mirrors Rust `AppBundleState` under `<workspace>/bundles/state.json`. */
export interface AppBundleState {
  schemaVersion: number;
  activeVersion: string;
  activeHash: string;
  downloadedAt: string;
  archivedVersions: string[];
}

/** One form folder under `bundles/active/forms/` (or `bundles/active/app/forms/`). */
export interface ActiveBundleFormEntry {
  formType: string;
}

/** Loaded `schema.json` + `ui.json` for a form type. */
export interface BundleFormSpec {
  formType: string;
  formSchema: unknown;
  uiSchema: unknown;
}

/** Result of reading a password from the OS secure store (keyring). */
export interface CredentialGetResult {
  password: string | null;
  storageAvailable: boolean;
}

/** Result of saving a password to the OS secure store. */
export interface CredentialSetResult {
  saved: boolean;
  warning?: string | null;
}

/** Result of clearing a stored password. */
export interface CredentialDeleteResult {
  cleared: boolean;
  warning?: string | null;
}

export interface SyncLoginRequest {
  baseUrl: string;
  username: string;
  password: string;
}

export interface SyncPullRequest {
  baseUrl?: string;
  endpoint?: string;
  token?: string;
}

export interface SyncPushRequest {
  baseUrl?: string;
  endpoint?: string;
  token?: string;
}

// Thin domain layer between UI and storage representations.
export interface ObservationDomainRecord {
  id: string;
  payloadText: string;
  formType: string;
  dirtyState: DirtyState;
  syncStatus: SyncStatus;
  updatedAt?: string | null;
  remoteUpdatedAt?: string | null;
}

export type DirtyState = 'unsaved' | 'savedLocalDirty' | 'clean';

export interface WorkspaceDomainItem {
  id: string;
  label: string;
  path: string;
  kind: 'directory' | 'file';
}
