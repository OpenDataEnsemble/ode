import { profileActivity } from './ProfileActivity';
import { profileRegistry } from './ProfileRegistry';
import { getActiveProfile, selectProfileRuntime } from './ProfileRuntime';
import { ensureProfileDirectories } from './ProfilePaths';
import { markProfilesNavigationRemount } from '../navigation/ProfileNavigationIntent';
import {
  hasHealthyProfileDatabase,
  initializeProfileDatabase,
  wasProfileDatabaseAttempted,
} from '../database/database';
import { invalidateProfileServiceCaches } from '../services/invalidateProfileServiceCaches';

export type ProfileTransitionState =
  | 'idle'
  | 'quiescing'
  | 'recovering'
  | 'commit-failed';
let state: ProfileTransitionState = 'idle';
const listeners = new Set<() => void>();
let host: { unmount: () => Promise<void>; restore: () => void } | null = null;

function publish(next: ProfileTransitionState): void {
  state = next;
  for (const listener of listeners) listener();
}

export function getProfileTransitionState(): ProfileTransitionState {
  return state;
}
export function subscribeProfileTransition(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function registerProfileTransitionHost(
  value: NonNullable<typeof host>,
): () => void {
  host = value;
  return () => {
    if (host === value) host = null;
  };
}

/** Bind the runtime to `id`, open or reuse its database, and remount the UI. */
async function activate(id: string): Promise<void> {
  selectProfileRuntime(
    profileRegistry.list().find(profile => profile.id === id)!,
  );
  invalidateProfileServiceCaches();
  await initializeProfileDatabase(true);
  markProfilesNavigationRemount();
  profileActivity.cancelTransition();
  host!.restore();
  publish('idle');
}

/**
 * After a post-commit failure, resume only against a profile whose selection
 * is durable and whose database is known-good in this runtime (or was never
 * attempted). A database whose open failed is never retried here.
 */
async function recover(previousId: string): Promise<string> {
  publish('recovering');
  const persisted = await profileRegistry.rereadPersisted();
  const authoritative = persisted.activeProfileId;
  const canResume = (id: string) =>
    persisted.profiles.some(profile => profile.id === id) &&
    (hasHealthyProfileDatabase(id) || !wasProfileDatabaseAttempted(id));
  if (canResume(authoritative)) {
    await activate(authoritative);
    return authoritative;
  }
  // The durable selection cannot be opened. Fall back to the previous profile
  // only if it is still registered and reselecting it is a plain registry write.
  if (
    authoritative !== previousId &&
    canResume(previousId) &&
    hasHealthyProfileDatabase(previousId)
  ) {
    await profileRegistry.commitSelection(previousId);
    await activate(previousId);
    return previousId;
  }
  throw new Error('No profile can be safely resumed in this runtime');
}

async function transition(targetId: string, deleteId?: string): Promise<void> {
  const profiles = profileRegistry.list();
  if (
    !profiles.some(profile => profile.id === targetId) ||
    targetId === deleteId
  )
    throw new Error('Invalid selected profile');
  if (
    deleteId &&
    (profiles.length < 2 || !profiles.some(profile => profile.id === deleteId))
  )
    throw new Error('Cannot delete the last profile');
  if (!host) throw new Error('Profile switch host is unavailable');
  const previousId = getActiveProfile().id;
  profileActivity.beginTransition();
  let commitAttempted = false;
  try {
    publish('quiescing');
    // UI acknowledges its commit after the whole profile subtree (both WebViews)
    // has unmounted. Open forms/native pickers are blockers, never forcibly lost.
    await host.unmount();
    // A freshly added profile has no directories yet; create them before the
    // selection becomes durable so a remount never sees a missing root.
    await ensureProfileDirectories(targetId);
    commitAttempted = true;
    await profileRegistry.commitSelection(targetId, deleteId);
    // All previous adapters stay alive. Select the destination's retained
    // instance (or construct it once), never close/reopen an SQLite name.
    await activate(targetId);
  } catch (error) {
    if (!commitAttempted) {
      profileActivity.cancelTransition();
      publish('idle');
      host.restore();
      throw error;
    }
    // The registry write or the destination open failed. Reread the durable
    // registry and resume only against a provably safe profile; otherwise stay
    // fail-closed until a real cold launch.
    let resumed: string | null = null;
    try {
      resumed = await recover(previousId);
    } catch {
      publish('commit-failed');
    }
    // A write that was durable despite reporting an error has completed the
    // switch; do not report it as a failure the user should retry.
    if (resumed === targetId) return;
    throw error;
  }
}

export async function switchProfile(id: string): Promise<void> {
  if (id === getActiveProfile().id) return;
  await transition(id);
}

export async function deleteProfile(id: string): Promise<void> {
  const activeId = getActiveProfile().id;
  const fallback =
    id === activeId
      ? profileRegistry.list().find(profile => profile.id !== id)?.id
      : activeId;
  if (!fallback) throw new Error('Cannot delete the last profile');
  // Tombstone data on commit; cleanup cannot unlink prepared SQLite files and
  // retries at a later safe cold start.
  await transition(fallback, id);
}
