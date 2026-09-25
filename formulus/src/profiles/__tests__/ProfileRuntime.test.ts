const {
  A,
  B,
  profile,
  createHarness,
} = require('./fixtures/profileHarness.cjs');

test('runtime rejects every access before bootstrap', () => {
  const { runtime } = createHarness().boot();
  expect(() => runtime.assertProfileReady()).toThrow('bootstrap');
  expect(() => runtime.getActiveProfile()).toThrow('bootstrap');
  expect(() => runtime.updateRuntimeProfile(profile())).toThrow('bootstrap');
});

test('runtime copies and freezes metadata; same-identity updates are allowed', () => {
  const { runtime } = createHarness().boot();
  const source = profile();
  runtime.initializeProfileRuntime(source);
  source.label = 'mutated input';
  expect(runtime.getActiveProfile().label).toBe('Field team');
  expect(Object.isFrozen(runtime.getActiveProfile())).toBe(true);
  const updated = profile(A, { label: 'Renamed', username: 'enumerator' });
  runtime.updateRuntimeProfile(updated);
  updated.username = 'mutated';
  expect(runtime.getActiveProfile()).toMatchObject({
    label: 'Renamed',
    username: 'enumerator',
  });
  expect(Object.isFrozen(runtime.getActiveProfile())).toBe(true);
  runtime.initializeProfileRuntime(profile(A, { label: 'Same identity' }));
  expect(runtime.getActiveProfile().label).toBe('Same identity');
});

test.each(['initializeProfileRuntime', 'updateRuntimeProfile'])(
  '%s cannot replace ID or database in a running JS runtime',
  method => {
    const { runtime } = createHarness().boot();
    runtime.initializeProfileRuntime(profile(A));
    expect(() => runtime[method](profile(B))).toThrow();
    expect(() => runtime[method](profile(A, { dbName: 'formulus' }))).toThrow();
    expect(runtime.getActiveProfile()).toEqual(profile(A));
  },
);
