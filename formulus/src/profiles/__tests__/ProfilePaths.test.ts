const {
  A,
  B,
  DOCS,
  CACHE,
  root,
  cacheRoot,
  profile,
  createHarness,
} = require('./fixtures/profileHarness.cjs');

test('paths cannot be used before runtime initialization', () => {
  const { paths } = createHarness().boot();
  expect(() => paths.profilePath('forms/schema.json')).toThrow('bootstrap');
  expect(() => paths.profileCachePath('export.zip')).toThrow('bootstrap');
});

test('documents, cache and all standard directories are isolated by immutable profile ID', async () => {
  const h = createHarness();
  const { runtime, paths } = h.boot();
  runtime.initializeProfileRuntime(profile(A));
  expect(paths.profileRootFor(B)).toBe(`${DOCS}/profiles/${B}`);
  expect(paths.profileCacheRootFor(B)).toBe(`${CACHE}/profiles/${B}`);
  expect(paths.profilePaths.root()).toBe(root(A));
  expect(paths.profilePaths.cache()).toBe(cacheRoot(A));
  for (const name of ['attachments', 'app', 'forms', 'signatures'])
    expect(paths.profilePaths[name]()).toBe(`${root(A)}/${name}`);
  expect(paths.profilePath('forms/census/schema.json')).toBe(
    `${root(A)}/forms/census/schema.json`,
  );
  expect(paths.profileCachePath('exports/observations.zip')).toBe(
    `${cacheRoot(A)}/exports/observations.zip`,
  );
  await paths.ensureProfileDirectories(A);
  await paths.ensureProfileDirectories(A);
  for (const name of [
    'attachments/draft',
    'attachments/pending',
    'attachments/synced',
    'app',
    'forms',
    'signatures',
  ])
    expect(h.files.get(`${root(A)}/${name}`)).toEqual({ kind: 'directory' });
  expect(h.files.get(cacheRoot(A))).toEqual({ kind: 'directory' });
  expect(h.files.has(root(B))).toBe(false);
});

test.each([
  '',
  '/outside',
  '../outside',
  'forms/../outside',
  './forms',
  'forms/./a',
  'forms\\outside',
  'forms/\0bad',
])('rejects unsafe relative path %j', relative => {
  const { runtime, paths } = createHarness().boot();
  runtime.initializeProfileRuntime(profile(A));
  expect(() => paths.profilePath(relative)).toThrow('profile-relative');
  expect(() => paths.profileCachePath(relative)).toThrow('profile-relative');
});

test.each([
  '../escape',
  A + '\n',
  A.toUpperCase().replace('11111111', 'AAAAAAAA'),
  '',
  'not-a-uuid',
])('rejects unsafe profile ID %j before filesystem access', async id => {
  const h = createHarness();
  const { paths } = h.boot();
  expect(() => paths.profileRootFor(id)).toThrow('Invalid profile ID');
  expect(() => paths.profileCacheRootFor(id)).toThrow('Invalid profile ID');
  await expect(paths.ensureProfileDirectories(id)).rejects.toThrow(
    'Invalid profile ID',
  );
  expect(h.mutations()).toEqual([]);
});
