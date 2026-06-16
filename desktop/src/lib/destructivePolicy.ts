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
  const dialogTitle = `${title} — PRODUCTION`;
  const messageBody = `${detail}\n\nType OK only if this is intentional.`;

  if (isTauri()) {
    return await tauriConfirm(messageBody, {
      title: dialogTitle,
      kind: 'warning',
    });
  }

  return window.confirm(`${dialogTitle}\n\n${messageBody}`);
}

function describeAction(kind: DestructiveActionKind): string {
  switch (kind) {
    case 'push':
      return 'Push local changes to Synkronus';
    case 'bundle_push':
      return 'Upload / replace app bundle on server';
    case 'bulk_delete':
      return 'Delete multiple items';
    case 'profile_delete':
      return 'Delete profile';
    case 'server_reset':
      return 'Reset server repository';
    case 'local_reset':
      return 'Reset local data';
    default:
      return 'Destructive action';
  }
}
