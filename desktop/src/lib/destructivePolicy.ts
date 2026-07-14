import { isTauri } from '@tauri-apps/api/core';
import { confirm as tauriConfirm } from '@tauri-apps/plugin-dialog';

export type DestructiveActionKind =
  | 'push'
  | 'bundle_push'
  | 'bulk_delete'
  | 'profile_delete'
  | 'server_reset'
  | 'local_reset';

/**
 * Returns true if the user confirmed. In Tauri, uses the native dialog so the choice is
 * awaited correctly (WebView `window.confirm` can resolve before the prompt is dismissed).
 */
export async function confirmDestructiveAction(
  kind: DestructiveActionKind,
  detail: string,
): Promise<boolean> {
  const title = describeAction(kind);

  if (isTauri()) {
    return await tauriConfirm(detail, {
      title,
      kind: 'warning',
    });
  }

  return window.confirm(`${title}\n\n${detail}`);
}

function describeAction(kind: DestructiveActionKind): string {
  switch (kind) {
    case 'push':
      return 'Push observations';
    case 'bundle_push':
      return 'Upload app bundle';
    case 'bulk_delete':
      return 'Delete observations';
    case 'profile_delete':
      return 'Delete profile';
    case 'server_reset':
      return 'Reset server repository';
    case 'local_reset':
      return 'Reset local data';
    default:
      return 'Confirm action';
  }
}
