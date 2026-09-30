jest.mock(
  '../../profiles/ProfileActivity',
  () => ({
    profileActivity:
      require('../testUtils/profileMocks').createProfileActivityMock(),
  }),
  { virtual: true },
);
jest.mock(
  '../../profiles/ProfilePaths',
  () =>
    require('../testUtils/profileMocks').createProfilePathsMock(
      '/documents/profiles/b',
    ),
  { virtual: true },
);
jest.mock(
  '../../profiles/ProfileStorage',
  () => ({
    __esModule: true,
    default: { multiRemove: jest.fn(), setItem: jest.fn() },
  }),
  { virtual: true },
);
jest.mock('react-native-fs', () => ({
  __esModule: true,
  default: {
    exists: jest.fn(async () => true),
    mkdir: jest.fn(),
    unlink: jest.fn(),
  },
}));
jest.mock('../../database/database', () => ({
  database: {
    write: jest.fn(async work => work()),
    unsafeResetDatabase: jest.fn(),
  },
}));
jest.mock('../../api/synkronus', () => ({
  synkronusApi: { clearTokenCache: jest.fn() },
}));
jest.mock('../ObservationIndexService', () => ({
  __esModule: true,
  default: { getInstance: () => ({ reset: jest.fn() }) },
}));

import { repositoryRecoveryService } from '../RepositoryRecoveryService';
import storage from '../../profiles/ProfileStorage';
import RNFS from 'react-native-fs';

test('repository recovery clears only active attachments and the scoped deferred queue', async () => {
  await repositoryRecoveryService.wipeLocalSyncState(12);
  expect(RNFS.unlink).toHaveBeenCalledTimes(1);
  expect(RNFS.unlink).toHaveBeenCalledWith('/documents/profiles/b/attachments');
  expect(storage.multiRemove).toHaveBeenCalledWith([
    '@last_seen_version',
    '@last_attachment_version',
    '@deferred_attachment_downloads',
    '@repository_generation',
    '@lastSync',
  ]);
  expect(storage.setItem).toHaveBeenCalledWith('@repository_generation', '12');
  expect(storage.multiRemove).not.toHaveBeenCalledWith(
    expect.arrayContaining(['@token']),
  );
});
