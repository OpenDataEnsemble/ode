import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  guardedProfileNavigation,
  useProfileDraftGuardStore,
} from './useProfileDraftGuardStore';

describe('guardedProfileNavigation', () => {
  beforeEach(() => {
    useProfileDraftGuardStore.setState({
      isDirty: false,
      attemptLeave: null,
    });
  });

  it('navigates immediately when not leaving profiles', async () => {
    const navigate = vi.fn();
    await guardedProfileNavigation(navigate, '/data/sync', '/data/sync');
    expect(navigate).toHaveBeenCalledWith('/data/sync');
  });

  it('navigates immediately when profile draft is clean', async () => {
    const navigate = vi.fn();
    await guardedProfileNavigation(navigate, '/data/sync', '/data/profiles');
    expect(navigate).toHaveBeenCalledWith('/data/sync');
  });

  it('prompts before navigating away from dirty profiles', async () => {
    const navigate = vi.fn();
    const attemptLeave = vi.fn().mockResolvedValue(true);
    useProfileDraftGuardStore.setState({ isDirty: true, attemptLeave });

    await guardedProfileNavigation(navigate, '/data/sync', '/data/profiles');

    expect(attemptLeave).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith('/data/sync');
  });

  it('stays on profiles when leave handler returns false', async () => {
    const navigate = vi.fn();
    useProfileDraftGuardStore.setState({
      isDirty: true,
      attemptLeave: vi.fn().mockResolvedValue(false),
    });

    await guardedProfileNavigation(navigate, '/data/sync', '/data/profiles');

    expect(navigate).not.toHaveBeenCalled();
  });
});
