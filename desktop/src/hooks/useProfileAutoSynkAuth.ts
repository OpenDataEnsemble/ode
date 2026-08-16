import { useCallback, useEffect, useState } from 'react';
import {
  selectAuthSessionForActiveProfile,
  useCustodianStore,
} from '../store/useCustodianStore';

/**
 * Silent sign-in on profile change (refresh token or keyring password), matching Sync page behavior.
 * Uses {@link recoverActiveProfileAuth} so expired stored tokens are renewed, not reused blindly.
 *
 * `authBlocked` is true when recovery failed — even if a stale session remains in localStorage —
 * so UI must not claim "Authenticated" from session presence alone.
 */
export function useProfileAutoSynkAuth(activeProfileId: string | undefined) {
  const authSession = useCustodianStore(selectAuthSessionForActiveProfile);
  const recoverActiveProfileAuth = useCustodianStore(
    s => s.recoverActiveProfileAuth,
  );
  const [authBlocked, setAuthBlocked] = useState(false);
  /** False until the first recover attempt for the current profile finishes. */
  const [authReady, setAuthReady] = useState(false);

  const refreshAuth = useCallback(async (): Promise<boolean> => {
    setAuthReady(false);
    const ok = await recoverActiveProfileAuth();
    setAuthBlocked(!ok);
    setAuthReady(true);
    return ok;
  }, [recoverActiveProfileAuth]);

  useEffect(() => {
    let cancelled = false;
    setAuthReady(false);
    setAuthBlocked(false);
    void (async () => {
      const ok = await recoverActiveProfileAuth();
      if (cancelled) {
        return;
      }
      setAuthBlocked(!ok);
      setAuthReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [activeProfileId, recoverActiveProfileAuth]);

  const ensureAuth = useCallback(async (): Promise<boolean> => {
    return refreshAuth();
  }, [refreshAuth]);

  return { authSession, authBlocked, authReady, ensureAuth, refreshAuth };
}
