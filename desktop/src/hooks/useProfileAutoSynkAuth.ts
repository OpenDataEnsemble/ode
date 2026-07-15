import { useCallback, useEffect, useState } from 'react';
import {
  selectAuthSessionForActiveProfile,
  useCustodianStore,
} from '../store/useCustodianStore';

/**
 * Silent sign-in on profile change (refresh token or keyring password), matching Sync page behavior.
 * Uses {@link recoverActiveProfileAuth} so expired stored tokens are renewed, not reused blindly.
 */
export function useProfileAutoSynkAuth(activeProfileId: string | undefined) {
  const authSession = useCustodianStore(selectAuthSessionForActiveProfile);
  const recoverActiveProfileAuth = useCustodianStore(
    s => s.recoverActiveProfileAuth,
  );
  const [authBlocked, setAuthBlocked] = useState(false);

  const refreshAuth = useCallback(async (): Promise<boolean> => {
    const ok = await recoverActiveProfileAuth();
    setAuthBlocked(
      !ok && !selectAuthSessionForActiveProfile(useCustodianStore.getState()),
    );
    return ok;
  }, [recoverActiveProfileAuth]);

  useEffect(() => {
    void refreshAuth();
  }, [activeProfileId, refreshAuth]);

  const ensureAuth = useCallback(async (): Promise<boolean> => {
    return refreshAuth();
  }, [refreshAuth]);

  return { authSession, authBlocked, ensureAuth, refreshAuth };
}
