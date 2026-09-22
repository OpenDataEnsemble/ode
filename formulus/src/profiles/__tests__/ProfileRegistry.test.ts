import type { ProfileRegistryData } from '../ProfileTypes';

const {
  A,
  B,
  C,
  REGISTRY_KEY,
  DOCS,
  prefix,
  service,
  root,
  cacheRoot,
  profile,
  registry,
  createHarness,
} = require('./fixtures/profileHarness.cjs');

function setup() {
  const h = createHarness();
  return { h, app: h.boot() };
}

describe('ProfileRegistry bootstrap and identity', () => {
  test.each(['AsyncStorage', 'directory', 'database'])(
    '%s legacy evidence retains formulus and the old sync client ID',
    async evidence => {
      const { h, app } = setup();
      if (evidence === 'AsyncStorage') h.values.set('@last_seen_version', '73');
      if (evidence === 'directory')
        h.write(`${DOCS}/forms/census/schema.json`, '{"type":"object"}');
      if (evidence === 'database') h.databases.add('formulus');
      await app.registry.initialize();
      expect(app.registry.list()).toEqual([
        expect.objectContaining({
          id: A,
          label: 'Default',
          dbName: 'formulus',
          legacyClientId: true,
          legacyWebStorage: true,
        }),
      ]);
      expect(app.registry.getLegacyWebStorageProfileId()).toBe(A);
      expect(await app.client.getClientId()).toBe('formulus-device-123');
      expect(h.native.prepareDatabase).not.toHaveBeenCalled();
      expect(h.native.deleteDatabase).not.toHaveBeenCalled();
    },
  );

  test('a fresh Default owns a new database and client ID, preserving global preferences', async () => {
    const { h, app } = setup();
    const globals = {
      '@ode/uiLocale': 'fr',
      '@theme': 'dark',
      '@diagnostics/enabled': 'true',
      '@unrelated': 'keep',
    };
    for (const [key, value] of Object.entries(globals))
      h.values.set(key, value);
    await app.registry.initialize();
    expect(app.runtime.getActiveProfile()).toMatchObject({
      id: A,
      dbName: `formulus_${A}`,
      legacyClientId: false,
      legacyWebStorage: false,
    });
    expect(await app.client.getClientId()).toBe(`formulus-device-123-${A}`);
    expect(app.registry.getLegacyWebStorageProfileId()).toBeNull();
    for (const [key, value] of Object.entries(globals)) {
      expect(h.values.get(key)).toBe(value);
      expect(h.values.has(prefix(A) + key)).toBe(false);
    }
  });

  test('keychain surviving uninstall does not bind orphan credentials to a fresh Default', async () => {
    const { h, app } = setup();
    h.credentials.set(h.defaultService, {
      username: 'former-user',
      password: 'former-password',
    });
    await app.registry.initialize();
    expect(app.runtime.getActiveProfile()).toMatchObject({
      dbName: `formulus_${A}`,
      username: '',
      serverUrl: '',
      legacyClientId: false,
    });
    expect(h.credentials.has(service(A))).toBe(false);
    expect(h.credentials.has(h.defaultService)).toBe(false);
  });

  test.each(['direct', 'settings'])(
    'legacy %s URL is normalized and permanently locked',
    async source => {
      const { h, app } = setup();
      h.values.set(
        source === 'direct' ? '@server_url' : '@settings',
        source === 'direct'
          ? ' HTTPS://EXAMPLE.ORG/Team/ '
          : JSON.stringify({ serverUrl: ' HTTPS://EXAMPLE.ORG/Team/ ' }),
      );
      h.values.set('@user', JSON.stringify({ username: 'stored-user' }));
      h.credentials.set(h.defaultService, {
        username: 'keychain-user',
        password: 'secret',
      });
      await app.registry.initialize();
      expect(app.runtime.getActiveProfile()).toMatchObject({
        serverUrl: 'https://example.org/team',
        username: 'keychain-user',
        urlLocked: true,
      });
      expect(h.credentials.get(service(A))).toEqual({
        username: 'keychain-user',
        password: 'secret',
      });
    },
  );

  test('parallel initialize calls share one promise and one generated identity', async () => {
    const { h, app } = setup();
    const first = app.registry.initialize();
    expect(app.registry.initialize()).toBe(first);
    await first;
    expect(app.registry.initialize()).toBe(first);
    expect(h.native.generateProfileId).toHaveBeenCalledTimes(1);
  });

  test('orphaned profile files without a registry fail closed', async () => {
    const { h, app } = setup();
    h.write(`${root(B)}/attachments/photo.jpg`, 'precious');
    const before = h.snapshot();
    await expect(app.registry.initialize()).rejects.toThrow(
      'without their registry',
    );
    expect(h.snapshot()).toEqual(before);
    expect(h.mutations()).toEqual([]);
  });

  test('native database evidence errors never silently create a fresh installation', async () => {
    const { h, app } = setup();
    h.failOnce('native.databaseExists');
    await expect(app.registry.initialize()).rejects.toThrow('Injected failure');
    expect(h.values.has(REGISTRY_KEY)).toBe(false);
    expect(h.mutations()).toEqual([]);
  });
});

describe('corrupt registries fail closed before touching any data', () => {
  const cases: [string, (value: ProfileRegistryData) => unknown][] = [
    ['unsupported schema', value => ({ ...value, schemaVersion: 2 })],
    ['no profiles', value => ({ ...value, profiles: [] })],
    ['missing tombstones', value => ({ ...value, deletedProfiles: undefined })],
    [
      'non-boolean tombstone completion',
      value => ({
        ...value,
        deletedProfiles: [
          { id: B, dbName: `formulus_${B}`, nativeCleanupComplete: 'false' },
        ],
      }),
    ],
    [
      'missing tombstone completion',
      value => ({
        ...value,
        deletedProfiles: [{ id: B, dbName: `formulus_${B}` }],
      }),
    ],
    ['missing selection', value => ({ ...value, activeProfileId: B })],
    [
      'duplicate ID',
      value => ({ ...value, profiles: [value.profiles[0], value.profiles[0]] }),
    ],
    [
      'duplicate database',
      value => ({
        ...value,
        profiles: [
          profile(A, { dbName: 'formulus' }),
          profile(B, { dbName: 'formulus' }),
        ],
      }),
    ],
    [
      'foreign database name',
      value => ({
        ...value,
        profiles: [profile(A, { dbName: `formulus_${B}` })],
      }),
    ],
    [
      'path traversal ID',
      value => ({ ...value, profiles: [profile('../escape')] }),
    ],
    [
      'empty label',
      value => ({ ...value, profiles: [profile(A, { label: ' ' })] }),
    ],
    [
      'locked empty URL',
      value => ({ ...value, profiles: [profile(A, { urlLocked: true })] }),
    ],
    [
      'invalid URL',
      value => ({
        ...value,
        profiles: [profile(A, { serverUrl: 'https://' })],
      }),
    ],
    [
      'unknown browser owner',
      value => ({ ...value, legacyWebStorageProfileId: C }),
    ],
    [
      'missing journal owner',
      value => ({ ...value, migration: { profileId: B, complete: false } }),
    ],
    [
      'invalid journal flag',
      value => ({ ...value, migration: { profileId: A, complete: 'yes' } }),
    ],
    [
      'live/tombstoned duplicate',
      value => ({
        ...value,
        deletedProfiles: [
          { id: A, dbName: `formulus_${A}`, nativeCleanupComplete: false },
        ],
      }),
    ],
  ];
  test.each(cases)('%s', async (_name, corrupt) => {
    const { h, app } = setup();
    h.seedRegistry(corrupt(registry()));
    h.values.set('@token', 'keep');
    h.write(`${root(A)}/attachments/a.jpg`, 'keep');
    h.write(
      `${root(B)}/attachments/deleted.jpg`,
      'do not touch corrupt registry data',
    );
    h.values.set(prefix(B) + '@token', 'do not remove');
    h.credentials.set(service(B), { username: 'B', password: 'keep' });
    const before = h.snapshot();
    await expect(app.registry.initialize()).rejects.toThrow();
    expect(() => app.runtime.getActiveProfile()).toThrow('bootstrap');
    expect(h.snapshot()).toEqual(before);
    expect(h.mutations()).toEqual([]);
  });

  test.each(['{broken-json', 'null'])(
    'unparseable registry %s retains the rejected initialization until JS reset',
    async raw => {
      const { h, app } = setup();
      h.values.set(REGISTRY_KEY, raw);
      const first = app.registry.initialize();
      await expect(first).rejects.toThrow();
      h.seedRegistry(registry());
      expect(app.registry.initialize()).toBe(first);
      await expect(app.registry.initialize()).rejects.toThrow();
      expect(h.mutations()).toEqual([]);
      await h.boot().registry.initialize();
    },
  );
});

describe('durable registry mutations', () => {
  test('URL lock cannot be unset, cleared or rebound; normalized same URL and username remain editable', async () => {
    const { h, app } = setup();
    await app.registry.initialize();
    await expect(
      app.registry.updateConnection({ urlLocked: true }),
    ).rejects.toThrow('empty');
    await app.registry.updateConnection({
      serverUrl: 'HTTPS://EXAMPLE.ORG/Team/',
      urlLocked: true,
    });
    const before = h.readRegistry();
    for (const update of [
      { urlLocked: false },
      { serverUrl: '' },
      { serverUrl: 'https://other.example.org' },
    ]) {
      await expect(app.registry.updateConnection(update)).rejects.toThrow(
        /lock/,
      );
      expect(h.readRegistry()).toEqual(before);
    }
    await app.registry.updateConnection({
      serverUrl: 'https://EXAMPLE.org/TEAM/',
      username: 'new-user',
    });
    expect(app.runtime.getActiveProfile()).toMatchObject({
      serverUrl: 'https://example.org/team',
      username: 'new-user',
      urlLocked: true,
    });
    const cold = h.boot();
    await cold.registry.initialize();
    await expect(
      cold.registry.updateConnection({ urlLocked: false }),
    ).rejects.toThrow('cannot be unlocked');
  });

  test('serialized add/rename writes preserve both additions and defensive list copies', async () => {
    const { h, app } = setup();
    await app.registry.initialize();
    const [b, c] = await Promise.all([
      app.registry.add(' B '),
      app.registry.add(' C '),
    ]);
    await Promise.all([
      app.registry.rename(b.id, ' Team B '),
      app.registry.rename(c.id, ' Team C '),
    ]);
    expect(
      h.readRegistry().profiles.map((p: { label: string }) => p.label),
    ).toEqual(['Default', 'Team B', 'Team C']);
    const copy = app.registry.list();
    copy[0].label = 'external mutation';
    expect(app.registry.list()[0].label).toBe('Default');
  });

  test('failed persist does not publish a new state, and mutation queue remains usable', async () => {
    const { h, app } = setup();
    await app.registry.initialize();
    const listener = jest.fn();
    app.registry.subscribe(listener);
    const before = h.readRegistry();
    h.failOnce('as.setItem', { when: (key: string) => key === REGISTRY_KEY });
    await expect(app.registry.rename(A, 'Lost rename')).rejects.toThrow(
      'Injected',
    );
    expect(app.registry.list()).toEqual(before.profiles);
    expect(app.runtime.getActiveProfile().label).toBe('Default');
    expect(listener).not.toHaveBeenCalled();
    await app.registry.rename(A, 'Saved rename');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  test('commit changes next-boot selection without runtime identity, storage scope, or observer publication', async () => {
    const { h, app } = setup();
    await app.registry.initialize();
    await app.registry.add('B');
    const listener = jest.fn();
    app.registry.subscribe(listener);
    await app.registry.commitSelection(B);
    expect(h.readRegistry().activeProfileId).toBe(B);
    expect(app.runtime.getActiveProfile().id).toBe(A);
    expect(app.paths.profilePaths.root()).toBe(root(A));
    await app.storage.setItem('@token', 'old-runtime-only');
    expect(h.values.get(prefix(A) + '@token')).toBe('old-runtime-only');
    expect(h.values.has(prefix(B) + '@token')).toBe(false);
    expect(listener).not.toHaveBeenCalled();
    const cold = h.boot();
    await cold.registry.initialize();
    expect(cold.runtime.getActiveProfile().id).toBe(B);
  });

  test('last profile deletion and invalid selections never alter the registry', async () => {
    const { h, app } = setup();
    await app.registry.initialize();
    const before = h.readRegistry();
    await expect(app.registry.commitSelection(A, A)).rejects.toThrow();
    await expect(app.registry.commitSelection(B, A)).rejects.toThrow();
    await expect(app.registry.commitSelection(A, B)).rejects.toThrow();
    expect(h.readRegistry()).toEqual(before);
  });
});

describe('cold-launch preflight', () => {
  test('a native open-state probe rejection fails closed before migration or cleanup', async () => {
    const { h, app } = setup();
    h.seedRegistry(
      registry([profile(A)], { migration: { profileId: A, complete: false } }),
    );
    h.write(`${DOCS}/attachments/photo.jpg`, 'keep');
    h.failOnce('native.isDatabaseOpen');
    const before = h.snapshot();
    await expect(app.registry.initialize()).rejects.toThrow('Injected failure');
    expect(h.snapshot()).toEqual(before);
    expect(h.mutations()).toEqual([]);
    expect(() => app.runtime.getActiveProfile()).toThrow('bootstrap');
  });
  test.each(['selected', 'inactive', 'deleted', 'completed deletion'])(
    'an open %s database blocks every file/storage mutation until a real cold launch',
    async kind => {
      const { h, app } = setup();
      const a = profile(A, { dbName: 'formulus', legacyClientId: true });
      const b = profile(B);
      const deleted = kind === 'deleted' || kind === 'completed deletion';
      h.seedRegistry(
        registry(deleted ? [a] : [a, b], {
          migration: { profileId: A, complete: false },
          deletedProfiles: deleted
            ? [
                {
                  id: B,
                  dbName: b.dbName,
                  nativeCleanupComplete: kind === 'completed deletion',
                },
              ]
            : [],
        }),
      );
      h.write(`${DOCS}/attachments/legacy.jpg`, 'must not move while DB open');
      h.write(`${root(B)}/forms/schema.json`, 'must not delete while DB open');
      h.values.set('@last_seen_version', '17');
      h.values.set(prefix(B) + '@token', 'must not remove');
      h.credentials.set(service(B), { username: 'B', password: 'keep' });
      h.opened.add(kind === 'selected' ? a.dbName : b.dbName);
      const before = h.snapshot();
      const first = app.registry.initialize();
      await expect(first).rejects.toMatchObject({
        code: 'E_PROFILE_COLD_LAUNCH_REQUIRED',
      });
      expect(h.snapshot()).toEqual(before);
      expect(h.mutations()).toEqual([]);
      expect(() => app.runtime.getActiveProfile()).toThrow('bootstrap');
      h.opened.clear();
      expect(app.registry.initialize()).toBe(first);
      await expect(first).rejects.toMatchObject({
        code: 'E_PROFILE_COLD_LAUNCH_REQUIRED',
      });
      const cold = h.boot();
      await cold.registry.initialize();
      expect(cold.runtime.getActiveProfile().id).toBe(A);
    },
  );

  test('checks every live and tombstoned database before migration or cleanup', async () => {
    const { h, app } = setup();
    h.seedRegistry(
      registry([profile(A), profile(B)], {
        deletedProfiles: [
          { id: C, dbName: `formulus_${C}`, nativeCleanupComplete: true },
        ],
      }),
    );
    await app.registry.initialize();
    expect(
      h.native.isDatabaseOpen.mock.calls.map(([name]: [string]) => name).sort(),
    ).toEqual([A, B, C].map(id => `formulus_${id}`).sort());
    const firstMutation = h.events.findIndex(
      (event: { mutation: boolean }) => event.mutation,
    );
    const checks = h.events
      .map((event: { operation: string }, index: number) =>
        event.operation === 'native.isDatabaseOpen' ? index : -1,
      )
      .filter((index: number) => index >= 0);
    expect(checks.every((index: number) => index < firstMutation)).toBe(true);
  });
});

describe('deletion tombstones', () => {
  test.each(['false', 'rejection'])(
    'native deletion %s retains all tombstones for a later cold retry',
    async result => {
      const { h, app } = setup();
      h.seedRegistry(
        registry([profile(A)], {
          deletedProfiles: [B, C].map(id => ({
            id,
            dbName: `formulus_${id}`,
            nativeCleanupComplete: false,
          })),
        }),
      );
      for (const id of [B, C]) {
        h.databases.add(`formulus_${id}`);
        h.write(`${root(id)}/attachments/file`, id);
        h.write(`${cacheRoot(id)}/export.zip`, id);
        h.values.set(prefix(id) + '@token', id);
        h.credentials.set(service(id), { username: id, password: 'secret' });
      }
      h.values.set(prefix(A) + '@token', 'active');
      h.values.set('@ode/uiLocale', 'pt');
      const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        for (const _id of [B, C]) {
          if (result === 'false')
            h.native.deleteDatabase.mockResolvedValueOnce(false);
          else
            h.native.deleteDatabase.mockRejectedValueOnce(
              new Error('native I/O failure'),
            );
        }
        await app.registry.initialize();
        expect(h.readRegistry().deletedProfiles).toEqual(
          [B, C].map(id => ({
            id,
            dbName: `formulus_${id}`,
            nativeCleanupComplete: false,
          })),
        );
        expect(h.databases.size).toBe(2);
        expect(h.native.deleteDatabase).toHaveBeenCalledTimes(2);
        const cold = h.boot();
        await cold.registry.initialize();
        expect(h.native.deleteDatabase).toHaveBeenCalledTimes(4);
        expect(h.databases.size).toBe(0);
        expect(
          h
            .readRegistry()
            .deletedProfiles.every(
              (item: { nativeCleanupComplete: boolean }) =>
                item.nativeCleanupComplete,
            ),
        ).toBe(true);
        expect(cold.registry.getDeletedProfileIds()).toEqual([B, C]);
        expect(h.values.get(prefix(A) + '@token')).toBe('active');
        expect(h.values.get('@ode/uiLocale')).toBe('pt');
        for (const id of [B, C]) {
          expect(h.files.has(root(id))).toBe(false);
          expect(h.files.has(cacheRoot(id))).toBe(false);
          expect(h.credentials.has(service(id))).toBe(false);
        }
      } finally {
        warning.mockRestore();
      }
    },
  );

  const cleanupFailures: [string, string, Record<string, unknown>][] = [
    ['key enumeration', 'as.getAllKeys', {}],
    ['partial key removal', 'as.removeItem', { at: 2 }],
    ['keychain removal', 'kc.reset', {}],
    ['keychain verification', 'kc.get', {}],
    ['directory check', 'fs.exists', {}],
    [
      'documents removal',
      'fs.unlink',
      { when: (path: string) => path === root(B) },
    ],
    [
      'cache removal',
      'fs.unlink',
      { when: (path: string) => path === cacheRoot(B) },
    ],
    ['database removal', 'native.deleteDatabase', {}],
    [
      'completion journal',
      'as.setItem',
      { when: (key: string) => key === REGISTRY_KEY },
    ],
  ];

  for (const after of [false, true]) {
    test.each(cleanupFailures)(
      `cleanup resumes %s failure (durable=${after}) without resurrecting a deleted profile`,
      async (_name, operation, options) => {
        const { h, app } = setup();
        h.seedRegistry(
          registry([profile(A)], {
            deletedProfiles: [B, C].map(id => ({
              id,
              dbName: `formulus_${id}`,
              nativeCleanupComplete: false,
            })),
          }),
        );
        h.values.set(prefix(A) + '@token', 'active');
        h.values.set('@ode/uiLocale', 'fr');
        h.credentials.set(service(A), {
          username: 'active',
          password: 'active-password',
        });
        h.write(`${root(A)}/forms/keep`, 'active');
        for (const id of [B, C]) {
          h.values.set(prefix(id) + '@token', 'deleted');
          h.values.set(prefix(id) + '@settings', '{}');
          h.credentials.set(service(id), {
            username: 'deleted',
            password: 'secret',
          });
          h.write(`${root(id)}/attachments/data`, 'deleted');
          h.write(`${cacheRoot(id)}/export.zip`, 'deleted');
          h.databases.add(`formulus_${id}`);
        }
        h.failOnce(operation, { ...options, after });
        const warning = jest
          .spyOn(console, 'warn')
          .mockImplementation(() => {});
        try {
          await app.registry.initialize();
          expect(warning).toHaveBeenCalledWith(
            'Profile cleanup deferred until a subsequent cold launch',
          );
          expect(app.registry.list().map((p: { id: string }) => p.id)).toEqual([
            A,
          ]);
          expect(app.registry.getDeletedProfileIds()).toEqual([B, C]);
          // One failed tombstone must not prevent cleanup of the next one.
          expect(
            h
              .readRegistry()
              .deletedProfiles.find((p: { id: string }) => p.id === C)
              .nativeCleanupComplete,
          ).toBe(true);
          const cold = h.boot();
          await cold.registry.initialize();
          expect(cold.registry.getDeletedProfileIds()).toEqual([B, C]);
          expect(
            h
              .readRegistry()
              .deletedProfiles.every(
                (p: { nativeCleanupComplete: boolean }) =>
                  p.nativeCleanupComplete,
              ),
          ).toBe(true);
          for (const id of [B, C]) {
            expect(h.values.has(prefix(id) + '@token')).toBe(false);
            expect(h.values.has(prefix(id) + '@settings')).toBe(false);
            expect(h.credentials.has(service(id))).toBe(false);
            expect(h.files.has(root(id))).toBe(false);
            expect(h.files.has(cacheRoot(id))).toBe(false);
            expect(h.databases.has(`formulus_${id}`)).toBe(false);
          }
          expect(h.values.get(prefix(A) + '@token')).toBe('active');
          expect(h.values.get('@ode/uiLocale')).toBe('fr');
          expect(h.credentials.get(service(A))).toEqual({
            username: 'active',
            password: 'active-password',
          });
          expect(h.files.get(`${root(A)}/forms/keep`).content).toBe('active');
        } finally {
          warning.mockRestore();
        }
      },
    );
  }

  test('keychain reset returning false with credentials still present defers cleanup and retries', async () => {
    const { h, app } = setup();
    h.seedRegistry(
      registry([profile(A)], {
        deletedProfiles: [
          { id: B, dbName: `formulus_${B}`, nativeCleanupComplete: false },
        ],
      }),
    );
    h.credentials.set(service(B), {
      username: 'deleted',
      password: 'not removed',
    });
    h.keychain.resetGenericPassword.mockResolvedValueOnce(false);
    const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      await app.registry.initialize();
      expect(h.readRegistry().deletedProfiles[0].nativeCleanupComplete).toBe(
        false,
      );
      expect(h.native.deleteDatabase).not.toHaveBeenCalled();
      await h.boot().registry.initialize();
      expect(h.credentials.has(service(B))).toBe(false);
      expect(h.readRegistry().deletedProfiles[0].nativeCleanupComplete).toBe(
        true,
      );
    } finally {
      warning.mockRestore();
    }
  });

  test('completed deletions retain permanent browser IDs and reject UUID reuse', async () => {
    const { h, app } = setup();
    h.seedRegistry(
      registry([profile(B)], {
        legacyWebStorageProfileId: A,
        deletedProfiles: [
          { id: A, dbName: 'formulus', nativeCleanupComplete: true },
        ],
      }),
    );
    await app.registry.initialize();
    expect(app.registry.getDeletedProfileIds()).toEqual([A]);
    expect(app.registry.getLegacyWebStorageProfileId()).toBe(A);
    expect(h.native.deleteDatabase).not.toHaveBeenCalled();
    await expect(app.registry.add('Do not resurrect')).rejects.toThrow(
      'Duplicate',
    );
    await expect(app.registry.commitSelection(A)).rejects.toThrow('Invalid');
    const cold = h.boot();
    await cold.registry.initialize();
    expect(cold.registry.getDeletedProfileIds()).toEqual([A]);
    expect(cold.registry.getLegacyWebStorageProfileId()).toBe(A);
  });
});
