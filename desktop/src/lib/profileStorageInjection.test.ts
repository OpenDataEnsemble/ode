// @vitest-environment node
import { describe, expect, it } from 'vitest';
import vm from 'node:vm';
import fs from 'node:fs';
import { buildProfileStorageInjection } from './profileStorageInjection';
import type { AppSettings, ServerProfile } from '../types/domain';

const profile = 'desktop-profile-uuid';
const settings: AppSettings = {
  activeProfileId: profile,
  profiles: [{ id: profile, label: 'Default' } as ServerProfile],
  dataDirectory: '/desktop',
  deletedProfileIds: ['deleted-desktop-uuid'],
};
const injection = fs.readFileSync(
  new URL('../../public/formulus-injection.js', import.meta.url),
  'utf8',
);

function createBrowser() {
  const values = new Map<string, string>();
  const storage = {
    get length() {
      return values.size;
    },
    key: (i: number) => Array.from(values.keys())[i] ?? null,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
  const messages: string[] = [];
  const context = vm.createContext({
    localStorage: storage,
    console,
    document: { addEventListener() {} },
    addEventListener() {},
    removeEventListener() {},
    ReactNativeWebView: {
      postMessage: (message: string) => messages.push(message),
    },
  });
  context.window = context;
  return { context, storage, messages };
}

function injectHost(context: vm.Context, value = settings) {
  vm.runInContext(
    buildProfileStorageInjection(value).replace(/^<script>|<\/script>$/g, ''),
    context,
  );
}

describe('generated profile browser bridge (Desktop and mobile)', () => {
  it('ships the same generated bridge on Desktop and mobile', () => {
    const mobile = fs.readFileSync(
      new URL(
        '../../../formulus/assets/webview/FormulusInjectionScript.js',
        import.meta.url,
      ),
      'utf8',
    );
    expect(injection).toBe(mobile);
  });
  it('injects actual Desktop identity before ready, including nested Formplayer documents', () => {
    for (let session = 0; session < 2; session++) {
      const { context, messages } = createBrowser();
      injectHost(context);
      vm.runInContext(injection, context);
      expect(context.formulus.getProfileId()).toBe(profile);
      expect(context.__odeLegacyWebStorageProfileId).toBeNull();
      expect(JSON.parse(messages[0]).type).toBe('onFormulusReady');
    }
  });

  it('uses synchronous captured helpers without RPCs or changing raw localStorage', () => {
    const { context, storage, messages } = createBrowser();
    injectHost(context);
    vm.runInContext(injection, context);
    messages.length = 0;
    const api = context.formulus;
    const local = api.getLocalStorageRef();
    context.__odeProfileId = 'changed-after-injection';
    expect(api.getProfileId()).toBe(profile);
    expect(local).toBe(api.getLocalStorageRef());
    expect(local.setItem('token', 'abc')).toBeUndefined();
    expect(local.getItem('token')).toBe('abc');
    expect(storage.getItem(`ode:${profile}:app:token`)).toBe('abc');
    local.removeItem('token');
    expect(local.getItem('token')).toBeNull();
    expect(context.localStorage).toBe(storage);
    expect(messages).toEqual([]);
  });

  it('clear only removes this profile app prefix', () => {
    const { context, storage } = createBrowser();
    injectHost(context);
    vm.runInContext(injection, context);
    const local = context.formulus.getLocalStorageRef();
    local.setItem('a', 'a');
    local.setItem('b', 'b');
    storage.setItem(`ode:${profile}:formplayer:formulus_drafts`, 'draft');
    storage.setItem(`ode:${profile}-suffix:app:a`, 'other');
    storage.setItem('third-party', 'raw');
    expect(local.clear()).toBeUndefined();
    expect(local.getItem('a')).toBeNull();
    expect(local.getItem('b')).toBeNull();
    expect(storage.length).toBe(3);
  });

  it('cleans all tombstoned namespaces and only designated legacy storage', () => {
    const { context, storage } = createBrowser();
    const dead = settings.deletedProfileIds![0];
    for (const namespace of ['app', 'formplayer', 'future'])
      storage.setItem(`ode:${dead}:${namespace}:x`, 'dead');
    storage.setItem('formulus_drafts', 'unknown Desktop owner');
    storage.setItem('formulus_sticky_fields', 'legacy');
    storage.setItem('third-party', 'raw');
    injectHost(context);
    vm.runInContext(injection, context);
    expect(storage.length).toBe(3);
    expect(storage.getItem('formulus_drafts')).toBe('unknown Desktop owner');
    context.__odeLegacyWebStorageProfileId = dead;
    vm.runInContext(injection, context);
    expect(storage.getItem('formulus_drafts')).toBeNull();
    expect(storage.getItem('formulus_sticky_fields')).toBeNull();
    expect(storage.getItem('third-party')).toBe('raw');
    expect(context.__odeDeletedProfileIds).toEqual([dead]);
  });

  it('fails closed without identity, for malformed IDs, and for deleted active profiles', () => {
    for (const id of [undefined, '', 'bad:id', 'deleted-desktop-uuid']) {
      const { context, messages } = createBrowser();
      context.__odeProfileId = id;
      context.__odeDeletedProfileIds = settings.deletedProfileIds;
      expect(() => vm.runInContext(injection, context)).toThrow();
      expect(context.formulus).toBeUndefined();
      expect(messages).toEqual([]);
    }
  });

  it('supports an explicit development ID and idempotent reinjection', () => {
    const { context } = createBrowser();
    context.__odeProfileId = 'formplayer-dev';
    vm.runInContext(injection, context);
    const api = context.formulus;
    vm.runInContext(injection, context);
    expect(context.formulus).toBe(api);
    expect(api.getProfileId()).toBe('formplayer-dev');
  });

  it('propagates storage errors and does not signal ready if deletion fails', () => {
    const { context, storage, messages } = createBrowser();
    injectHost(context);
    storage.setItem('ode:deleted-desktop-uuid:app:a', 'dead');
    storage.removeItem = () => {
      throw new Error('blocked');
    };
    expect(() => vm.runInContext(injection, context)).toThrow('blocked');
    expect(messages).toEqual([]);
  });

  it('does not accept absent or deleted active Desktop profiles', () => {
    expect(() =>
      buildProfileStorageInjection({ ...settings, activeProfileId: '' }),
    ).toThrow();
    expect(() =>
      buildProfileStorageInjection({
        ...settings,
        deletedProfileIds: [profile],
      }),
    ).toThrow();
  });
});
