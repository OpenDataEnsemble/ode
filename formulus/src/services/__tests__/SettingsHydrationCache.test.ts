jest.mock(
  '../../profiles/ProfileActivity',
  () => ({
    profileActivity:
      require('../testUtils/profileMocks').createProfileActivityMock(),
  }),
  { virtual: true },
);
jest.mock(
  '../../profiles/ProfileRuntime',
  () => ({
    getActiveProfile: jest.fn(() => ({ id: 'a' })),
  }),
  { virtual: true },
);
jest.mock(
  '../../profiles/ProfileKeychain',
  () => ({
    getProfileCredentials: jest.fn(),
  }),
  { virtual: true },
);
jest.mock('../ServerConfigService', () => ({
  serverConfigService: { getServerUrl: jest.fn() },
}));

import { getActiveProfile } from '../../profiles/ProfileRuntime';
import { getProfileCredentials } from '../../profiles/ProfileKeychain';
import { serverConfigService } from '../ServerConfigService';
import { deferred } from '../testUtils/profileMocks';
import {
  getSettingsHydrationSnapshot,
  invalidateSettingsHydrationCache,
  loadSettingsHydrationFromStorage,
} from '../SettingsHydrationCache';

beforeEach(() => {
  jest.clearAllMocks();
  invalidateSettingsHydrationCache();
  jest
    .mocked(getActiveProfile)
    .mockReturnValue({ id: 'a' } as ReturnType<typeof getActiveProfile>);
  jest
    .mocked(serverConfigService.getServerUrl)
    .mockResolvedValue('https://same.example');
});

test('does not publish stale credentials after a same-URL profile switch', async () => {
  const oldCredentials =
    deferred<Awaited<ReturnType<typeof getProfileCredentials>>>();
  jest
    .mocked(getProfileCredentials)
    .mockReturnValueOnce(oldCredentials.promise)
    .mockResolvedValueOnce({ username: 'bob', password: 'b' });
  const oldLoad = loadSettingsHydrationFromStorage();
  await Promise.resolve();
  jest
    .mocked(getActiveProfile)
    .mockReturnValue({ id: 'b' } as ReturnType<typeof getActiveProfile>);
  const newLoad = loadSettingsHydrationFromStorage();
  const newSnapshot = await newLoad;
  oldCredentials.resolve({ username: 'alice', password: 'a' });
  await expect(oldLoad).rejects.toThrow('Profile changed');
  expect(getSettingsHydrationSnapshot()).toEqual(newSnapshot);
  expect(newSnapshot).toEqual({
    ready: true,
    serverUrl: 'https://same.example',
    credentials: { username: 'bob', password: 'b' },
  });
});
