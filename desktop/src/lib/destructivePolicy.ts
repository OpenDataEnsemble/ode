import { isTauri } from '@tauri-apps/api/core';
import { confirm as tauriConfirm } from '@tauri-apps/plugin-dialog';
import type { ProfileEnvironment } from '../types/domain';

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
  environment: ProfileEnvironment | null | undefined,
  kind: DestructiveActionKind,
  detail: string,
): Promise<boolean> {
  const tier = environment ?? 'production';
  const title = describeAction(kind);
  const dialogTitle =
    tier === 'production'
      ? `${title} — PRODUCTION`
      : tier === 'staging'
        ? `${title} (staging)`
        : title;
  const messageBody =
    tier === 'production'
      ? `${detail}\n\nType OK only if this is intentional.`
      : tier === 'staging'
        ? `${detail}\n\nProceed?`
        : detail;

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
