import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useProfileAutoSynkAuth } from './useProfileAutoSynkAuth';

const mockRecoverActiveProfileAuth = vi.fn<() => Promise<boolean>>();
const mockSelectAuthSessionForActiveProfile = vi.fn(() => null);

vi.mock('../store/useCustodianStore', () => ({
  useCustodianStore: (selector: (state: unknown) => unknown) =>
    selector({
      activeProfileId: 'p1',
      profiles: [
        {
          id: 'p1',
          serverUrl: 'https://example.test',
          username: 'alice',
        },
      ],
      recoverActiveProfileAuth: mockRecoverActiveProfileAuth,
      authSessionsByProfileId: {},
    }),
  selectActiveProfileState: (state: {
    activeProfileId: string;
    profiles: Array<{ id: string; serverUrl?: string | null; username?: string | null }>;
  }) => state.profiles.find(profile => profile.id === state.activeProfileId) ?? null,
  selectAuthSessionForActiveProfile: () =>
    mockSelectAuthSessionForActiveProfile(),
}));

describe('useProfileAutoSynkAuth', () => {
  beforeEach(() => {
    mockRecoverActiveProfileAuth.mockReset();
    mockSelectAuthSessionForActiveProfile.mockReset();
    mockSelectAuthSessionForActiveProfile.mockReturnValue(null);
  });

  it('ignores stale auth checks after switching profiles', async () => {
    let resolveFirst: ((value: boolean) => void) | undefined;
    let resolveSecond: ((value: boolean) => void) | undefined;

    mockRecoverActiveProfileAuth
      .mockImplementationOnce(
        () =>
          new Promise<boolean>(resolve => {
            resolveFirst = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise<boolean>(resolve => {
            resolveSecond = resolve;
          }),
      );

    const { result, rerender } = renderHook(
      ({ profileId }) => useProfileAutoSynkAuth(profileId),
      {
        initialProps: { profileId: 'p1' as string | undefined },
      },
    );

    expect(result.current.authReady).toBe(false);
    expect(result.current.authBlocked).toBe(false);
    expect(result.current.authChecking).toBe(true);

    rerender({ profileId: 'p2' });

    resolveSecond?.(false);
    await waitFor(() => {
      expect(result.current.authReady).toBe(true);
      expect(result.current.authBlocked).toBe(true);
      expect(result.current.authChecking).toBe(false);
    });

    resolveFirst?.(true);
    await waitFor(() => {
      expect(result.current.authReady).toBe(true);
      expect(result.current.authBlocked).toBe(true);
      expect(result.current.authChecking).toBe(false);
    });
  });
});
