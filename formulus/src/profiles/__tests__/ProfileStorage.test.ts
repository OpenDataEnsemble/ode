const {
  A,
  B,
  prefix,
  profile,
  createHarness,
  deferred,
} = require('./fixtures/profileHarness.cjs');

function setup() {
  const h = createHarness();
  const app = h.boot();
  app.runtime.initializeProfileRuntime(profile(A));
  h.values.set('@token', 'legacy-global');
  h.values.set(prefix(B) + '@token', 'other-profile');
  h.values.set('@ode/uiLocale', 'fr');
  return { h, app };
}

test('scopes every single/batch API and strips only its own prefix from returned keys', async () => {
  const { h, app } = setup();
  expect(await app.storage.getItem('@token')).toBeNull();
  await app.storage.setItem('@token', 'ours');
  expect(await app.storage.getItem('@token')).toBe('ours');
  await app.storage.multiSet([
    ['@settings', '{}'],
    ['nested:foreign:key', 'value'],
  ]);
  expect(
    await app.storage.multiGet([
      '@token',
      '@settings',
      'missing',
      'nested:foreign:key',
    ]),
  ).toEqual([
    ['@token', 'ours'],
    ['@settings', '{}'],
    ['missing', null],
    ['nested:foreign:key', 'value'],
  ]);
  expect((await app.storage.getAllKeys()).sort()).toEqual(
    ['@token', '@settings', 'nested:foreign:key'].sort(),
  );
  await app.storage.removeItem('@token');
  await app.storage.multiRemove(['@settings', 'missing']);
  expect(await app.storage.getAllKeys()).toEqual(['nested:foreign:key']);
  expect(h.values.get('@token')).toBe('legacy-global');
  expect(h.values.get(prefix(B) + '@token')).toBe('other-profile');
});

test('clear removes only this profile, preserving global, foreign and similar-looking keys', async () => {
  const { h, app } = setup();
  h.values.set(prefix(A) + '@token', 'ours');
  h.values.set(`ode:${A}:webview:localStorage`, 'browser');
  h.values.set(`ode:${A}:nativeish:key`, 'not native storage');
  await app.storage.clear();
  expect([...h.values.entries()]).toEqual([
    ['@token', 'legacy-global'],
    [prefix(B) + '@token', 'other-profile'],
    ['@ode/uiLocale', 'fr'],
    [`ode:${A}:webview:localStorage`, 'browser'],
    [`ode:${A}:nativeish:key`, 'not native storage'],
  ]);
  h.storage.multiRemove.mockClear();
  await app.storage.clear();
  expect(h.storage.multiRemove).not.toHaveBeenCalled();
});

test('read failures propagate and never fall back to a global or another profile token', async () => {
  const { h, app } = setup();
  h.failOnce('as.getItem', {
    when: (key: string) => key === prefix(A) + '@token',
  });
  await expect(app.storage.getItem('@token')).rejects.toThrow('Injected');
  expect(h.storage.getItem).toHaveBeenCalledTimes(1);
  expect(h.storage.getItem).toHaveBeenCalledWith(prefix(A) + '@token');
  expect(app.activity.isBusy()).toBe(false);
});

test('in-flight storage holds the real activity gate until native completion', async () => {
  const { h, app } = setup();
  const read = deferred();
  h.storage.getItem.mockReturnValueOnce(read.promise);
  const operation = app.storage.getItem('@settings');
  expect(app.activity.isBusy()).toBe(true);
  expect(() => app.activity.beginTransition()).toThrow(
    'wait for profile operations',
  );
  read.resolve('saved');
  expect(await operation).toBe('saved');
  expect(app.activity.isBusy()).toBe(false);
});

test('all storage APIs fail before bootstrap without native calls', async () => {
  const h = createHarness();
  const { storage } = h.boot();
  for (const operation of [
    () => storage.getItem('key'),
    () => storage.setItem('key', 'value'),
    () => storage.removeItem('key'),
    () => storage.multiGet(['key']),
    () => storage.multiSet([['key', 'value']]),
    () => storage.multiRemove(['key']),
    () => storage.getAllKeys(),
    () => storage.clear(),
  ])
    await expect(operation()).rejects.toThrow('bootstrap');
  expect(h.events).toEqual([]);
});

test('all storage APIs reject after transition lock without accessing native storage', async () => {
  const { h, app } = setup();
  app.activity.beginTransition();
  for (const operation of [
    () => app.storage.getItem('key'),
    () => app.storage.setItem('key', 'value'),
    () => app.storage.removeItem('key'),
    () => app.storage.multiGet(['key']),
    () => app.storage.multiSet([['key', 'value']]),
    () => app.storage.multiRemove(['key']),
    () => app.storage.getAllKeys(),
    () => app.storage.clear(),
  ])
    await expect(operation()).rejects.toThrow('wait for profile operations');
  expect(h.events).toEqual([]);
});
