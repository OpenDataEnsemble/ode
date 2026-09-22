import { deferred } from '../../services/testUtils/profileMocks';

jest.mock(
  '../../profiles/ProfileActivity',
  () => ({
    profileActivity:
      require('../../services/testUtils/profileMocks').createProfileActivityMock(),
  }),
  { virtual: true },
);
jest.mock(
  '../../profiles/ProfileRuntime',
  () => ({
    assertProfileReady: jest.fn(),
    getActiveProfile: jest.fn(() => ({ dbName: 'formulus' })),
  }),
  { virtual: true },
);
jest.mock('../../profiles/nativeProfileLifecycle', () => ({
  prepareProfileDatabase: jest.fn(async () => {}),
}));
jest.mock('../installWatermelonLogBridge', () => ({
  installWatermelonLogBridge: jest.fn(),
}));
jest.mock('../probeSqliteEngine', () => ({
  logSqliteEngine: jest.fn(async () => {}),
}));
jest.mock('../../diagnostics/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn() },
}));
jest.mock('../models/ObservationModel', () => ({ ObservationModel: class {} }));
jest.mock('@nozbe/watermelondb/adapters/sqlite', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(function () {
    this.initializingPromise = Promise.resolve();
  }),
}));
jest.mock('@nozbe/watermelondb', () => ({
  ...jest.requireActual('@nozbe/watermelondb'),
  Q: { unsafeSqlQuery: jest.fn(sql => sql) },
  Database: jest.fn().mockImplementation(function () {
    this.read = jest.fn(work => work());
    this.get = jest.fn(() => ({
      query: jest.fn(() => ({ unsafeFetchRaw: jest.fn(async () => []) })),
    }));
  }),
}));

function context() {
  jest.resetModules();
  return {
    db: require('../database') as typeof import('../database'),
    Adapter: require('@nozbe/watermelondb/adapters/sqlite')
      .default as jest.Mock,
    Database: require('@nozbe/watermelondb').Database as jest.Mock,
    prepare: require('../../profiles/nativeProfileLifecycle')
      .prepareProfileDatabase as jest.Mock,
    runtime: require('../../profiles/ProfileRuntime'),
    activity: require('../../profiles/ProfileActivity').profileActivity,
    probe: require('../probeSqliteEngine').logSqliteEngine as jest.Mock,
  };
}

test('module import does not open SQLite; bootstrap awaits native preparation, setup, readiness and probe', async () => {
  const { db, Adapter, Database, prepare, activity, probe, runtime } =
    context();
  expect(Adapter).not.toHaveBeenCalled();
  expect(Database).not.toHaveBeenCalled();
  expect(() => db.getDatabase()).toThrow('not initialized');
  const native = deferred<void>();
  const setup = deferred<void>();
  const read = deferred<unknown[]>();
  const probeDone = deferred<void>();
  const adapterStarted = deferred<void>();
  const readStarted = deferred<void>();
  const probeStarted = deferred<void>();
  runtime.getActiveProfile.mockReturnValue({
    dbName: 'formulus_11111111-2222-3333-4444-555555555555',
  });
  prepare.mockReturnValue(native.promise);
  Adapter.mockImplementationOnce(function () {
    this.initializingPromise = setup.promise;
    adapterStarted.resolve();
  });
  Database.mockImplementationOnce(function () {
    this.read = work => work();
    this.get = () => ({
      query: () => ({
        unsafeFetchRaw: () => {
          readStarted.resolve();
          return read.promise;
        },
      }),
    });
  });
  probe.mockImplementationOnce(() => {
    probeStarted.resolve();
    return probeDone.promise;
  });
  const init = db.initializeProfileDatabase();
  expect(db.initializeProfileDatabase()).toBe(init);
  expect(activity.isBusy()).toBe(true);
  expect(Adapter).not.toHaveBeenCalled();
  native.resolve();
  await adapterStarted.promise;
  expect(Adapter).toHaveBeenCalledWith(
    expect.objectContaining({
      dbName: 'formulus_11111111-2222-3333-4444-555555555555',
    }),
  );
  expect(Database).not.toHaveBeenCalled();
  setup.resolve();
  await readStarted.promise;
  expect(() => db.getDatabase()).toThrow('not initialized');
  expect(probe).not.toHaveBeenCalled();
  read.resolve([]);
  await probeStarted.promise;
  expect(() => db.getDatabase()).toThrow('not initialized');
  probeDone.resolve();
  await init;
  expect(db.getDatabase()).toBe(db.database);
  expect(activity.isBusy()).toBe(false);
  await db.initializeProfileDatabase();
  expect(prepare).toHaveBeenCalledTimes(1);
  expect(Adapter).toHaveBeenCalledTimes(1);
});

test('Default uses the legacy formulus name and a setup failure never publishes or reopens it', async () => {
  const { db, Adapter, prepare, probe } = context();
  Adapter.mockImplementationOnce(function () {
    this.initializingPromise = Promise.reject(new Error('migration failed'));
  });
  await expect(db.initializeProfileDatabase()).rejects.toThrow(
    'migration failed',
  );
  expect(prepare).toHaveBeenCalledWith('formulus');
  expect(() => db.getDatabase()).toThrow('not initialized');
  await expect(db.initializeProfileDatabase()).rejects.toThrow(
    'migration failed',
  );
  expect(Adapter).toHaveBeenCalledTimes(1);
  expect(probe).not.toHaveBeenCalled();
});

test('native preparation failure never constructs an adapter', async () => {
  const { db, Adapter, prepare } = context();
  prepare.mockRejectedValueOnce(
    new Error('another runtime owns this database'),
  );
  await expect(db.initializeProfileDatabase()).rejects.toThrow(
    'another runtime',
  );
  expect(Adapter).not.toHaveBeenCalled();
});

test('a readiness query failure leaves the compatibility export unavailable', async () => {
  const { db, Database } = context();
  Database.mockImplementationOnce(function () {
    this.read = async () => {
      throw new Error('missing observations');
    };
  });
  await expect(db.initializeProfileDatabase()).rejects.toThrow(
    'missing observations',
  );
  expect(db.database).toBeUndefined();
});
