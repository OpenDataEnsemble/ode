jest.mock(
  '../../../profiles/ProfileActivity',
  () => ({
    profileActivity:
      require('../../../services/testUtils/profileMocks').createProfileActivityMock(),
  }),
  { virtual: true },
);
jest.mock('../../../services/GeolocationService', () => ({
  geolocationService: {
    getCachedLocation: () => null,
    getCurrentLocationForObservation: async () => null,
  },
}));
jest.mock('../../../services/ToastService', () => ({
  ToastService: {
    showGeolocationCaptured: jest.fn(),
    showGeolocationUnavailable: jest.fn(),
  },
}));
jest.mock('../../../services/ClientIdService', () => ({
  clientIdService: { getClientId: async () => 'profile-client' },
}));
jest.mock('../../../api/synkronus/Auth', () => ({
  getUserInfo: async () => null,
}));
jest.mock('../../../diagnostics/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn() },
}));
jest.mock('../../../services/ObservationIndexService', () => ({
  __esModule: true,
  default: { getInstance: () => ({ incrementalReindex: mockReindex }) },
}));
const mockReindex = jest.fn(async () => {});

import { WatermelonDBRepo } from '../WatermelonDBRepo';
import { deferred } from '../../../services/testUtils/profileMocks';
const { profileActivity } = require('../../../profiles/ProfileActivity');

async function fixture() {
  profileActivity.unblock();
  const collection = {
    query: jest.fn(() => ({
      fetch: jest.fn(async () => []),
      unsafeFetchRaw: jest.fn(async () => []),
    })),
    create: jest.fn(async callback => {
      const row = { _raw: {} };
      callback(row);
      return row;
    }),
  };
  const db = {
    get: jest.fn(() => collection),
    write: jest.fn(async work => work()),
    adapter: { unsafeExecute: jest.fn(async () => {}) },
  };
  const repo = new WatermelonDBRepo(db as never);
  await (
    repo as unknown as { ensureColumnIndexes(): Promise<void> }
  ).ensureColumnIndexes();
  jest.clearAllMocks();
  return { repo, collection, db };
}

test('save remains busy through index persistence, not merely SQLite insertion', async () => {
  const { repo, collection } = await fixture();
  const index = deferred<void>();
  const indexing = deferred<void>();
  mockReindex.mockImplementationOnce(() => {
    indexing.resolve();
    return index.promise;
  });
  const saving = repo.saveObservation({ formType: 'person', data: {} });
  await indexing.promise;
  expect(collection.create).toHaveBeenCalled();
  expect(profileActivity.isBusy()).toBe(true);
  expect(() => profileActivity.block()).toThrow('Wait for profile jobs');
  index.resolve();
  await saving;
  expect(profileActivity.isBusy()).toBe(false);
});

test('list/count queries both drain after one fails', async () => {
  const { repo, collection } = await fixture();
  const count = deferred<unknown[]>();
  const countStarted = deferred<void>();
  collection.query
    .mockReturnValueOnce({
      unsafeFetchRaw: async () => {
        throw new Error('list failed');
      },
    } as never)
    .mockReturnValueOnce({
      unsafeFetchRaw: () => {
        countStarted.resolve();
        return count.promise;
      },
    } as never);
  let settled = false;
  const listing = repo
    .listObservationsPage({ page: 1, pageSize: 25 })
    .catch(error => {
      settled = true;
      return error;
    });
  await countStarted.promise;
  await Promise.resolve();
  expect(settled).toBe(false);
  expect(profileActivity.isBusy()).toBe(true);
  count.resolve([{ cnt: 0 }]);
  expect(await listing).toEqual(new Error('list failed'));
  expect(profileActivity.isBusy()).toBe(false);
});

test('cached repositories cannot start reads or writes after transition begins', async () => {
  const { repo, db, collection } = await fixture();
  profileActivity.block();
  await expect(repo.getObservation('id')).rejects.toThrow('Profile transition');
  await expect(repo.getAllObservations()).rejects.toThrow('Profile transition');
  await expect(repo.getPendingChanges()).rejects.toThrow('Profile transition');
  await expect(
    repo.saveObservation({ formType: 'person', data: {} }),
  ).rejects.toThrow('Profile transition');
  await expect(
    repo.updateObservation({ observationId: 'id', data: {} }),
  ).rejects.toThrow('Profile transition');
  await expect(repo.deleteObservation('id')).rejects.toThrow(
    'Profile transition',
  );
  await expect(repo.applyServerChanges([])).rejects.toThrow(
    'Profile transition',
  );
  await expect(repo.markObservationsAsSynced([])).rejects.toThrow(
    'Profile transition',
  );
  expect(db.write).not.toHaveBeenCalled();
  expect(collection.query).not.toHaveBeenCalled();
  profileActivity.unblock();
});
