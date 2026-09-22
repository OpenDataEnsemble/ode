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
    getActiveProfile: jest.fn(() => ({
      id: 'field-b',
      serverUrl: 'https://bound.example',
      legacyClientId: false,
    })),
  }),
  { virtual: true },
);
jest.mock(
  '../../profiles/ProfileRegistry',
  () => ({ profileRegistry: { updateConnection: jest.fn() } }),
  { virtual: true },
);
jest.mock(
  '../../profiles/ProfileStorage',
  () => ({
    __esModule: true,
    default: { getItem: jest.fn(), setItem: jest.fn() },
  }),
  { virtual: true },
);
jest.mock('react-native-device-info', () => ({
  __esModule: true,
  default: { getUniqueId: jest.fn(async () => 'device-id') },
}));

import { serverConfigService } from '../ServerConfigService';
import { clientIdService } from '../ClientIdService';
import { sequenceCounterService } from '../SequenceCounterService';
import { getActiveProfile } from '../../profiles/ProfileRuntime';
import { profileRegistry } from '../../profiles/ProfileRegistry';
import storage from '../../profiles/ProfileStorage';

describe('profile-owned connection and counters', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clientIdService.resetCache();
  });

  it('reads the registry authority, never legacy settings', async () => {
    expect(await serverConfigService.getServerUrl()).toBe(
      'https://bound.example',
    );
    expect(storage.getItem).not.toHaveBeenCalled();
    await serverConfigService.saveServerUrl('EXAMPLE.COM/');
    expect(profileRegistry.updateConnection).toHaveBeenCalledWith({
      serverUrl: 'https://example.com',
    });
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('never bypasses the registry when clearing a locked URL', async () => {
    jest
      .mocked(profileRegistry.updateConnection)
      .mockRejectedValueOnce(new Error('URL locked'));
    await expect(serverConfigService.clearServerUrl()).rejects.toThrow(
      'URL locked',
    );
    expect(profileRegistry.updateConnection).toHaveBeenCalledWith({
      serverUrl: '',
    });
  });

  it('retains the legacy sync client ID only for the migrated profile', async () => {
    expect(await clientIdService.getClientId()).toBe(
      'formulus-device-id-field-b',
    );
    clientIdService.resetCache();
    jest
      .mocked(getActiveProfile)
      .mockReturnValueOnce({ ...getActiveProfile(), legacyClientId: true });
    expect(await clientIdService.getClientId()).toBe('formulus-device-id');
  });

  it('stores sequence state in profile storage using the profile client ID', async () => {
    jest.mocked(storage.getItem).mockResolvedValueOnce('8');
    expect(await sequenceCounterService.allocate('household')).toBe(9);
    expect(storage.setItem).toHaveBeenCalledWith(
      '@ode_sequence:device:formulus-device-id-field-b:household',
      '9',
    );
  });
});
