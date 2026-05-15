/** App bundle layout under a profile workspace (matches Rust `apply_app_bundle_download`). */
export const WORKSPACE_BUNDLES_DIR = 'bundles';
export const WORKSPACE_BUNDLE_ARCHIVES_DIR = 'bundles/archives';
export const WORKSPACE_BUNDLE_ACTIVE_DIR = 'bundles/active';
export const WORKSPACE_BUNDLE_STATE_FILE = 'bundles/state.json';
/** Developer-mode mirror of a local custom app (see `refresh_custom_app_dev_mirror`). */
export const WORKSPACE_BUNDLE_DEV_LOCAL_DIR = 'bundles/dev-local';
export const WORKSPACE_BUNDLE_DEV_APP_INDEX = 'bundles/dev-local/app/index.html';

/** Deterministic layout under a profile workspace root (matches Rust). */
export function workspaceSqlitePath(workspaceRoot: string): string {
  const sep = workspaceRoot.includes('\\') ? '\\' : '/';
  const base = workspaceRoot.replace(/[/\\]+$/, '');
  return `${base}${sep}sqlite${sep}custodian.sqlite3`;
}

export function workspaceAttachmentsDir(workspaceRoot: string): string {
  const sep = workspaceRoot.includes('\\') ? '\\' : '/';
  const base = workspaceRoot.replace(/[/\\]+$/, '');
  return `${base}${sep}attachments`;
}

/** Canonical committed/downloaded copies (Formulus `synced/`). */
export function workspaceAttachmentsSyncedDir(workspaceRoot: string): string {
  const sep = workspaceRoot.includes('\\') ? '\\' : '/';
  const base = workspaceRoot.replace(/[/\\]+$/, '');
  return `${base}${sep}attachments${sep}synced`;
}
