import { profileActivity } from './ProfileActivity';
import { profileRegistry } from './ProfileRegistry';
import { getActiveProfile } from './ProfileRuntime';

export type ProfileTransitionState = 'idle' | 'quiescing' | 'close-required' | 'commit-failed';
let state: ProfileTransitionState = 'idle';
const listeners = new Set<() => void>();
let host: { unmount: () => Promise<void>; restore: () => void } | null = null;

function publish(next: ProfileTransitionState): void {
  state = next;
  for (const listener of listeners) listener();
}

export function getProfileTransitionState(): ProfileTransitionState { return state; }
export function subscribeProfileTransition(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function registerProfileTransitionHost(value: NonNullable<typeof host>): () => void {
  host = value;
  return () => { if (host === value) host = null; };
}

async function transition(targetId: string, deleteId?: string): Promise<void> {
  const profiles = profileRegistry.list();
  if (!profiles.some(profile => profile.id === targetId) || targetId === deleteId) throw new Error('Invalid selected profile');
  if (deleteId && (profiles.length < 2 || !profiles.some(profile => profile.id === deleteId))) throw new Error('Cannot delete the last profile');
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
    // Watermelon 0.28 has no acknowledged cross-adapter close API and a global
    // reload destruction hook. Do not open another DB in this native process.
    publish('close-required');
  } catch (error) {
    if (commitAttempted) {
      // A failed storage write can be ambiguous. Keep all old writers stopped
      // and let cold bootstrap read the authoritative on-disk registry.
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
  const fallback = id === activeId ? profileRegistry.list().find(profile => profile.id !== id)?.id : activeId;
  if (!fallback) throw new Error('Cannot delete the last profile');
  // All deletions are committed with a cold-launch boundary, including inactive
  // profiles, so mounted browser contexts cannot retain deleted-profile keys.
  await transition(fallback, id);
}
