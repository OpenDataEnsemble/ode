const {
  A,
  C,
  DOCS,
  REGISTRY_KEY,
  root,
  prefix,
  service,
  profile,
  registry,
  createHarness,
} = require('./fixtures/profileHarness.cjs');

// Explicit fixtures rather than deriving the expected inventory from production's
// allowlist: accidentally dropping a legacy key must break these tests.
const legacyEntries: [string, string][] = [
  [
    '@settings',
    JSON.stringify({ serverUrl: 'https://example.org', autoSync: true }),
  ],
  ['@server_url', 'https://example.org'],
  ['@token', 'access-token'],
  ['@refreshToken', 'refresh-token'],
  ['@tokenExpiresAt', '1782000000000'],
  ['@user', JSON.stringify({ username: 'enumerator' })],
  ['@last_seen_version', '81'],
  ['@last_attachment_version', '29'],
  ['@repository_generation', '3'],
  ['@lastSync', '2026-08-01T00:00:00Z'],
  ['@appVersion', '1.3.3'],
  ['@deferred_attachment_downloads', '["photo.jpg"]'],
  ['@ode/adaptivePullPageSize', '250'],
  ['@ode/adaptivePushBatchSize', '75'],
  ['@attachments_layout_v2', '1'],
  ['@observations', '[{"id":"obs-1","draft":true}]'],
  ['@observations:census:unknown-form', '{"opaque":true}'],
  ['@ode_sequence:device:formulus-device-123:census:households', '41'],
  ['@ode_sequence:custom-app:unknown:future/scope', '901'],
];
const legacyFiles: [string, string][] = [
  ['attachments/pending/photo.jpg', 'photo\0bytes'],
  ['attachments/draft/audio.m4a', 'recording'],
  ['attachments/synced/remote.jpg', 'downloaded'],
  ['app/dist/index.html', '<html>offline</html>'],
  ['forms/census/schema.json', '{"type":"object"}'],
  ['signatures/obs-1.png', 'signature'],
];
const globals: [string, string][] = [
  ['@ode/uiLocale', 'pt'],
  ['@theme', 'dark'],
  ['@unknown_app_setting', 'untouched'],
];
const login = { username: 'enumerator', password: 'password' };

function seed(h: ReturnType<typeof createHarness>) {
  for (const [key, value] of [...legacyEntries, ...globals])
    h.values.set(key, value);
  for (const [path, content] of legacyFiles)
    h.write(`${DOCS}/${path}`, content);
  h.credentials.set(h.defaultService, { ...login });
  h.credentials.set(service(C), { username: 'other', password: 'untouched' });
  h.databases.add('formulus');
}

function expectNoLoss(h: ReturnType<typeof createHarness>, id?: string) {
  for (const [path, content] of legacyFiles) {
    const copies = [
      h.files.get(`${DOCS}/${path}`),
      id ? h.files.get(`${root(id)}/${path}`) : undefined,
    ];
    expect(
      copies.some(node => node?.kind === 'file' && node.content === content),
    ).toBe(true);
  }
  for (const [key, value] of legacyEntries) {
    expect([
      h.values.get(key),
      id ? h.values.get(prefix(id) + key) : undefined,
    ]).toContain(value);
  }
  expect([
    h.credentials.get(h.defaultService),
    id ? h.credentials.get(service(id)) : undefined,
  ]).toContainEqual(login);
  expect(h.databases.has('formulus')).toBe(true);
  for (const [key, value] of globals) expect(h.values.get(key)).toBe(value);
  expect(h.credentials.get(service(C))).toEqual({
    username: 'other',
    password: 'untouched',
  });
}

function expectComplete(h: ReturnType<typeof createHarness>, id: string) {
  expectNoLoss(h, id);
  for (const [path, content] of legacyFiles) {
    expect(h.files.get(`${root(id)}/${path}`)).toEqual({
      kind: 'file',
      content,
    });
    expect(h.files.has(`${DOCS}/${path}`)).toBe(false);
  }
  for (const [key, value] of legacyEntries) {
    expect(h.values.get(prefix(id) + key)).toBe(value);
    expect(h.values.has(key)).toBe(false);
  }
  expect(h.credentials.has(h.defaultService)).toBe(false);
  expect(h.credentials.get(service(id))).toEqual(login);
  expect(h.readRegistry().migration).toEqual({ profileId: id, complete: true });
}

test('migrates actual legacy data, attachment migration flag, arbitrary sequence scopes and credentials; preserves globals', async () => {
  const h = createHarness();
  seed(h);
  const app = h.boot();
  await app.registry.initialize();
  expectComplete(h, A);
  expect(await app.storage.getItem('@attachments_layout_v2')).toBe('1');
  expect(await app.sequence.allocate('census:households')).toBe(42);
  expect(
    h.values.get(
      prefix(A) + '@ode_sequence:device:formulus-device-123:census:households',
    ),
  ).toBe('42');
  expect(
    h.values.get(prefix(A) + '@ode_sequence:custom-app:unknown:future/scope'),
  ).toBe('901');
  expect(h.native.prepareDatabase).not.toHaveBeenCalled();
  expect(h.native.deleteDatabase).not.toHaveBeenCalled();
  const firstMutation = h.mutations()[0];
  expect(firstMutation.operation).toBe('as.setItem');
  expect(firstMutation.args[0]).toBe(REGISTRY_KEY);
  expect(JSON.parse(firstMutation.args[1]).migration).toEqual({
    profileId: A,
    complete: false,
  });
});

test.each([
  '@attachments_layout_v2',
  '@ode_sequence:unknown:app:counter',
  '@observations:unknown-form',
])('legacy marker %s alone identifies an existing installation', async key => {
  const h = createHarness();
  h.values.set(key, '1');
  const app = h.boot();
  await app.registry.initialize();
  expect(app.runtime.getActiveProfile()).toMatchObject({
    dbName: 'formulus',
    legacyClientId: true,
  });
  expect(h.values.get(prefix(A) + key)).toBe('1');
  expect(h.values.has(key)).toBe(false);
});

test('a completed migration journal never replays leftover global legacy keys or files', async () => {
  const h = createHarness();
  h.seedRegistry(
    registry([profile(A, { dbName: 'formulus' })], {
      migration: { profileId: A, complete: true },
    }),
  );
  h.values.set('@last_seen_version', 'old');
  h.values.set(prefix(A) + '@last_seen_version', 'new');
  h.write(`${DOCS}/forms/legacy.json`, 'old');
  const app = h.boot();
  await app.registry.initialize();
  expect(h.values.get(prefix(A) + '@last_seen_version')).toBe('new');
  expect(h.values.get('@last_seen_version')).toBe('old');
  expect(h.files.get(`${DOCS}/forms/legacy.json`).content).toBe('old');
  expect(h.fs.moveFile).not.toHaveBeenCalled();
});

const failurePoints: [string, string, Record<string, unknown>][] = [
  [
    'initial journal',
    'as.setItem',
    { when: (key: string) => key === REGISTRY_KEY },
  ],
  ['directory creation', 'fs.mkdir', { at: 2 }],
  ['directory enumeration', 'fs.readDir', { at: 2 }],
  ['second file move', 'fs.moveFile', { at: 2 }],
  [
    'source directory removal',
    'fs.unlink',
    { when: (path: string) => path === `${DOCS}/attachments/pending` },
  ],
  ['key enumeration', 'as.getAllKeys', { at: 2 }],
  ['legacy key batch read', 'as.multiGet', {}],
  [
    'second key copy',
    'as.setItem',
    { at: 2, when: (key: string) => key.startsWith(prefix(A)) },
  ],
  ['credential copy', 'kc.set', {}],
  ['credential source removal', 'kc.reset', {}],
  ['partial source key removal', 'as.removeItem', { at: 3 }],
  [
    'migration completion journal',
    'as.setItem',
    { at: 2, when: (key: string) => key === REGISTRY_KEY },
  ],
];

// Both a failure with no side effect and an acknowledged-lost durable side effect
// must be resumable. A module reset gets a new singleton without erasing stores.
for (const after of [false, true]) {
  describe(
    after
      ? 'failure AFTER native side effect'
      : 'failure BEFORE native side effect',
    () => {
      test.each(failurePoints)(
        'resumes %s without losing files, keys, credentials or database ownership',
        async (_label, operation, options) => {
          const h = createHarness();
          seed(h);
          const app = h.boot();
          const error = h.failOnce(operation, { ...options, after });
          const first = app.registry.initialize();
          await expect(first).rejects.toBe(error);
          expect(() => app.runtime.getActiveProfile()).toThrow('bootstrap');
          const journal = h.values.has(REGISTRY_KEY) ? h.readRegistry() : null;
          expectNoLoss(h, journal?.activeProfileId);
          const snapshot = h.snapshot();
          expect(app.registry.initialize()).toBe(first);
          await expect(first).rejects.toBe(error);
          expect(h.snapshot()).toEqual(snapshot);
          const freshRuntime = h.boot();
          await freshRuntime.registry.initialize();
          const id = freshRuntime.runtime.getActiveProfile().id;
          if (journal) expect(id).toBe(journal.activeProfileId);
          expect(freshRuntime.registry.list()).toHaveLength(1);
          expect(freshRuntime.runtime.getActiveProfile()).toMatchObject({
            dbName: 'formulus',
            legacyClientId: true,
          });
          expectComplete(h, id);
          const completed = h.snapshot();
          const again = h.boot();
          await again.registry.initialize();
          expect(h.snapshot()).toEqual(completed);
        },
      );
    },
  );
}

test('an identical already-copied file is hashed and retired, not overwritten', async () => {
  const h = createHarness();
  h.write(`${DOCS}/attachments/photo.jpg`, 'same bytes');
  h.write(`${root(A)}/attachments/photo.jpg`, 'same bytes');
  const { migration } = h.boot();
  await migration.migrateLegacyProfile(A, false);
  expect(h.fs.hash.mock.calls).toEqual([
    [`${DOCS}/attachments/photo.jpg`, 'sha256'],
    [`${root(A)}/attachments/photo.jpg`, 'sha256'],
  ]);
  expect(h.fs.moveFile).not.toHaveBeenCalled();
  expect(h.files.has(`${DOCS}/attachments`)).toBe(false);
  expect(h.files.get(`${root(A)}/attachments/photo.jpg`).content).toBe(
    'same bytes',
  );
});

test.each(['file', 'key', 'keychain'])(
  'conflicting %s destination fails closed and is never overwritten',
  async kind => {
    const h = createHarness();
    h.seedRegistry(
      registry(
        [profile(A, { dbName: 'formulus', serverUrl: 'https://example.org' })],
        { migration: { profileId: A, complete: false } },
      ),
    );
    if (kind === 'file') {
      h.write(`${DOCS}/forms/schema.json`, 'legacy');
      h.write(`${root(A)}/forms/schema.json`, 'different destination');
    } else if (kind === 'key') {
      h.values.set('@last_seen_version', '3');
      h.values.set(prefix(A) + '@last_seen_version', '99');
    } else {
      h.credentials.set(h.defaultService, login);
      h.credentials.set(service(A), {
        ...login,
        password: 'different destination',
      });
    }
    const app = h.boot();
    await expect(app.registry.initialize()).rejects.toThrow('Conflicting');
    expect(h.readRegistry().migration.complete).toBe(false);
    if (kind === 'file') {
      expect(h.files.get(`${DOCS}/forms/schema.json`).content).toBe('legacy');
      expect(h.files.get(`${root(A)}/forms/schema.json`).content).toBe(
        'different destination',
      );
      expect(h.fs.moveFile).not.toHaveBeenCalled();
    } else if (kind === 'key') {
      expect(h.values.get('@last_seen_version')).toBe('3');
      expect(h.values.get(prefix(A) + '@last_seen_version')).toBe('99');
    } else {
      expect(h.credentials.get(h.defaultService)).toEqual(login);
      expect(h.credentials.get(service(A)).password).toBe(
        'different destination',
      );
    }
  },
);

test('unverified key write never removes any legacy source keys', async () => {
  const h = createHarness();
  h.values.set('@last_seen_version', '4');
  h.storage.setItem.mockResolvedValueOnce(undefined);
  const { migration } = h.boot();
  await expect(migration.migrateLegacyProfile(A, false)).rejects.toThrow(
    'verification failed',
  );
  expect(h.values.get('@last_seen_version')).toBe('4');
  expect(h.storage.multiRemove).not.toHaveBeenCalled();
  await migration.migrateLegacyProfile(A, false);
  expect(h.values.get(prefix(A) + '@last_seen_version')).toBe('4');
});

test.each([
  'false result',
  'missing destination',
  'wrong password',
  'source retirement refused',
])('keychain %s preserves sources and can be retried', async mode => {
  const h = createHarness();
  h.values.set('@server_url', 'https://example.org');
  h.credentials.set(h.defaultService, login);
  const app = h.boot();
  if (mode === 'false result')
    h.keychain.setGenericPassword.mockResolvedValueOnce(false);
  if (mode === 'missing destination')
    h.keychain.setGenericPassword.mockResolvedValueOnce({
      service: service(A),
      storage: 'Keystore',
    });
  if (mode === 'wrong password') {
    const actual = h.keychain.getGenericPassword.getMockImplementation();
    h.keychain.getGenericPassword.mockImplementation(
      async (options?: { service: string }) => {
        const value = await actual(options);
        return options?.service === service(A) && value
          ? { ...value, password: 'unverified' }
          : value;
      },
    );
  }
  if (mode === 'source retirement refused')
    h.keychain.resetGenericPassword.mockResolvedValueOnce(false);
  await expect(app.migration.migrateLegacyProfile(A, true)).rejects.toThrow(
    /credentials|verification/,
  );
  expect(h.credentials.get(h.defaultService)).toEqual(login);
  expect(h.values.get('@server_url')).toBe('https://example.org');
  expect(h.storage.multiRemove).not.toHaveBeenCalled();
  if (mode === 'wrong password') {
    h.keychain.getGenericPassword.mockImplementation(
      async (options?: { service: string }) => {
        const name = options?.service ?? h.defaultService;
        const value = h.credentials.get(name);
        return value ? { ...value, service: name, storage: 'Keystore' } : false;
      },
    );
  }
  await app.migration.migrateLegacyProfile(A, true);
  expect(h.credentials.get(service(A))).toEqual(login);
  expect(h.credentials.has(h.defaultService)).toBe(false);
});

test('without a server URL, orphan auth is retired rather than replayed to a future server', async () => {
  const h = createHarness();
  const auth = ['@token', '@refreshToken', '@tokenExpiresAt', '@user'];
  for (const key of auth) h.values.set(key, 'orphan');
  h.values.set('@last_seen_version', '4');
  h.credentials.set(h.defaultService, login);
  const { migration } = h.boot();
  await migration.migrateLegacyProfile(A, false);
  for (const key of auth) {
    expect(h.values.has(key)).toBe(false);
    expect(h.values.has(prefix(A) + key)).toBe(false);
  }
  expect(h.values.get(prefix(A) + '@last_seen_version')).toBe('4');
  expect(h.credentials.has(service(A))).toBe(false);
  expect(h.credentials.has(h.defaultService)).toBe(false);
});
