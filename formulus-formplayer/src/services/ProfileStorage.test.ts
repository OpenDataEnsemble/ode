// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FormplayerProfileStorage,
  initializeFormplayerStorage,
} from './ProfileStorage';

const owner = 'default-uuid';
const other = 'other-uuid';
const drafts = 'formulus_drafts';
const sticky = 'formulus_sticky_fields';
const scoped = (id: string, key: string) => `ode:${id}:formplayer:${key}`;

function initialize(
  id: string,
  legacyOwner: string | null = owner,
  deleted: string[] = [],
) {
  const store = new FormplayerProfileStorage();
  store.initialize(
    {
      __odeProfileId: id,
      __odeLegacyWebStorageProfileId: legacyOwner,
      __odeDeletedProfileIds: deleted,
    },
    localStorage,
  );
  return store;
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('Formplayer profile storage', () => {
  it('does not read storage eagerly and fails closed before explicit initialization', () => {
    const get = vi.spyOn(Storage.prototype, 'getItem');
    const store = new FormplayerProfileStorage();
    expect(get).not.toHaveBeenCalled();
    expect(() => store.getItem(drafts)).toThrow('not initialized');
    expect(() => store.initialize({}, localStorage)).toThrow('host profile ID');
  });

  it('copies drafts and sticky values only into the designated legacy owner', () => {
    localStorage.setItem(drafts, '["legacy draft"]');
    localStorage.setItem(sticky, '{"legacy":"sticky"}');
    const b = initialize(other);
    expect(b.getItem(drafts)).toBeNull();
    expect(b.getItem(sticky)).toBeNull();
    const a = initialize(owner);
    expect(a.getItem(drafts)).toBe('["legacy draft"]');
    expect(a.getItem(sticky)).toBe('{"legacy":"sticky"}');
    expect(a.getItem('legacy-migration-v1')).toBe('1');
    a.removeItem(drafts);
    expect(initialize(owner).getItem(drafts)).toBeNull();
  });

  it('never assumes Desktop Default owns old storage', () => {
    localStorage.setItem(drafts, 'unknown desktop owner');
    expect(initialize(owner, null).getItem(drafts)).toBeNull();
    expect(localStorage.getItem(drafts)).toBe('unknown desktop owner');
  });

  it('keeps writes and clears isolated from app, other profiles and raw storage', () => {
    const a = initialize(owner, null);
    const b = initialize(other, null);
    a.setItem(drafts, 'a');
    b.setItem(drafts, 'b');
    localStorage.setItem(`ode:${owner}:app:session`, 'app');
    localStorage.setItem('third-party', 'raw');
    a.clear();
    expect(a.getItem(drafts)).toBeNull();
    expect(b.getItem(drafts)).toBe('b');
    expect(localStorage.getItem(`ode:${owner}:app:session`)).toBe('app');
    expect(localStorage.getItem('third-party')).toBe('raw');
  });

  it('purges tombstones and their legacy keys before any migration on a cold origin', () => {
    localStorage.setItem(drafts, 'deleted legacy');
    localStorage.setItem(sticky, 'deleted sticky');
    localStorage.setItem(`ode:${owner}:app:x`, 'deleted app');
    localStorage.setItem(scoped(owner, drafts), 'deleted draft');
    localStorage.setItem(`ode:${other}:app:x`, 'retained');
    const b = initialize(other, owner, [owner]);
    expect(b.getItem(drafts)).toBeNull();
    expect(localStorage.getItem(drafts)).toBeNull();
    expect(localStorage.getItem(sticky)).toBeNull();
    expect(localStorage.getItem(scoped(owner, drafts))).toBeNull();
    expect(localStorage.getItem(`ode:${owner}:app:x`)).toBeNull();
    expect(localStorage.getItem(`ode:${other}:app:x`)).toBe('retained');
    expect(() => initialize(owner, owner, [owner])).toThrow('deleted');
  });

  it('does not mark a failed migration complete and retries without overwriting scoped drafts', () => {
    localStorage.setItem(drafts, 'legacy');
    localStorage.setItem(sticky, 'sticky');
    const setItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      key,
      value,
    ) {
      if (key === scoped(owner, sticky)) throw new Error('quota');
      setItem.call(this, key, value);
    });
    expect(() => initialize(owner)).toThrow('quota');
    expect(
      localStorage.getItem(scoped(owner, 'legacy-migration-v1')),
    ).toBeNull();
    expect(localStorage.getItem(drafts)).toBe('legacy');
    vi.restoreAllMocks();
    localStorage.setItem(scoped(owner, drafts), 'newer scoped draft');
    const a = initialize(owner);
    expect(a.getItem(drafts)).toBe('newer scoped draft');
    expect(a.getItem(sticky)).toBe('sticky');
    expect(a.getItem('legacy-migration-v1')).toBe('1');
  });

  it('propagates blocked storage/deletion errors instead of copying legacy data', () => {
    localStorage.setItem(scoped(owner, drafts), 'deleted');
    const remove = vi
      .spyOn(Storage.prototype, 'removeItem')
      .mockImplementation(() => {
        throw new Error('blocked');
      });
    expect(() => initialize(other, owner, [owner])).toThrow('blocked');
    expect(localStorage.getItem(scoped(other, drafts))).toBeNull();
    remove.mockRestore();
  });

  it('does not permit retargeting a live document, including nested sessions', () => {
    const a = initialize(owner);
    a.initialize({ __odeProfileId: owner }, localStorage);
    expect(() => a.initialize({ __odeProfileId: other }, localStorage)).toThrow(
      'remount',
    );
    vi.stubGlobal('__odeProfileId', owner);
    expect(() => initializeFormplayerStorage(other)).toThrow('does not match');
    vi.unstubAllGlobals();
  });
});
