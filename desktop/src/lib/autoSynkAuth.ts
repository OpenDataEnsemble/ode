import { useCustodianStore } from '../store/useCustodianStore';

/** Silent sign-in using saved refresh token or keyring password. Returns true if authenticated. */
export async function tryAutoSynkAuth(): Promise<boolean> {
  return useCustodianStore.getState().ensureActiveProfileAuth();
}
