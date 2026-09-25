import { profileActivity } from './ProfileActivity';
import { profileRegistry } from './ProfileRegistry';
import { getActiveProfile, selectProfileRuntime } from './ProfileRuntime';
import { markProfilesNavigationRemount } from '../navigation/ProfileNavigationIntent';
import { initializeProfileDatabase } from '../database/database';
import { invalidateProfileServiceCaches } from '../services/invalidateProfileServiceCaches';

export type ProfileTransitionState = 'idle' | 'quiescing' | 'commit-failed';
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
  profileActivity.beginTransition();
  let commitAttempted = false;
  try {
    publish('quiescing');
    // UI acknowledges its commit after the whole profile subtree (both WebViews)
    // has unmounted. Open forms/native pickers are blockers, never forcibly lost.
    await host.unmount();
    commitAttempted = true;
    await profileRegistry.commitSelection(targetId, deleteId);
    // All previous adapters stay alive. Select the destination's retained
    // instance (or construct it once), never close/reopen an SQLite name.
    selectProfileRuntime(
      profileRegistry.list().find(profile => profile.id === targetId)!,
    );
    invalidateProfileServiceCaches();
    await initializeProfileDatabase(true);

    markProfilesNavigationRemount();
    profileActivity.cancelTransition();
    host.restore();
    publish('idle');
  } catch (error) {
    if (commitAttempted) {
      // A failed storage write or destination DB initialization can be
      // ambiguous. Keep writers stopped rather than remount mixed state.
      publish('commit-failed');
    } else {
      profileActivity.cancelTransition();
      publish('idle');
      host.restore();
    }
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
