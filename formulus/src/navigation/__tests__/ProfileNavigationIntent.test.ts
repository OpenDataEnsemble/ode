import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  consumeProfilesNavigationIntent,
  transitionToProfiles,
} from '../ProfileNavigationIntent';

let mockActiveId = 'one';
let mockStored: string | null = null;
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(async (_key: string, value: string) => {
    mockStored = value;
  }),
  getItem: jest.fn(async () => mockStored),
  removeItem: jest.fn(async () => {
    mockStored = null;
  }),
}));
jest.mock(
  '../../profiles/ProfileRuntime',
  () => ({
    getActiveProfile: () => ({ id: mockActiveId }),
  }),
  { virtual: true },
);

beforeEach(() => {
  jest.clearAllMocks();
  mockActiveId = 'one';
  mockStored = null;
});

test('records only profile IDs before a native restart and consumes the destination once', async () => {
  await transitionToProfiles(async () => {
    expect(JSON.parse(mockStored!)).toEqual({
      fromProfileId: 'one',
      targetProfileId: 'two',
    });
    mockActiveId = 'two';
  }, 'two');
  expect(await consumeProfilesNavigationIntent()).toBe(true);
  expect(await consumeProfilesNavigationIntent()).toBe(false);
});

test('reopens Profiles after active deletion selects a fallback', async () => {
  await transitionToProfiles(async () => {
    mockActiveId = 'fallback';
  });
  expect(await consumeProfilesNavigationIntent()).toBe(true);
});

test('does not redirect after a busy transition rejects, even if cleanup fails', async () => {
  jest
    .mocked(AsyncStorage.removeItem)
    .mockRejectedValueOnce(new Error('storage unavailable'));
  const error = new Error('busy');
  await expect(
    transitionToProfiles(async () => {
      throw error;
    }, 'two'),
  ).rejects.toBe(error);
  expect(await consumeProfilesNavigationIntent()).toBe(false);
});

test('does not start a transition when its destination cannot be persisted', async () => {
  jest
    .mocked(AsyncStorage.setItem)
    .mockRejectedValueOnce(new Error('storage unavailable'));
  const transition = jest.fn();
  await expect(transitionToProfiles(transition, 'two')).rejects.toThrow(
    'storage unavailable',
  );
  expect(transition).not.toHaveBeenCalled();
});

test('ignores an intent for another profile', async () => {
  await transitionToProfiles(async () => {}, 'two');
  mockActiveId = 'three';
  expect(await consumeProfilesNavigationIntent()).toBe(false);
});

test.each(['not json', 'null', '{}', '{"fromProfileId": 5}'])(
  'ignores malformed navigation intent %s',
  async stored => {
    mockStored = stored;
    expect(await consumeProfilesNavigationIntent()).toBe(false);
  },
);
