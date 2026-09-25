jest.mock(
  '../../profiles/ProfileActivity',
  () => ({
    profileActivity:
      require('../testUtils/profileMocks').createProfileActivityMock(),
  }),
  { virtual: true },
);
const FIELD_B = '11111111-1111-4111-8111-111111111111';
const FIELD_C = '22222222-2222-4222-8222-222222222222';
jest.mock(
  '../../profiles/ProfileRegistry',
  () => ({ profileRegistry: { updateConnection: jest.fn() } }),
  { virtual: true },
);
jest.mock('../../profiles/ProfileStorage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(), setItem: jest.fn() },
}));
// Other modules loaded by these services may import the native AsyncStorage
// package directly; mock it before importing the service graph in Jest.
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    multiRemove: jest.fn(),
  },
}));
jest.mock('react-native-device-info', () => ({
  __esModule: true,
  default: { getUniqueId: jest.fn(async () => 'device-id') },
}));

import { serverConfigService } from '../ServerConfigService';
import { clientIdService } from '../ClientIdService';
import { sequenceCounterService } from '../SequenceCounterService';
import { networkProfileService } from '../NetworkProfileService';
import {
  getActiveProfile,
  selectProfileRuntime,
} from '../../profiles/ProfileRuntime';
import { profileRegistry } from '../../profiles/ProfileRegistry';
import storage from '../../profiles/ProfileStorage';

describe('profile-owned connection and counters', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    selectProfileRuntime({
      id: FIELD_B,
      dbName: `formulus_${FIELD_B}`,
      label: 'B',
      serverUrl: 'https://bound.example',
      username: '',
      urlLocked: false,
      legacyClientId: false,
      legacyWebStorage: false,
    });
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
      `formulus-device-id-${FIELD_B}`,
    );
    clientIdService.resetCache();
    selectProfileRuntime({ ...getActiveProfile(), legacyClientId: true });
    expect(await clientIdService.getClientId()).toBe('formulus-device-id');
  });

  it('drops profile-scoped client ID and sync tuning on profile change at the same URL', async () => {
    jest
      .mocked(storage.getItem)
      .mockImplementation(async key =>
        key === '@ode/adaptivePullPageSize' ? '40' : null,
      );
    expect((await networkProfileService.getSyncKnobs()).pullPageSize).toBe(40);
    expect(await clientIdService.getClientId()).toBe(
      `formulus-device-id-${FIELD_B}`,
    );
    selectProfileRuntime({
      ...getActiveProfile(),
      id: FIELD_C,
      dbName: `formulus_${FIELD_C}`,
    });
    jest
      .mocked(storage.getItem)
      .mockImplementation(async key =>
        key === '@ode/adaptivePullPageSize' ? '60' : null,
      );
    networkProfileService.invalidateForProfileSwitch();
    expect((await networkProfileService.getSyncKnobs()).pullPageSize).toBe(60);
    expect(await clientIdService.getClientId()).toBe(
      `formulus-device-id-${FIELD_C}`,
    );
    selectProfileRuntime({
      ...getActiveProfile(),
      id: FIELD_B,
      dbName: `formulus_${FIELD_B}`,
    });
    networkProfileService.invalidateForProfileSwitch();
  });

  it('stores sequence state in profile storage using the profile client ID', async () => {
    jest.mocked(storage.getItem).mockResolvedValueOnce('8');
    expect(await sequenceCounterService.allocate('household')).toBe(9);
    expect(storage.setItem).toHaveBeenCalledWith(
      `@ode_sequence:device:formulus-device-id-${FIELD_B}:household`,
      '9',
    );
  });
});
