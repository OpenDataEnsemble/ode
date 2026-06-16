import {
  selectActiveProfileState,
  selectAuthSessionForActiveProfile,
  useCustodianStore,
} from '../store/useCustodianStore';
import { tauriClient } from './tauriClient';

/** Silent sign-in using profile username + keyring password. Returns true if authenticated. */
export async function tryAutoSynkAuth(): Promise<boolean> {
  const state = useCustodianStore.getState();
  const profile = selectActiveProfileState(state);
  if (!profile) {
    return false;
  }
  const existing = selectAuthSessionForActiveProfile(state);
  if (existing?.token) {
    return true;
  }
  const baseUrl = (profile.serverUrl ?? '').trim();
  const username = (profile.username ?? '').trim();
  if (!baseUrl || !username) {
    return false;
  }
  let password = '';
  try {
    const cred = await tauriClient.credentialGet(profile.id);
    password = cred.password ?? '';
  } catch {
    return false;
  }
  if (!password.trim()) {
    return false;
  }
  try {
    await state.synkLogin({ baseUrl, username, password });
    return true;
  } catch {
    return false;
  }
}
