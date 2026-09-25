jest.mock(
  '../../../profiles/ProfileActivity',
  () => ({
    profileActivity:
      require('../../../services/testUtils/profileMocks').createProfileActivityMock(),
  }),
  { virtual: true },
);
jest.mock(
  '../../../profiles/ProfileRuntime',
  () => ({
    getActiveProfile: jest.fn(() => ({
      id: 'profile-a',
      serverUrl: 'https://bound.example',
    })),
  }),
  { virtual: true },
);
jest.mock(
  '../../../profiles/ProfilePaths',
  () =>
    require('../../../services/testUtils/profileMocks').createProfilePathsMock(
      '/documents/profiles/b',
      '/cache/profiles/b',
    ),
  { virtual: true },
);
jest.mock('react-native-fs', () => ({
  __esModule: true,
  default: { downloadFile: jest.fn() },
}));

import { createRequestFunction } from '../generated/common';
import { synkronusDownload } from '../download';
import { deferred } from '../../../services/testUtils/profileMocks';
import RNFS from 'react-native-fs';
import type { AxiosInstance } from 'axios';
import { getActiveProfile } from '../../../profiles/ProfileRuntime';

const { profileActivity } = require('../../../profiles/ProfileActivity');

beforeEach(() => {
  jest.clearAllMocks();
  profileActivity.unblock();
  jest.mocked(getActiveProfile).mockReturnValue({
    id: 'profile-a',
    serverUrl: 'https://bound.example',
  } as ReturnType<typeof getActiveProfile>);
});

test('rejects a stale generated client and blocks cached client requests after transition', async () => {
  const axios = { defaults: {}, request: jest.fn() };
  const request = createRequestFunction(
    { url: '/api/sync/pull', options: {} },
    axios as unknown as AxiosInstance,
    'https://bound.example',
  );
  await expect(
    request(axios as unknown as AxiosInstance, 'https://other.example'),
  ).rejects.toThrow('active profile');
  expect(axios.request).not.toHaveBeenCalled();
  profileActivity.block();
  await expect(request()).rejects.toThrow('Profile transition');
  expect(axios.request).not.toHaveBeenCalled();
});

test('rejects cached clients from another profile even when both use the same URL', async () => {
  const axios = { defaults: {}, request: jest.fn() };
  const request = createRequestFunction(
    { url: '/api/sync/pull', options: {} },
    axios as unknown as AxiosInstance,
    'https://bound.example',
    { basePath: 'https://bound.example', odeProfileId: 'profile-a' } as never,
  );
  jest.mocked(getActiveProfile).mockReturnValue({
    id: 'profile-b',
    serverUrl: 'https://bound.example',
  } as ReturnType<typeof getActiveProfile>);
  await expect(request()).rejects.toThrow('active profile');
  expect(axios.request).not.toHaveBeenCalled();
});

test('tracks the actual request until its transport settles', async () => {
  const response = deferred<unknown>();
  const axios = { defaults: {}, request: jest.fn(() => response.promise) };
  const request = createRequestFunction(
    { url: '/api/sync/pull', options: {} },
    axios as unknown as AxiosInstance,
    'https://bound.example',
  );
  const job = request();
  expect(profileActivity.isBusy()).toBe(true);
  response.resolve({ data: {} });
  await job;
  expect(profileActivity.isBusy()).toBe(false);
});

test('native downloads stay busy until the native promise settles, not a cancel request', async () => {
  const native = deferred<RNFS.DownloadResult>();
  jest
    .mocked(RNFS.downloadFile)
    .mockReturnValueOnce({ jobId: 42, promise: native.promise });
  const download = synkronusDownload({
    fromUrl: 'https://bound.example/api/attachments/a',
    toFile: '/documents/profiles/b/attachments/synced/a',
    authToken: 'token',
  });
  expect(download.jobId).toBe(42);
  expect(profileActivity.isBusy()).toBe(true);
  expect(() => profileActivity.block()).toThrow('Wait for profile jobs');
  native.resolve({ jobId: 42, statusCode: 200, bytesWritten: 1 });
  await download.promise;
  expect(profileActivity.isBusy()).toBe(false);
});

test('rejects cross-profile native destinations before starting a job', () => {
  expect(() =>
    synkronusDownload({
      fromUrl: 'https://bound.example/api/attachments/a',
      toFile: '/documents/profiles/a/attachments/a',
      authToken: 'token',
    }),
  ).toThrow('outside');
  expect(RNFS.downloadFile).not.toHaveBeenCalled();
});
