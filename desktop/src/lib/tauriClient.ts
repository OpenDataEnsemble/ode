import { invoke } from '@tauri-apps/api/core';
import type {
  ApiObservation,
  AppHealth,
  AppSettings,
  AuthSession,
  CredentialDeleteResult,
  CredentialGetResult,
  CredentialSetResult,
  ImportResult,
  ListObservationsPageResult,
  ObservationRecord,
  SaveObservationRequest,
  ServerProfile,
  SetSyncStateRequest,
  SyncLoginRequest,
  SyncPullRequest,
  SyncPushRequest,
  SyncStateInfo,
  WorkspaceItem,
} from '../types/domain';

function invokeSafe<T>(command: string, payload?: Record<string, unknown>) {
  return invoke<T>(command, payload);
}

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
  listFormTypes: () => invokeSafe<string[]>('list_form_types'),
  getSyncState: () => invokeSafe<SyncStateInfo>('get_sync_state'),
  setSyncState: (req: SetSyncStateRequest) =>
    invokeSafe<void>('set_sync_state', { req }),
  archiveWorkspaceForRepositoryGeneration: () =>
    invokeSafe<string>('archive_workspace_for_repository_generation'),
  moveWorkspace: (destination: string) =>
    invokeSafe<string>('move_workspace', { destination }),
  backupWorkspace: (zipPath: string) =>
    invokeSafe<string>('backup_workspace', { zipPath }),
  writeWorkspaceAttachment: (attachmentId: string, data: Uint8Array) =>
    invokeSafe<void>('write_workspace_attachment', {
      attachmentId,
      data: Array.from(data),
    }),
  removeWorkspaceAttachment: (attachmentId: string) =>
    invokeSafe<void>('remove_workspace_attachment', { attachmentId }),
  getObservation: (id: string) =>
    invokeSafe<ObservationRecord>('get_observation', { id }),
  saveObservation: (req: SaveObservationRequest) =>
    invokeSafe<ObservationRecord>('save_observation', { req }),
  restoreLastBackup: (observationId: string) =>
    invokeSafe<ObservationRecord>('restore_last_backup', { observationId }),
  importObservations: (observations: ApiObservation[]) =>
    invokeSafe<ImportResult>('import_observations', { observations }),
  markObservationsPushed: (ids: string[]) =>
    invokeSafe<void>('mark_observations_pushed', { ids }),
  getAppHealth: () => invokeSafe<AppHealth>('get_app_health'),
  repairRepository: () => invokeSafe<AppHealth>('repair_repository'),
  synkLogin: (req: SyncLoginRequest) =>
    invokeSafe<AuthSession>('synk_login', { req }),
  synkPull: (req: SyncPullRequest) =>
    invokeSafe<ImportResult>('synk_pull', { req }),
  synkPush: (req: SyncPushRequest) => invokeSafe<number>('synk_push', { req }),
};
