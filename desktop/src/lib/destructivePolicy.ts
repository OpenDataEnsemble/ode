import type { ProfileEnvironment } from '../types/domain';

export type DestructiveActionKind =
  | 'push'
  | 'bundle_push'
  | 'bulk_delete'
  | 'profile_delete'
  | 'server_reset'
  | 'local_reset';

/**
 * Returns true if the user confirmed (via browser confirm). Stricter copy on production.
 */
export function confirmDestructiveAction(
  environment: ProfileEnvironment | null | undefined,
  kind: DestructiveActionKind,
  detail: string,
): boolean {
  const tier = environment ?? 'production';
  const title = describeAction(kind);
  if (tier === 'development') {
    return window.confirm(`${title}\n\n${detail}`);
  }
  if (tier === 'staging') {
    return window.confirm(`${title} (staging)\n\n${detail}\n\nProceed?`);
  }
  return window.confirm(
    `${title} — PRODUCTION\n\n${detail}\n\nType OK only if this is intentional.`,
  );
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
