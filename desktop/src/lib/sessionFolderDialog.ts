import { open, type OpenDialogOptions } from '@tauri-apps/plugin-dialog';
import { tauriClient } from './tauriClient';

/** Session-scoped keys for folder picker default paths (cleared on app restart). */
export const SESSION_FOLDER_DIALOG_KEYS = {
  importFolder: 'import.folder',
  developerLocalApp: 'developer-mode.local-app',
  profileWorkspace: 'profile.workspace',
} as const;

export type SessionFolderDialogKey =
  (typeof SESSION_FOLDER_DIALOG_KEYS)[keyof typeof SESSION_FOLDER_DIALOG_KEYS];

const lastFolderByKey = new Map<SessionFolderDialogKey, string>();

export function rememberSessionFolderDialogPath(
  key: SessionFolderDialogKey,
  path: string,
): void {
  const trimmed = path.trim();
  if (trimmed) {
    lastFolderByKey.set(key, trimmed);
  }
}

export function clearSessionFolderDialogMemory(
  key?: SessionFolderDialogKey,
): void {
  if (key) {
    lastFolderByKey.delete(key);
  } else {
    lastFolderByKey.clear();
  }
}

export async function sessionFolderDialogDefaultPath(
  key: SessionFolderDialogKey,
): Promise<string | undefined> {
  const remembered = lastFolderByKey.get(key);
  if (!remembered?.trim()) {
    return undefined;
  }
  try {
    const ok = await tauriClient.hostPathIsDirectory(remembered);
    if (ok) {
      return remembered;
    }
    lastFolderByKey.delete(key);
  } catch {
    lastFolderByKey.delete(key);
  }
  return undefined;
}

export type OpenSessionFolderDialogOptions = Omit<
  OpenDialogOptions,
  'directory' | 'multiple' | 'defaultPath' | 'recursive'
> & {
  key: SessionFolderDialogKey;
  multiple?: boolean;
};

function parentDirPath(path: string): string {
  const normalized = path.trim().replace(/\\/g, '/').replace(/\/+$/, '');
  const idx = normalized.lastIndexOf('/');
  return idx > 0 ? normalized.slice(0, idx) : normalized;
}

/** Parent shared by all selections, or parent of the first when paths differ. */
export function browsePathAfterFolderSelection(paths: readonly string[]): string {
  const trimmed = paths.map(p => p.trim()).filter(Boolean);
  if (trimmed.length === 0) {
    return '';
  }
  const parents = [...new Set(trimmed.map(parentDirPath))];
  return parents.length === 1 ? parents[0]! : parentDirPath(trimmed[0]!);
}

/** Tauri dialog may return a string even when `multiple: true` (single folder picked). */
export function normalizeFolderDialogSelection(
  selected: string | string[] | null | undefined,
): string[] | null {
  if (selected == null) {
    return null;
  }
  if (Array.isArray(selected)) {
    const paths = selected.map(p => p.trim()).filter(Boolean);
    return paths.length > 0 ? paths : null;
  }
  const one = selected.trim();
  return one ? [one] : null;
}

function rememberSessionFolderBrowsePath(
  key: SessionFolderDialogKey,
  paths: readonly string[],
): void {
  const browse = browsePathAfterFolderSelection(paths);
  if (browse) {
    lastFolderByKey.set(key, browse);
  }
}

/**
 * Folder picker with session memory: re-opens in the last chosen directory for `key`
 * when that path still exists on disk.
 *
 * Import multi-select uses the plugin dialog (`multiple: true`) without `recursive`
 * — import reads host paths via Rust, and `recursive: true` only affects WebView FS
 * scope (and has caused flaky re-open behaviour on Linux).
 */
export async function openSessionFolderDialog(
  options: OpenSessionFolderDialogOptions & { multiple?: false | undefined },
): Promise<string | null>;
export async function openSessionFolderDialog(
  options: OpenSessionFolderDialogOptions & { multiple: true },
): Promise<string[] | null>;
export async function openSessionFolderDialog(
  options: OpenSessionFolderDialogOptions,
): Promise<string | string[] | null> {
  const { key, multiple = false, ...openOptions } = options;
  const defaultPath = await sessionFolderDialogDefaultPath(key);
  const selected = await open({
    ...openOptions,
    directory: true,
    multiple,
    ...(defaultPath ? { defaultPath } : {}),
  });
  const paths = normalizeFolderDialogSelection(selected);
  if (!paths) {
    return null;
  }
  if (multiple) {
    rememberSessionFolderBrowsePath(key, paths);
    return paths;
  }
  rememberSessionFolderDialogPath(key, paths[0]!);
  return paths[0]!;
}
