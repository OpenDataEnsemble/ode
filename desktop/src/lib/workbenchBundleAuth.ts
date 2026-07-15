import { isTauri } from '@tauri-apps/api/core';
import { message } from '@tauri-apps/plugin-dialog';
import {
  selectAuthSessionForActiveProfile,
  useCustodianStore,
} from '../store/useCustodianStore';
import type { ServerProfile } from '../types/domain';

async function alertAuthRequired(body: string): Promise<void> {
  if (isTauri()) {
    await message(body, {
      title: 'Authentication required',
      kind: 'warning',
    });
  } else {
    window.alert(body);
  }
}

export type EnsureWorkbenchBundleAuthOptions = {
  active: ServerProfile | null | undefined;
  baseUrl: string;
  onAuthRequired: (body: string) => void | Promise<void>;
  messages?: {
    noProfile?: string;
    noServerUrl?: string;
    authFailed?: string;
  };
};

/**
 * Ensures the active profile has a server URL and bearer token for Synkronus bundle ops.
 * Returns the token when ready, or null after prompting the user.
 */
export async function ensureWorkbenchBundleAuth(
  options: EnsureWorkbenchBundleAuthOptions,
): Promise<string | null> {
  const { active, baseUrl, onAuthRequired, messages = {} } = options;

  if (!active) {
    await onAuthRequired(
      messages.noProfile ??
        'Select a profile in Profiles before app bundle operations.',
    );
    return null;
  }
  if (!baseUrl) {
    await onAuthRequired(
      messages.noServerUrl ??
        'Set a server URL for this profile in Profiles before app bundle operations.',
    );
    return null;
  }
  const ok = await useCustodianStore.getState().recoverActiveProfileAuth();
  const token = selectAuthSessionForActiveProfile(
    useCustodianStore.getState(),
  )?.token;
  if (!ok || !token) {
    await onAuthRequired(
      messages.authFailed ??
        'Could not sign in automatically. Open Profiles to authenticate (save a password or sign in manually).',
    );
    return null;
  }
  return token;
}

export async function promptNavigateToProfilesForBundleAuth(
  body: string,
  navigate: (path: string) => void,
): Promise<void> {
  await alertAuthRequired(body);
  navigate('/data/profiles');
}
