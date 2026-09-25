const { createHash } = require('node:crypto');

// .cjs keeps this fixture out of the project's __tests__/**/*.[jt]s matcher.
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const C = '33333333-3333-4333-8333-333333333333';
const REGISTRY_KEY = '@ode/profiles/registry';
const DOCS = '/documents';
const CACHE = '/cache';
const prefix = id => `ode:${id}:native:`;
const service = id => `org.opendataensemble.formulus.profile.${id}`;
const root = id => `${DOCS}/profiles/${id}`;
const cacheRoot = id => `${CACHE}/profiles/${id}`;

function profile(id = A, overrides = {}) {
  return {
    id,
    label: 'Field team',
    serverUrl: '',
    username: '',
    dbName: `formulus_${id}`,
    urlLocked: false,
    legacyClientId: false,
    legacyWebStorage: false,
    ...overrides,
  };
}

function registry(profiles = [profile()], overrides = {}) {
  return {
    schemaVersion: 1,
    activeProfileId: profiles[0].id,
    profiles,
    deletedProfiles: [],
    legacyWebStorageProfileId: null,
    migration: null,
    ...overrides,
  };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function createHarness() {
  const values = new Map();
  const files = new Map();
  const credentials = new Map();
  const databases = new Set();
  const opened = new Set();
  const events = [];
  const failures = [];
  const ids = [A, B, C];
  const defaultService = 'org.opendataensemble.formulus';

  function failOnce(operation, options = {}) {
    const failure = {
      operation,
      at: 1,
      after: false,
      when: () => true,
      error: new Error(`Injected failure: ${operation}`),
      ...options,
    };
    failures.push(failure);
    return failure.error;
  }

  // Rejections after mutation model native operations whose durable result is
  // ambiguous to JS. Per-key multiRemove failures model interrupted batch removal.
  async function invoke(operation, args, work, mutation = false) {
    events.push({ operation, args, mutation });
    const failure = failures.find(item => {
      if (item.operation !== operation || !item.when(...args)) return false;
      item.at -= 1;
      return item.at === 0;
    });
    if (failure) failures.splice(failures.indexOf(failure), 1);
    if (failure && !failure.after) throw failure.error;
    const result = await work();
    if (failure) throw failure.error;
    return result;
  }

  const storage = {
    getItem: jest.fn(key =>
      invoke('as.getItem', [key], () => values.get(key) ?? null),
    ),
    setItem: jest.fn((key, value) =>
      invoke(
        'as.setItem',
        [key, value],
        () => {
          if (typeof value !== 'string')
            throw new TypeError('AsyncStorage requires strings');
          values.set(key, value);
        },
        true,
      ),
    ),
    removeItem: jest.fn(key =>
      invoke(
        'as.removeItem',
        [key],
        () => {
          values.delete(key);
        },
        true,
      ),
    ),
    getAllKeys: jest.fn(() =>
      invoke('as.getAllKeys', [], () => [...values.keys()]),
    ),
    multiGet: jest.fn(keys =>
      invoke('as.multiGet', [keys], () =>
        keys.map(key => [key, values.get(key) ?? null]),
      ),
    ),
    multiSet: jest.fn(entries =>
      invoke(
        'as.multiSet',
        [entries],
        async () => {
          for (const [key, value] of entries) await storage.setItem(key, value);
        },
        true,
      ),
    ),
    multiRemove: jest.fn(keys =>
      invoke(
        'as.multiRemove',
        [keys],
        async () => {
          for (const key of keys) await storage.removeItem(key);
        },
        true,
      ),
    ),
  };

  function mkdir(path) {
    if (files.get(path)?.kind === 'file') throw new Error(`ENOTDIR: ${path}`);
    const parent = path.slice(0, path.lastIndexOf('/'));
    if (parent && !files.has(parent)) mkdir(parent);
    files.set(path, { kind: 'directory' });
  }
  function write(path, content) {
    mkdir(path.slice(0, path.lastIndexOf('/')));
    files.set(path, { kind: 'file', content });
  }
  function readDirectory(path) {
    if (files.get(path)?.kind !== 'directory')
      throw new Error(`ENOTDIR: ${path}`);
    return [...files.entries()]
      .filter(
        ([name]) =>
          name.startsWith(path + '/') &&
          !name.slice(path.length + 1).includes('/'),
      )
      .map(([name, node]) => ({
        path: name,
        name: name.slice(path.length + 1),
        isFile: () => node.kind === 'file',
        isDirectory: () => node.kind === 'directory',
      }));
  }
  mkdir(DOCS);
  mkdir(CACHE);
  const fs = {
    DocumentDirectoryPath: DOCS,
    CachesDirectoryPath: CACHE,
    exists: jest.fn(path => invoke('fs.exists', [path], () => files.has(path))),
    mkdir: jest.fn(path => invoke('fs.mkdir', [path], () => mkdir(path), true)),
    readDir: jest.fn(path =>
      invoke('fs.readDir', [path], () => readDirectory(path)),
    ),
    hash: jest.fn((path, algorithm) =>
      invoke('fs.hash', [path, algorithm], () => {
        const node = files.get(path);
        if (node?.kind !== 'file') throw new Error(`ENOENT: ${path}`);
        return createHash(algorithm).update(node.content).digest('hex');
      }),
    ),
    moveFile: jest.fn((source, target) =>
      invoke(
        'fs.moveFile',
        [source, target],
        () => {
          const node = files.get(source);
          if (node?.kind !== 'file') throw new Error(`ENOENT: ${source}`);
          if (
            files.get(target.slice(0, target.lastIndexOf('/')))?.kind !==
            'directory'
          )
            throw new Error(`ENOENT parent: ${target}`);
          // A real native rename may overwrite. Tests must prove production checks first.
          files.set(target, { ...node });
          files.delete(source);
        },
        true,
      ),
    ),
    unlink: jest.fn(path =>
      invoke(
        'fs.unlink',
        [path],
        () => {
          if (!files.has(path)) throw new Error(`ENOENT: ${path}`);
          for (const name of files.keys()) {
            if (name === path || name.startsWith(path + '/'))
              files.delete(name);
          }
        },
        true,
      ),
    ),
  };

  const keychain = {
    getGenericPassword: jest.fn(options =>
      invoke('kc.get', [options], () => {
        const name = options?.service ?? defaultService;
        const entry = credentials.get(name);
        return entry ? { ...entry, service: name, storage: 'Keystore' } : false;
      }),
    ),
    setGenericPassword: jest.fn((username, password, options) =>
      invoke(
        'kc.set',
        [username, password, options],
        () => {
          const name = options?.service ?? defaultService;
          credentials.set(name, { username, password });
          return { service: name, storage: 'Keystore' };
        },
        true,
      ),
    ),
    resetGenericPassword: jest.fn(options =>
      invoke(
        'kc.reset',
        [options],
        () => {
          credentials.delete(options?.service ?? defaultService);
          return true;
        },
        true,
      ),
    ),
  };
  const native = {
    generateProfileId: jest.fn(() =>
      invoke('native.generateProfileId', [], () => {
        if (!ids.length) throw new Error('No fixture UUIDs remaining');
        return ids.shift();
      }),
    ),
    databaseExists: jest.fn(name =>
      invoke('native.databaseExists', [name], () => databases.has(name)),
    ),
    isDatabaseOpen: jest.fn(name =>
      invoke('native.isDatabaseOpen', [name], () => opened.has(name)),
    ),
    prepareDatabase: jest.fn(name =>
      invoke(
        'native.prepareDatabase',
        [name],
        () => {
          if (opened.size && !opened.has(name))
            throw Object.assign(new Error('Cold launch required'), {
              code: 'E_PROFILE_COLD_LAUNCH_REQUIRED',
            });
          opened.add(name);
        },
        true,
      ),
    ),
    deleteDatabase: jest.fn(name =>
      invoke(
        'native.deleteDatabase',
        [name],
        () => {
          if (opened.has(name)) return false;
          databases.delete(name);
          return true;
        },
        true,
      ),
    ),
    restartRuntime: jest.fn(() =>
      invoke('native.restartRuntime', [], () => undefined, true),
    ),
  };

  // Reset JS singletons, not persisted storage or native process state. Tests
  // explicitly clear opened to distinguish a cold process from a JS-only reload.
  function boot() {
    jest.resetModules();
    jest.doMock('../../../database/database', () => ({
      initializeProfileDatabase: jest.fn(async () => {}),
    }));
    jest.doMock('../../../services/invalidateProfileServiceCaches', () => ({
      invalidateProfileServiceCaches: jest.fn(),
    }));
    jest.doMock('@react-native-async-storage/async-storage', () => ({
      __esModule: true,
      default: storage,
    }));
    jest.doMock('react-native-fs', () => ({ __esModule: true, default: fs }));
    jest.doMock('react-native-keychain', () => keychain);
    jest.doMock('react-native', () => ({
      NativeModules: { UserAppModule: native },
      Platform: { OS: 'android' },
    }));
    jest.doMock('react-native-device-info', () => ({
      __esModule: true,
      default: { getUniqueId: jest.fn(async () => 'device-123') },
    }));
    return {
      registry: require('../../ProfileRegistry').profileRegistry,
      runtime: require('../../ProfileRuntime'),
      migration: require('../../ProfileMigration'),
      paths: require('../../ProfilePaths'),
      activity: require('../../ProfileActivity').profileActivity,
      ProfileActivity: require('../../ProfileActivity').ProfileActivity,
      storage: require('../../ProfileStorage').default,
      keychain: require('../../ProfileKeychain'),
      transitions: require('../../ProfileTransitions'),
      client: require('../../../services/ClientIdService').clientIdService,
      sequence: require('../../../services/SequenceCounterService')
        .sequenceCounterService,
    };
  }

  return {
    values,
    files,
    credentials,
    databases,
    opened,
    events,
    failures,
    ids,
    storage,
    fs,
    keychain,
    native,
    boot,
    failOnce,
    write,
    mkdir,
    defaultService,
    seedRegistry: value => values.set(REGISTRY_KEY, JSON.stringify(value)),
    readRegistry: () => JSON.parse(values.get(REGISTRY_KEY)),
    mutations: () => events.filter(event => event.mutation),
    snapshot: () => ({
      values: [...values.entries()].sort(),
      files: [...files.entries()].sort(),
      credentials: [...credentials.entries()].sort(),
      databases: [...databases].sort(),
    }),
  };
}

module.exports = {
  A,
  B,
  C,
  REGISTRY_KEY,
  DOCS,
  CACHE,
  prefix,
  service,
  root,
  cacheRoot,
  profile,
  registry,
  deferred,
  createHarness,
};
