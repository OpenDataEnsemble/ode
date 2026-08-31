import { useCallback, useEffect, useRef, useState } from 'react';
import {
  selectActiveProfileState,
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
  const activeProfile = useCustodianStore(selectActiveProfileState);
  const authSession = useCustodianStore(selectAuthSessionForActiveProfile);
  const recoverActiveProfileAuth = useCustodianStore(
    s => s.recoverActiveProfileAuth,
  );
  const [authBlocked, setAuthBlocked] = useState(false);
  /** False until the first recover attempt for the current profile finishes. */
  const [authReady, setAuthReady] = useState(false);
  const [authChecking, setAuthChecking] = useState(false);
  const requestSeqRef = useRef(0);
  const serverUrl = (activeProfile?.serverUrl ?? '').trim();
  const username = (activeProfile?.username ?? '').trim();
  const canAttemptAutoAuth =
    Boolean(activeProfileId) && serverUrl.length > 0 && username.length > 0;

  const runAuthCheck = useCallback(async (): Promise<boolean> => {
    const requestId = ++requestSeqRef.current;
    if (!canAttemptAutoAuth) {
      setAuthChecking(false);
      setAuthBlocked(false);
      setAuthReady(true);
      return false;
    }
    setAuthReady(false);
    setAuthChecking(true);
    setAuthBlocked(false);
    try {
      const ok = await recoverActiveProfileAuth();
      if (requestId !== requestSeqRef.current) {
        return ok;
      }
      setAuthBlocked(!ok);
      setAuthReady(true);
      setAuthChecking(false);
      return ok;
    } catch (error) {
      if (requestId === requestSeqRef.current) {
        setAuthBlocked(true);
        setAuthReady(true);
        setAuthChecking(false);
      }
      throw error;
    }
  }, [canAttemptAutoAuth, recoverActiveProfileAuth]);

  const refreshAuth = useCallback(async (): Promise<boolean> => {
    return runAuthCheck();
  }, [runAuthCheck]);

  useEffect(() => {
    void runAuthCheck();
  }, [activeProfileId, runAuthCheck]);

  const ensureAuth = useCallback(async (): Promise<boolean> => {
    return refreshAuth();
  }, [refreshAuth]);

  return {
    authSession,
    authBlocked,
    authReady,
    authChecking,
    ensureAuth,
    refreshAuth,
  };
}
