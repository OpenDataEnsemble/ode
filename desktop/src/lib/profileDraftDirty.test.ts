import { describe, expect, it } from 'vitest';
import {
  baselineFromProfile,
  isProfileDraftDirty,
  type ProfileDraftBaseline,
} from './profileDraftDirty';

const base: ProfileDraftBaseline = {
  profileId: 'p1',
  label: 'Field site',
  serverUrl: 'https://synk.example',
  username: 'alice',
  password: 'secret',
};

describe('isProfileDraftDirty', () => {
  it('is false when draft matches baseline', () => {
    expect(
      isProfileDraftDirty(base, 'p1', {
        label: 'Field site',
        serverUrl: 'https://synk.example',
        username: 'alice',
        password: 'secret',
      }),
    ).toBe(false);
  });

  it('detects label, server, username, and password changes', () => {
    expect(isProfileDraftDirty(base, 'p1', { ...base, label: 'Other' })).toBe(
      true,
    );
    expect(
      isProfileDraftDirty(base, 'p1', {
        ...base,
        serverUrl: 'https://other.example',
      }),
    ).toBe(true);
    expect(isProfileDraftDirty(base, 'p1', { ...base, username: 'bob' })).toBe(
      true,
    );
    expect(isProfileDraftDirty(base, 'p1', { ...base, password: 'new' })).toBe(
      true,
    );
  });

  it('is false when profile id mismatches', () => {
    expect(isProfileDraftDirty(base, 'p2', base)).toBe(false);
  });
});

describe('baselineFromProfile', () => {
  it('trims profile fields', () => {
    expect(
      baselineFromProfile(
        {
          id: 'x',
          label: '  Name  ',
          serverUrl: ' https://a ',
          username: ' u ',
        },
        'pw',
      ),
    ).toEqual({
      profileId: 'x',
      label: 'Name',
      serverUrl: 'https://a',
      username: 'u',
      password: 'pw',
    });
  });
});
