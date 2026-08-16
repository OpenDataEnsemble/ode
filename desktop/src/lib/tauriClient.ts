import { invoke, isTauri } from '@tauri-apps/api/core';
import type {
  ApiObservation,
  AppHealth,
  AppSettings,
  AuthSession,
  CredentialDeleteResult,
  CredentialGetResult,
  CredentialSetResult,
  ImportResult,
  ImportStagingScanEntry,
  ImportSyncAppearanceScanResult,
  ParsedImportFileResult,
  AttachmentCopyBatchResult,
  HostTextReadResult,
  ListObservationsPageResult,
  ObservationOverviewResult,
  OutboundAttachmentUploadResult,
  ObservationRecord,
  WorkspaceAttachmentPresenceEntry,
  SaveObservationRequest,
  StartObservationIndexRebuildResult,
  ServerProfile,
  ActiveBundleFormEntry,
  AppBundleState,
  DownloadAndApplyAppBundleResult,
  PushDevMirrorAppBundleResult,
  CreateObservationSqliteIndexesResult,
  CustomAppDevMirrorResult,
  BundleFormSpec,
  SetSyncStateRequest,
  SyncLoginRequest,
  SyncResumeJobRequest,
  SyncJobRowOut,
  SyncStartAck,
  SyncStartRequest,
  SyncStateInfo,
  WorkspaceItem,
  ExportParquetRequest,
  ExportParquetResult,
} from '../types/domain';

const NOT_IN_TAURI_MESSAGE =
  'ODE Desktop must run in the Tauri shell (not a browser tab). From desktop/, run: pnpm tauri dev';

function invokeSafe<T>(command: string, payload?: Record<string, unknown>) {
  if (!isTauri()) {
    return Promise.reject(new Error(NOT_IN_TAURI_MESSAGE));
  }
  return invoke<T>(command, payload);
}

export { NOT_IN_TAURI_MESSAGE };

export const tauriClient = {
  getSettings: () => invokeSafe<AppSettings>('get_settings'),
  setActiveProfile: (profileId: string) =>
    invokeSafe<void>('set_active_profile', { profileId }),
  upsertProfile: (profile: ServerProfile) =>
    invokeSafe<void>('upsert_profile', { profile }),
  deleteProfile: (profileId: string) =>
    invokeSafe<void>('delete_profile', { profileId }),
  credentialSet: (profileId: string, password: string) =>
    invokeSafe<CredentialSetResult>('credential_set', {
      profileId,
      password,
    }),
  credentialGet: (profileId: string) =>
    invokeSafe<CredentialGetResult>('credential_get', {
      profileId,
    }),
  credentialDelete: (profileId: string) =>
    invokeSafe<CredentialDeleteResult>('credential_delete', {
      profileId,
    }),

  getWorkspace: () => invokeSafe<string | null>('get_workspace'),
  setWorkspace: (path: string) => invokeSafe<void>('set_workspace', { path }),
  listWorkspaceItems: (relativePath?: string) =>
    invokeSafe<WorkspaceItem[]>('list_workspace_items', { relativePath }),
  listObservations: (query?: string, limit?: number) =>
    invokeSafe<ObservationRecord[]>('list_observations', { query, limit }),
  listObservationsPage: (
    query?: string,
    options?: {
      formType?: string | null;
      limit?: number;
      offset?: number;
    },
  ) =>
    invokeSafe<ListObservationsPageResult>('list_observations_page', {
      query,
      formType: options?.formType ?? null,
      limit: options?.limit,
      offset: options?.offset,
    }),
  queryObservations: (req: {
    formType: string;
    includeDeleted?: boolean;
    filter?: unknown;
    limit?: number;
  }) => invokeSafe<ObservationRecord[]>('query_observations', { req }),
  rebuildObservationIndexes: () =>
    invokeSafe<StartObservationIndexRebuildResult>(
      'rebuild_observation_indexes',
    ),
  startObservationIndexRebuild: () =>
    invokeSafe<StartObservationIndexRebuildResult>(
      'start_observation_index_rebuild',
    ),
  createObservationSqliteIndexes: () =>
    invokeSafe<CreateObservationSqliteIndexesResult>(
      'create_observation_sqlite_indexes',
    ),
  getObservationIndexStatus: () =>
    invokeSafe<{ activeGeneration: number; lastRebuildAt?: string | null }>(
      'get_observation_index_status',
    ),
  /** All `dirty` observations for push (not limited to the Observations table page). */
  listDirtyObservations: () =>
    invokeSafe<ObservationRecord[]>('list_dirty_observations'),
  listFormTypes: () => invokeSafe<string[]>('list_form_types'),
  getObservationOverview: () =>
    invokeSafe<ObservationOverviewResult>('get_observation_overview'),
  getSyncState: () => invokeSafe<SyncStateInfo>('get_sync_state'),
  setSyncState: (req: SetSyncStateRequest) =>
    invokeSafe<void>('set_sync_state', { req }),
  archiveWorkspaceForRepositoryGeneration: () =>
    invokeSafe<string>('archive_workspace_for_repository_generation'),
  moveWorkspace: (destination: string) =>
    invokeSafe<string>('move_workspace', { destination }),
  backupWorkspace: (zipPath: string) =>
    invokeSafe<string>('backup_workspace', { zipPath }),
  previewExportDir: (parentDir: string) =>
    invokeSafe<string>('preview_export_dir', { parentDir }),
  exportObservationsParquet: (request: ExportParquetRequest) =>
    invokeSafe<ExportParquetResult>('export_observations_parquet', {
      request,
    }),
  expandImportStagingPaths: (
    paths: string[],
    maxIndividualFiles?: number | null,
  ) =>
    invokeSafe<ImportStagingScanEntry[]>('expand_import_staging_paths', {
      paths,
      maxIndividualFiles: maxIndividualFiles ?? null,
    }),
  readHostTextFile: (path: string) =>
    invokeSafe<string>('read_host_text_file', { path }),
  hostPathIsDirectory: (path: string) =>
    invokeSafe<boolean>('host_path_is_directory', { path }),
  readHostTextFilesBatch: (paths: string[]) =>
    invokeSafe<HostTextReadResult[]>('read_host_text_files_batch', { paths }),
  parseImportObservationJsonPaths: (paths: string[]) =>
    invokeSafe<ParsedImportFileResult[]>(
      'parse_import_observation_json_paths',
      { paths },
    ),
  scanImportJsonSyncAppearance: (paths: string[]) =>
    invokeSafe<ImportSyncAppearanceScanResult>(
      'scan_import_json_sync_appearance',
      { paths },
    ),
  copyWorkspaceAttachmentsBatch: (
    items: { sourcePath: string; attachmentId: string }[],
  ) =>
    invokeSafe<AttachmentCopyBatchResult>('copy_workspace_attachments_batch', {
      items,
    }),
  /** Legacy: prefer {@link copyWorkspaceAttachmentsBatch} for imports. */
  writeWorkspaceAttachment: (attachmentId: string, data: Uint8Array) =>
    invokeSafe<void>('write_workspace_attachment', {
      attachmentId,
      data,
    }),
  copyWorkspaceAttachmentFromPath: (args: {
    attachmentId: string;
    sourcePath: string;
  }) =>
    invokeSafe<void>('copy_workspace_attachment_from_path', {
      sourcePath: args.sourcePath,
      attachmentId: args.attachmentId,
    }),
  /** GET `{base}/api/attachments/{id}` with Bearer token via native HTTP (avoids WebView fetch issues). */
  downloadWorkspaceAttachmentFromUrl: (args: {
    baseUrl: string;
    bearerToken: string;
    attachmentId: string;
    /** Must match OpenAPI `x-ode-version` (Synkronus rejects protected routes without it). */
    xOdeVersion: string;
  }) =>
    invokeSafe<void>('download_workspace_attachment_from_url', {
      baseUrl: args.baseUrl,
      bearerToken: args.bearerToken,
      attachmentId: args.attachmentId,
      xOdeVersion: args.xOdeVersion,
    }),
  /** Upload each file under `attachments/pending/` via Synkronus (legacy `extraAttachmentIds` ignored). */
  uploadOutboundAttachments: (args: {
    baseUrl: string;
    bearerToken: string;
    xOdeVersion: string;
    repositoryGeneration?: number;
    extraAttachmentIds?: string[];
  }) =>
    invokeSafe<OutboundAttachmentUploadResult>('upload_outbound_attachments', {
      baseUrl: args.baseUrl,
      bearerToken: args.bearerToken,
      xOdeVersion: args.xOdeVersion,
      repositoryGeneration: args.repositoryGeneration,
      extraAttachmentIds: args.extraAttachmentIds ?? [],
    }),
  /** Batch-resolve whether each attachment basename exists locally (same rules as push/upload). */
  checkWorkspaceAttachmentPresence: (fileNames: string[]) =>
    invokeSafe<WorkspaceAttachmentPresenceEntry[]>(
      'check_workspace_attachment_presence',
      { fileNames },
    ),
  /** Relative to active profile workspace root (e.g. `bundles/app-bundle.zip`). */
  writeWorkspaceFile: (relativePath: string, data: Uint8Array) =>
    invokeSafe<string>('write_workspace_file', {
      relativePath,
      data,
    }),
  getAppBundleState: () =>
    invokeSafe<AppBundleState | null>('get_app_bundle_state'),
  /** Mirrors profile `customAppLocalFolder` into `bundles/dev-local/app/`. */
  refreshCustomAppDevMirror: () =>
    invokeSafe<CustomAppDevMirrorResult>('refresh_custom_app_dev_mirror'),
  /** Native download + apply from Synkronus (no binary IPC). Progress via bundle/* events. */
  downloadAndApplyAppBundle: (args: {
    baseUrl: string;
    bearerToken: string;
    xOdeVersion: string;
    version: string;
    hash: string;
  }) =>
    invokeSafe<DownloadAndApplyAppBundleResult>(
      'download_and_apply_app_bundle',
      {
        baseUrl: args.baseUrl,
        bearerToken: args.bearerToken,
        xOdeVersion: args.xOdeVersion,
        version: args.version,
        hash: args.hash,
      },
    ),
  /** Zip dev mirror, push to Synkronus, and activate the new bundle version. */
  pushDevMirrorAppBundle: (args: {
    baseUrl: string;
    bearerToken: string;
    xOdeVersion: string;
  }) =>
    invokeSafe<PushDevMirrorAppBundleResult>('push_dev_mirror_app_bundle', {
      baseUrl: args.baseUrl,
      bearerToken: args.bearerToken,
      xOdeVersion: args.xOdeVersion,
    }),
  listActiveBundleForms: () =>
    invokeSafe<ActiveBundleFormEntry[]>('list_active_bundle_forms'),
  readBundleFormSpec: (formType: string) =>
    invokeSafe<BundleFormSpec>('read_bundle_form_spec', { formType }),
  readWorkspaceTextFile: (relativePath: string) =>
    invokeSafe<string>('read_workspace_text_file', { relativePath }),
  writeTextFile: (path: string, contents: string) =>
    invokeSafe<void>('write_text_file', { path, contents }),
  getActiveBundleFormsFileBaseUrl: () =>
    invokeSafe<string>('get_active_bundle_forms_file_base_url'),
  workspaceDirectoryFileUrl: (relativePath: string) =>
    invokeSafe<string>('workspace_directory_file_url', { relativePath }),
  /**
   * Basename-only resolution across `attachments/draft`, `attachments/pending`,
   * `attachments/synced`, then loose files directly under `attachments/`
   * (matches Formulus `resolveAttachmentFileUrl`).
   */
  workspaceAttachmentFileUrl: (fileName: string) =>
    invokeSafe<string | null>('workspace_attachment_file_url', { fileName }),
  /** Same behavior as {@link workspaceAttachmentFileUrl} (Tauri alias). */
  resolveAttachmentFileUrl: (fileName: string) =>
    invokeSafe<string | null>('resolve_attachment_file_url', { fileName }),
  scanBundleCustomQuestionTypes: () =>
    invokeSafe<Record<string, unknown>>('scan_bundle_custom_question_types'),
  removeWorkspaceAttachment: (attachmentId: string) =>
    invokeSafe<void>('remove_workspace_attachment', { attachmentId }),
  getObservation: (id: string) =>
    invokeSafe<ObservationRecord>('get_observation', { id }),
  saveObservation: (req: SaveObservationRequest) =>
    invokeSafe<ObservationRecord>('save_observation', { req }),
  /**
   * @param markPending When true (file import), observations are stored as pending push.
   *   When false/omitted, rows match server pull semantics (synced / conflict rules).
   * @param scheduleIndexRebuild When false, skips the post-import full index rebuild (use on
   *   intermediate write batches; default true for file import, false for server pull).
   */
  importObservations: (
    observations: ApiObservation[],
    options?: { markPending?: boolean; scheduleIndexRebuild?: boolean },
  ) =>
    invokeSafe<ImportResult>('import_observations', {
      observations,
      markPending: options?.markPending ?? false,
      scheduleIndexRebuild: options?.scheduleIndexRebuild,
    }),
  markObservationsPushed: (ids: string[]) =>
    invokeSafe<void>('mark_observations_pushed', { ids }),
  getAppHealth: () => invokeSafe<AppHealth>('get_app_health'),
  resetLocalWorkspaceData: () =>
    invokeSafe<AppHealth>('reset_local_workspace_data'),
  synkLogin: (req: SyncLoginRequest) =>
    invokeSafe<AuthSession>('synk_login', { req }),

  syncStart: (req: SyncStartRequest) =>
    invokeSafe<SyncStartAck>('sync_start', {
      req: {
        op: req.op,
        baseUrl: req.baseUrl,
        bearerToken: req.bearerToken,
        clientId: req.clientId,
        xOdeVersion: req.xOdeVersion,
        pushPrepare: req.pushPrepare
          ? {
              readyObservationIds: req.pushPrepare.readyObservationIds,
              ...(req.pushPrepare.extraAttachmentIds !== undefined
                ? { extraAttachmentIds: req.pushPrepare.extraAttachmentIds }
                : {}),
              skipSummary: req.pushPrepare.skipSummary ?? null,
            }
          : undefined,
      },
    }),

  syncPause: () => invokeSafe<void>('sync_pause'),

  syncContinue: () => invokeSafe<void>('sync_continue'),

  syncResumeJob: (resume: SyncResumeJobRequest) =>
    invokeSafe<void>('sync_resume_job', {
      resume: {
        jobId: resume.jobId,
        baseUrl: resume.baseUrl,
        bearerToken: resume.bearerToken,
        clientId: resume.clientId,
        xOdeVersion: resume.xOdeVersion,
      },
    }),

  syncCancel: (jobId?: string | null) =>
    invokeSafe<void>('sync_cancel', { jobId: jobId ?? null }),

  syncGetStatus: () => invokeSafe<SyncJobRowOut | null>('sync_get_status'),
};
