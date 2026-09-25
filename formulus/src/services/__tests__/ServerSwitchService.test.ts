jest.mock(
  '../../profiles/ProfileActivity',
  () => ({
    profileActivity:
      require('../testUtils/profileMocks').createProfileActivityMock(),
  }),
  { virtual: true },
);
jest.mock('../../database/DatabaseService', () => ({
  databaseService: { getLocalRepo: jest.fn() },
}));
jest.mock('../../database/database', () => ({
  database: { unsafeResetDatabase: jest.fn() },
}));
jest.mock('react-native-fs', () => ({ unlink: jest.fn() }));
jest.mock('../../api/synkronus', () => ({
  synkronusApi: {
    clearTokenCache: jest.fn(),
    getUnsyncedAttachmentCount: jest.fn(),
    removeAppBundleFiles: jest.fn(),
  },
}));
jest.mock('../ServerConfigService', () => ({
  serverConfigService: { saveServerUrl: jest.fn() },
}));
jest.mock('../SettingsHydrationCache', () => ({
  invalidateSettingsHydrationCache: jest.fn(),
}));

import { serverSwitchService } from '../ServerSwitchService';
import { serverConfigService } from '../ServerConfigService';
import { synkronusApi } from '../../api/synkronus';
import { database } from '../../database/database';
import RNFS from 'react-native-fs';

describe('retired destructive server switching', () => {
  beforeEach(() => jest.clearAllMocks());

  it('delegates an unbound URL edit without erasing any local data', async () => {
    await serverSwitchService.resetForServerChange('https://new.example');
    expect(serverConfigService.saveServerUrl).toHaveBeenCalledWith(
      'https://new.example',
    );
    expect(database.unsafeResetDatabase).not.toHaveBeenCalled();
    expect(RNFS.unlink).not.toHaveBeenCalled();
    expect(synkronusApi.removeAppBundleFiles).not.toHaveBeenCalled();
    expect(synkronusApi.clearTokenCache).toHaveBeenCalled();
  });

  it('propagates a locked URL refusal without resetting anything', async () => {
    jest
      .mocked(serverConfigService.saveServerUrl)
      .mockRejectedValueOnce(
        new Error('Create another profile to use a different server'),
      );
    await expect(
      serverSwitchService.resetForServerChange('https://other.example'),
    ).rejects.toThrow('another profile');
    expect(database.unsafeResetDatabase).not.toHaveBeenCalled();
    expect(RNFS.unlink).not.toHaveBeenCalled();
    expect(synkronusApi.clearTokenCache).not.toHaveBeenCalled();
  });
});
