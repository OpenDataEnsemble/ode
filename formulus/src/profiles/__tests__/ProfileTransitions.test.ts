const {
  A,
  B,
  REGISTRY_KEY,
  prefix,
  profile,
  registry,
  createHarness,
  deferred,
} = require('./fixtures/profileHarness.cjs');

async function setup(twoProfiles = true) {
  const h = createHarness();
  h.seedRegistry(
    registry(twoProfiles ? [profile(A), profile(B)] : [profile(A)]),
  );
  const app = h.boot();
  await app.registry.initialize();
  // A booted app has already opened the active profile's database.
  h.db.attempted.add(A);
  h.db.healthy.add(A);
  const host = { unmount: jest.fn(async () => {}), restore: jest.fn() };
  app.transitions.registerProfileTransitionHost(host);
  h.events.length = 0;
  return { h, app, host };
}

test('quiesces synchronously, awaits acknowledged unmount, commits and resumes without runtime reload', async () => {
  const { h, app, host } = await setup();
  const unmounted = deferred();
  const commitStarted = deferred();
  const commitAllowed = deferred();
  host.unmount.mockImplementation(() => unmounted.promise);
  const setItem = h.storage.setItem.getMockImplementation();
  h.storage.setItem.mockImplementation(async (key: string, value: string) => {
    if (key === REGISTRY_KEY) {
      commitStarted.resolve();
      await commitAllowed.promise;
    }
    return setItem(key, value);
  });
  const phases: {
    state: string;
    selected: string;
    running: string;
    busy: boolean;
  }[] = [];
  app.transitions.subscribeProfileTransition(() =>
    phases.push({
      state: app.transitions.getProfileTransitionState(),
      selected: h.readRegistry().activeProfileId,
      running: app.runtime.getActiveProfile().id,
      busy: app.activity.isBusy(),
    }),
  );
  const change = app.transitions.switchProfile(B);
  expect(app.transitions.getProfileTransitionState()).toBe('quiescing');
  expect(host.unmount).toHaveBeenCalledTimes(1);
  expect(h.readRegistry().activeProfileId).toBe(A);
  expect(h.mutations()).toEqual([]);
  await expect(app.storage.setItem('@token', 'late write')).rejects.toThrow(
    'wait for profile operations',
  );
  await expect(app.registry.add('late addition')).rejects.toThrow(
    'wait for profile operations',
  );
  await expect(app.transitions.switchProfile(B)).rejects.toThrow(
    'wait for profile operations',
  );
  unmounted.resolve();
  await commitStarted.promise;
  expect(h.readRegistry().activeProfileId).toBe(A);
  expect(app.transitions.getProfileTransitionState()).toBe('quiescing');
  commitAllowed.resolve();
  await change;
  expect(phases).toEqual([
    { state: 'quiescing', selected: A, running: A, busy: true },
    { state: 'idle', selected: B, running: B, busy: false },
  ]);
  expect(app.runtime.getActiveProfile().id).toBe(B);
  expect(h.native.restartRuntime).not.toHaveBeenCalled();
  expect(h.native.prepareDatabase).not.toHaveBeenCalled();
  expect(h.native.deleteDatabase).not.toHaveBeenCalled();
  expect(host.restore).toHaveBeenCalledTimes(1);
  for (const operation of [
    () => app.storage.getItem('@token'),
    () => app.storage.setItem('@token', 'bad'),
    () => app.registry.rename(A, 'bad'),
    () => app.registry.updateConnection({ username: 'bad' }),
    () => app.keychain.setProfileCredentials('user', 'bad'),
    () => app.keychain.getProfileCredentials(),
    () => app.sequence.allocate('census'),
    () => app.client.getClientId(),
  ])
    await operation();
  expect(h.values.has(prefix(A) + '@token')).toBe(false);
  expect(h.values.get(prefix(B) + '@token')).toBe('bad');
});

test('A → B → A works in one runtime, including profiles on the same URL', async () => {
  const { app, h, host } = await setup();
  await app.registry.updateConnection({ serverUrl: 'https://same.example' });
  // The destination has the same URL; identity must still change.
  await app.transitions.switchProfile(B);
  await app.registry.updateConnection({ serverUrl: 'https://same.example' });
  await app.storage.setItem('@token', 'B token');
  await app.transitions.switchProfile(A);
  expect(app.runtime.getActiveProfile().id).toBe(A);
  expect(h.readRegistry().activeProfileId).toBe(A);
  expect(h.values.get(prefix(B) + '@token')).toBe('B token');
  expect(host.unmount).toHaveBeenCalledTimes(2);
  expect(host.restore).toHaveBeenCalledTimes(2);
  expect(h.native.restartRuntime).not.toHaveBeenCalled();
  expect(app.transitions.getProfileTransitionState()).toBe('idle');
});

test('nested activity blocks switching until BOTH inner and outer operations finish', async () => {
  const { h, app, host } = await setup();
  const inner = deferred();
  const innerStarted = deferred();
  const innerFinished = deferred();
  const outer = deferred();
  const work = app.activity.run('save observation', async () => {
    await app.activity.run('save attachment', async () => {
      innerStarted.resolve();
      await inner.promise;
    });
    innerFinished.resolve();
    await outer.promise;
  });
  await innerStarted.promise;
  await expect(app.transitions.switchProfile(B)).rejects.toThrow(
    'wait for profile operations',
  );
  inner.resolve();
  await innerFinished.promise;
  await expect(app.transitions.switchProfile(B)).rejects.toThrow(
    'wait for profile operations',
  );
  expect(host.unmount).not.toHaveBeenCalled();
  expect(h.mutations()).toEqual([]);
  outer.resolve();
  await work;
  await app.transitions.switchProfile(B);
  expect(h.readRegistry().activeProfileId).toBe(B);
});

test.each(['formplayer', 'native picker'])(
  '%s blocker prevents destructive transitions',
  async name => {
    const { h, app, host } = await setup();
    app.activity.setBlocker(name, true);
    await expect(app.transitions.switchProfile(B)).rejects.toThrow(
      'wait for profile operations',
    );
    await expect(app.transitions.deleteProfile(A)).rejects.toThrow(
      'wait for profile operations',
    );
    expect(app.transitions.getProfileTransitionState()).toBe('idle');
    expect(host.unmount).not.toHaveBeenCalled();
    expect(h.mutations()).toEqual([]);
  },
);

test('unmount failure occurs before commit, restores old UI and permits a retry', async () => {
  const { h, app, host } = await setup();
  host.unmount.mockRejectedValueOnce(new Error('unmount failed'));
  await expect(app.transitions.switchProfile(B)).rejects.toThrow(
    'unmount failed',
  );
  expect(h.readRegistry().activeProfileId).toBe(A);
  expect(h.mutations()).toEqual([]);
  expect(host.restore).toHaveBeenCalledTimes(1);
  expect(app.transitions.getProfileTransitionState()).toBe('idle');
  expect(app.activity.isBusy()).toBe(false);
  await app.storage.setItem('@token', 'still running');
  await app.transitions.switchProfile(B);
  expect(app.transitions.getProfileTransitionState()).toBe('idle');
});

test('registry write that fails before durability rereads the registry and resumes the old profile in-app', async () => {
  const { h, app, host } = await setup();
  h.failOnce('as.setItem', {
    when: (key: string) => key === REGISTRY_KEY,
    after: false,
  });
  const states: string[] = [];
  app.transitions.subscribeProfileTransition(() =>
    states.push(app.transitions.getProfileTransitionState()),
  );
  await expect(app.transitions.switchProfile(B)).rejects.toThrow('Injected');
  expect(states).toEqual(['quiescing', 'recovering', 'idle']);
  expect(app.runtime.getActiveProfile().id).toBe(A);
  expect(h.readRegistry().activeProfileId).toBe(A);
  expect(host.restore).toHaveBeenCalledTimes(1);
  expect(app.activity.isBusy()).toBe(false);
  expect(h.db.attempted.has(B)).toBe(false);
  await app.storage.setItem('@token', 'still A');
  expect(h.values.get(prefix(A) + '@token')).toBe('still A');
  // The user can simply retry.
  await app.transitions.switchProfile(B);
  expect(app.runtime.getActiveProfile().id).toBe(B);
});

test('registry write that was durable despite an error completes the switch to the target', async () => {
  const { h, app, host } = await setup();
  h.failOnce('as.setItem', {
    when: (key: string) => key === REGISTRY_KEY,
    after: true,
  });
  await app.transitions.switchProfile(B);
  expect(app.transitions.getProfileTransitionState()).toBe('idle');
  expect(app.runtime.getActiveProfile().id).toBe(B);
  expect(h.readRegistry().activeProfileId).toBe(B);
  expect(host.restore).toHaveBeenCalledTimes(1);
  expect(app.activity.isBusy()).toBe(false);
});

test('a failed destination database open reselects the healthy previous profile without retrying the failed open', async () => {
  const { h, app, host } = await setup();
  h.db.failNextOpen = new Error('setup failed');
  await expect(app.transitions.switchProfile(B)).rejects.toThrow(
    'setup failed',
  );
  expect(app.transitions.getProfileTransitionState()).toBe('idle');
  expect(app.runtime.getActiveProfile().id).toBe(A);
  expect(h.readRegistry().activeProfileId).toBe(A);
  expect(host.restore).toHaveBeenCalledTimes(1);
  expect(app.activity.isBusy()).toBe(false);
  expect(h.db.attempted.has(B)).toBe(true);
  expect(h.db.healthy.has(B)).toBe(false);
  // B's adapter is never retried in this runtime; the app stays on A.
  await expect(app.transitions.switchProfile(B)).rejects.toThrow(
    'previously failed',
  );
  expect(app.runtime.getActiveProfile().id).toBe(A);
  expect(h.readRegistry().activeProfileId).toBe(A);
  expect(app.transitions.getProfileTransitionState()).toBe('idle');
});

test('a failed destination open after deleting the active profile stays fail-closed', async () => {
  const { h, app, host } = await setup();
  h.db.failNextOpen = new Error('setup failed');
  await expect(app.transitions.deleteProfile(A)).rejects.toThrow(
    'setup failed',
  );
  expect(app.transitions.getProfileTransitionState()).toBe('commit-failed');
  expect(app.activity.isBusy()).toBe(true);
  expect(host.restore).not.toHaveBeenCalled();
  // Deletion is durable; A cannot be resurrected and B cannot be opened here.
  expect(h.readRegistry().activeProfileId).toBe(B);
  expect(h.readRegistry().profiles).toEqual([profile(B)]);
  await expect(app.storage.setItem('@token', 'late')).rejects.toThrow(
    'wait for profile operations',
  );
  expect(h.native.restartRuntime).not.toHaveBeenCalled();
  const cold = h.boot();
  await cold.registry.initialize();
  expect(cold.runtime.getActiveProfile().id).toBe(B);
});

test('a freshly added profile gets its directories before its selection becomes durable', async () => {
  const { h, app } = await setup(false);
  // The fixture UUID list begins with A, which is already registered.
  h.ids.shift();
  const created = await app.registry.add('New');
  const root = `/documents/profiles/${created.id}`;
  expect(h.files.has(root)).toBe(false);
  const order: string[] = [];
  const setItem = h.storage.setItem.getMockImplementation();
  h.storage.setItem.mockImplementation(async (key: string, value: string) => {
    if (key === REGISTRY_KEY) order.push('commit');
    return setItem(key, value);
  });
  const mkdir = h.fs.mkdir.getMockImplementation();
  h.fs.mkdir.mockImplementation(async (path: string) => {
    order.push('mkdir');
    return mkdir(path);
  });
  await app.transitions.switchProfile(created.id);
  expect(h.files.get(`${root}/attachments/draft`)?.kind).toBe('directory');
  expect(h.files.get(`${root}/forms`)?.kind).toBe('directory');
  expect(order.indexOf('commit')).toBeGreaterThan(order.lastIndexOf('mkdir'));
  expect(app.runtime.getActiveProfile().id).toBe(created.id);
});

test('a directory failure before commit leaves the old profile running and retryable', async () => {
  const { h, app, host } = await setup();
  h.failOnce('fs.mkdir');
  await expect(app.transitions.switchProfile(B)).rejects.toThrow('Injected');
  expect(h.readRegistry().activeProfileId).toBe(A);
  expect(app.runtime.getActiveProfile().id).toBe(A);
  expect(app.transitions.getProfileTransitionState()).toBe('idle');
  expect(host.restore).toHaveBeenCalledTimes(1);
  expect(app.activity.isBusy()).toBe(false);
  await app.transitions.switchProfile(B);
  expect(app.runtime.getActiveProfile().id).toBe(B);
});

test.each([A, B])(
  'deleting %s tombstones only that profile; cleanup waits until cold boot',
  async id => {
    const { h, app, host } = await setup();
    h.values.set(prefix(id) + '@token', 'do not eagerly delete');
    await app.transitions.deleteProfile(id);
    const survivor = id === A ? B : A;
    expect(h.readRegistry()).toMatchObject({
      activeProfileId: survivor,
      profiles: [profile(survivor)],
      deletedProfiles: [
        { id, dbName: `formulus_${id}`, nativeCleanupComplete: false },
      ],
    });
    expect(h.values.get(prefix(id) + '@token')).toBe('do not eagerly delete');
    expect(h.native.deleteDatabase).not.toHaveBeenCalled();
    expect(h.native.restartRuntime).not.toHaveBeenCalled();
    expect(host.unmount).toHaveBeenCalledTimes(1);
    expect(app.runtime.getActiveProfile().id).toBe(survivor);
    expect(app.transitions.getProfileTransitionState()).toBe('idle');
    const cold = h.boot();
    await cold.registry.initialize();
    expect(h.values.has(prefix(id) + '@token')).toBe(false);
    expect(cold.registry.getDeletedProfileIds()).toEqual([id]);
  },
);

test('deleting the last profile is rejected before quiescing or any write', async () => {
  const { h, app, host } = await setup(false);
  await expect(app.transitions.deleteProfile(A)).rejects.toThrow(
    'last profile',
  );
  expect(host.unmount).not.toHaveBeenCalled();
  expect(app.activity.isBusy()).toBe(false);
  expect(app.transitions.getProfileTransitionState()).toBe('idle');
  expect(h.mutations()).toEqual([]);
  expect(h.readRegistry().profiles).toHaveLength(1);
});

test('same profile is a no-op; missing profiles and missing host fail before acquiring the gate', async () => {
  const { h, app, host } = await setup();
  await app.transitions.switchProfile(A);
  expect(host.unmount).not.toHaveBeenCalled();
  await expect(app.transitions.switchProfile('unknown')).rejects.toThrow(
    'Invalid',
  );
  await expect(app.transitions.deleteProfile('unknown')).rejects.toThrow();
  const unregister = app.transitions.registerProfileTransitionHost(host);
  unregister();
  await expect(app.transitions.switchProfile(B)).rejects.toThrow(
    'host is unavailable',
  );
  expect(app.activity.isBusy()).toBe(false);
  expect(h.mutations()).toEqual([]);
});

test('old host disposal cannot unregister a newer mounted host', async () => {
  const { app, host } = await setup();
  const unregisterOld = app.transitions.registerProfileTransitionHost(host);
  const next = { unmount: jest.fn(async () => {}), restore: jest.fn() };
  app.transitions.registerProfileTransitionHost(next);
  unregisterOld();
  await app.transitions.switchProfile(B);
  expect(host.unmount).not.toHaveBeenCalled();
  expect(next.unmount).toHaveBeenCalledTimes(1);
});
