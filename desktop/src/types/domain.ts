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
  /** Envelope fields (geolocation, author, tags, …) — stored as observation_extras locally. */
  extras?: ObservationExtras | null;
}

/** One file discovered for import staging (Rust walk of dialog/drop paths). */
export interface ImportStagingScanEntry {
  path: string;
  fileName: string;
  size: number;
  lastModifiedMs: number;
  isJson: boolean;
}

/** One row from {@link readHostTextFilesBatch}. */
export interface HostTextReadResult {
  path: string;
  text?: string;
  error?: string;
}

/** One parsed JSON file from {@link parseImportObservationJsonPaths} (Rust). */
export interface ParsedImportFileResult {
  fileName: string;
  observations: ApiObservation[];
  error?: string;
}

/** Lightweight sync-appearance scan over staged Formulus export JSON. */
export interface ImportSyncAppearanceScanResult {
  fileCount: number;
  observationCount: number;
  apparentlySyncedCount: number;
  unsyncedCount: number;
  parseErrorCount: number;
  /** Absolute paths to retain when skipping already-synced observations. */
  unsyncedPaths: string[];
}

/** One issue from host-side import validation ({@link parseAndValidateImportJsonPaths}). */
export interface ImportHostIssue {
  severity: 'error' | 'warning' | string;
  code: string;
  message: string;
  fileName?: string;
  observationId?: string;
  formType?: string | null;
}

/** Result of parallel Rust parse + schema/attachment validation. */
export interface ImportValidateBatchResult {
  files: ParsedImportFileResult[];
  issues: ImportHostIssue[];
  observationCount: number;
  formTypeCount: number;
  referencedAttachmentNames: string[];
  missingAttachmentNames: string[];
  orphanAttachmentNames: string[];
}

export interface AttachmentCopyBatchResult {
  copied: number;
  failed: number;
  errors: string[];
}

export interface ImportResult {
  imported: number;
  conflicts: number;
  /** Local attachment files written during pull (when attachment sync runs). */
  attachmentsDownloaded?: number;
  /** Download attempts that failed after a manifest op (e.g. HTTP error). */
  attachmentsFailed?: number;
  /** Background full index rebuild was scheduled after this import. */
  indexRebuildScheduled?: boolean;
}

export interface StartObservationIndexRebuildResult {
  jobId: string;
  scheduled: boolean;
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

export interface ObservationOverviewRow {
  formType: string;
  observationCount: number;
  pendingSyncCount: number;
}

export interface ObservationTimelineBucket {
  bucketStart: string;
  label: string;
  count: number;
}

export interface ObservationOverviewTimeline {
  bucketUnit: 'day' | 'week';
  rangeStart: string;
  rangeEnd: string;
  buckets: ObservationTimelineBucket[];
  observationsWithoutDate: number;
}

export interface ObservationGeolocationSummary {
  withLocation: number;
  withoutLocation: number;
}

export interface ObservationMapPoint {
  id: string;
  formType: string;
  latitude: number;
  longitude: number;
}

export interface ObservationOverviewMap {
  points: ObservationMapPoint[];
  truncated: boolean;
  cap: number;
}

export interface ObservationOverviewResult {
  rows: ObservationOverviewRow[];
  totals: ObservationOverviewRow;
  timeline: ObservationOverviewTimeline;
  geolocationSummary: ObservationGeolocationSummary;
  map: ObservationOverviewMap;
  computedAt: string;
}

export interface AppHealth {
  workspacePath?: string | null;
  dbPath: string;
  totalObservations: number;
  /**
   * Observations with `dirty = 1` and `sync_status = 'dirty'` (eligible for push).
   * Conflicts (`sync_status = 'conflict'`) appear under {@link AppHealth.conflictCount}.
   */
  dirtyCount: number;
  /** Regular files across the local attachment layout (draft, synced, queues, loose). */
  totalAttachmentCount: number;
  /** Regular files under `attachments/pending` only. */
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
  /** Which mode subtree to open by default for this profile. */
  defaultAppMode?: DefaultAppMode | null;
  /** When true, Workbench custom app loads from a mirrored local folder instead of `bundles/active`. */
  customAppDeveloperMode?: boolean | null;
  /** Absolute path to a folder containing `index.html` (e.g. custom app `dist/`). */
  customAppLocalFolder?: string | null;
  /** Parent folder last chosen on the Export page (survives restart). */
  exportDestinationParent?: string | null;
  /** ISO timestamp of the last successful Parquet export for this profile. */
  lastExportAt?: string | null;
  /** Summary of the last successful export (folder, counts, parquet paths). */
  lastExport?: ExportParquetResult | null;
}

/** Result of mirroring a local custom app folder into the profile workspace. */
export interface CustomAppDevMirrorResult {
  sourcePath: string;
  mirroredIndexRelativePath: string;
  copiedFiles: number;
  indexDefsLoaded?: number;
  indexRebuildGeneration?: number | null;
  indexRebuildScheduled?: boolean;
  sqliteIndexesNeeded?: boolean;
  pendingSqliteIndexStatements?: string[];
}

export interface CreateObservationSqliteIndexesResult {
  createdCount: number;
  executedStatements: string[];
}

export interface ObservationIndexPromptState {
  pendingStatements: string[];
  indexDefsLoaded: number;
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

export interface DownloadAndApplyAppBundleResult {
  state: AppBundleState;
  indexRebuildScheduled: boolean;
}

export interface PushDevMirrorAppBundleResult {
  version: string;
  hash: string;
  message: string;
}

export type BundleApplyPhase =
  | 'downloading'
  | 'archiving'
  | 'extracting'
  | 'indexing'
  | 'completed'
  | 'failed';

/** Rust `bundle/apply-progress` and `bundle/index-rebuild` payloads. */
export interface BundleApplyProgressPayload {
  jobId: string;
  phase: BundleApplyPhase;
  done: number;
  total: number;
  message: string;
  detail?: string;
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
  /**
   * When true, observations whose referenced attachment files are absent locally are still sent on push.
   * Use {@link SyncPushRequest.onMissingAttachmentReport} to surface details.
   */
  forcePushMissingAttachments?: boolean;
  /** Called before the sync job starts when forcing observations with missing attachments. */
  onMissingAttachmentReport?: (lines: string[]) => void;
}

export type SyncOpKind = 'pull' | 'push' | 'reset';

export interface SyncProgressPayload {
  jobId: string;
  op: SyncOpKind;
  phase: string;
  done: number;
  total: number;
  detail?: string;
  message: string;
}

export interface SyncStatePayload {
  jobId: string;
  status: 'running' | 'paused' | 'completed' | 'cancelled' | 'failed';
  errorCode?: string | null;
  errorMessage?: string | null;
}

export interface SyncPushPreparePayload {
  readyObservationIds: string[];
  /** @deprecated Ignored — uploads use `attachments/pending/` only. */
  extraAttachmentIds?: string[];
  skipSummary?: string | null;
}

export interface SyncStartRequest {
  op: SyncOpKind;
  baseUrl: string;
  bearerToken: string;
  clientId: string;
  xOdeVersion: string;
  pushPrepare?: SyncPushPreparePayload;
}

export interface SyncStartAck {
  jobId: string;
}

export interface SyncResumeJobRequest {
  jobId: string;
  baseUrl: string;
  bearerToken: string;
  clientId: string;
  xOdeVersion: string;
}

/** Mirrors Rust `sync_engine::job::SyncJobRowOut` / `sync_get_status`. */
export interface SyncJobRowOut {
  id: string;
  op: string;
  status: string;
  phase: string;
  checkpointJson?: string | null;
  progressDone: number;
  progressTotal: number;
  progressMessage?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  retryCount: number;
  nextRetryAt?: string | null;
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

/** Result of local Parquet export (`export_observations_parquet`). */
export interface ExportParquetResult {
  exportDir: string;
  formTypeCounts: Record<string, number>;
  /** Absolute `.parquet` paths keyed by form type. */
  parquetFiles: Record<string, string>;
  totalRows: number;
  attachmentsCopied: number;
  attachmentsMissing: number;
  includePending: boolean;
  includeAttachments: boolean;
  workspaceAttachmentsPath: string;
  exportAttachmentsPath?: string | null;
  manifestPath: string;
}

export interface ExportParquetRequest {
  parentDir: string;
  includePending?: boolean;
  includeAttachments?: boolean;
  overwrite?: boolean;
  profileLabel?: string | null;
}
