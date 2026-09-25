jest.mock(
  '../../profiles/ProfileActivity',
  () => ({
    profileActivity:
      require('../../services/testUtils/profileMocks').createProfileActivityMock(),
  }),
  { virtual: true },
);
jest.mock(
  '../../profiles/ProfileStorage',
  () => ({
    __esModule: true,
    default: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() },
  }),
  { virtual: true },
);
jest.mock('../../services/GeolocationService', () => ({
  geolocationService: {
    getCachedLocation: () => null,
    getCurrentLocationForObservation: async () => null,
  },
}));
jest.mock('../../services/ToastService', () => ({
  ToastService: {
    showGeolocationCaptured: jest.fn(),
    showGeolocationUnavailable: jest.fn(),
  },
}));

import { FormObservationRepository } from '../FormObservationRepository';
import storage from '../../profiles/ProfileStorage';
import { deferred } from '../../services/testUtils/profileMocks';
const { profileActivity } = require('../../profiles/ProfileActivity');

beforeEach(() => {
  jest.clearAllMocks();
  profileActivity.unblock();
});

test('fallback repository persists observation and index through profile storage, holding activity until both finish', async () => {
  const indexWritten = deferred<void>();
  const indexing = deferred<void>();
  jest
    .mocked(storage.setItem)
    .mockResolvedValueOnce(undefined)
    .mockImplementationOnce(() => {
      indexing.resolve();
      return indexWritten.promise;
    });
  jest.mocked(storage.getItem).mockResolvedValue(null);
  const save = new FormObservationRepository().saveObservation('person', {
    name: 'Alice',
  });
  await indexing.promise;
  expect(storage.setItem).toHaveBeenNthCalledWith(
    1,
    expect.stringMatching(/^formulus:observation:/),
    expect.any(String),
  );
  expect(storage.setItem).toHaveBeenNthCalledWith(
    2,
    'formulus:observations:index',
    expect.any(String),
  );
  expect(profileActivity.isBusy()).toBe(true);
  indexWritten.resolve();
  expect(await save).toMatch(/^obs_/);
  expect(profileActivity.isBusy()).toBe(false);
});

test('fallback error conversions cannot swallow the profile transition gate', async () => {
  const repo = new FormObservationRepository();
  profileActivity.block();
  await expect(repo.getObservation('id')).rejects.toThrow('Profile transition');
  await expect(repo.updateObservation('id', {})).rejects.toThrow(
    'Profile transition',
  );
  await expect(repo.deleteObservation('id')).rejects.toThrow(
    'Profile transition',
  );
  expect(storage.getItem).not.toHaveBeenCalled();
  expect(storage.setItem).not.toHaveBeenCalled();
  expect(storage.removeItem).not.toHaveBeenCalled();
});
