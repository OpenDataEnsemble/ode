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
  () => ({ __esModule: true, default: { getItem: jest.fn(async () => '12') } }),
  { virtual: true },
);
jest.mock(
  '../../profiles/ProfilePaths',
  () =>
    require('../../services/testUtils/profileMocks').createProfilePathsMock(
      '/documents/profiles/b',
      '/cache/profiles/b',
    ),
  { virtual: true },
);
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => 'dark') },
}));
jest.mock('../../services/GeolocationService', () => ({
  GeolocationService: {
    getInstance: () => ({
      startAppLocationWatch: mockStartWatch,
      stopAppLocationWatch: mockStopWatch,
    }),
  },
}));
jest.mock('../../services/SequenceCounterService', () => ({
  sequenceCounterService: { allocate: jest.fn() },
}));
jest.mock('../../services/QrcodeRequestCoordinator', () => ({
  qrcodeRequestCoordinator: { request: jest.fn(), settle: jest.fn() },
}));
jest.mock('../../services/FormService', () => ({
  FormService: { getInstance: jest.fn() },
}));
jest.mock('../../services/SyncService', () => ({
  SyncService: { getInstance: jest.fn() },
}));
jest.mock('../../services/ServerConfigService', () => ({
  ServerConfigService: { getInstance: jest.fn() },
}));
jest.mock('../../api/synkronus/Auth', () => ({ getUserInfo: jest.fn() }));
jest.mock('../../services/attachmentStorage', () => ({
  persistObservationWithAttachments: jest.fn(),
}));
jest.mock('../../database/DatabaseService', () => ({
  databaseService: { getLocalRepo: jest.fn() },
}));
jest.mock('../../diagnostics/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn() },
  persistWebViewConsole: jest.fn(),
  webViewTag: jest.fn(),
}));
jest.mock('react-native-permissions', () => ({
  check: jest.fn(),
  request: jest.fn(),
  PERMISSIONS: { IOS: { CAMERA: 'camera' } },
  RESULTS: { GRANTED: 'granted' },
}));
jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(),
  launchImageLibrary: jest.fn(),
}));
jest.mock('@react-native-documents/picker', () => ({
  pick: jest.fn(),
  types: {},
  isErrorWithCode: () => false,
  errorCodes: {},
}));
jest.mock('react-native-webview', () => ({}));
jest.mock('react-native-fs', () => ({
  __esModule: true,
  default: {
    mkdir: jest.fn(async () => {}),
    writeFile: jest.fn(async () => {}),
    stat: jest.fn(async () => ({ size: 10 })),
  },
}));

const mockWatchCleanup = jest.fn();
const mockStartWatch = jest.fn(() => mockWatchCleanup);
const mockStopWatch = jest.fn();
import {
  createFormulusMessageHandlers,
  disposeFormulusMessageHandlers,
  appEvents,
  openFormplayerFromNative,
  resolveFormOperation,
  rejectFormOperation,
  type Listener,
} from '../FormulusMessageHandlers';
import { FormulusWebViewMessageManager } from '../FormulusWebViewHandler';
import { deferred } from '../../services/testUtils/profileMocks';
import { trackProfileHandlers } from '../profileBridgeActivity';
import ProfileStorage from '../../profiles/ProfileStorage';
import GlobalStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import { Alert } from 'react-native';
import * as ImagePicker from 'react-native-image-picker';
const { profileActivity } = require('../../profiles/ProfileActivity');

beforeEach(() => {
  jest.clearAllMocks();
  profileActivity.unblock();
});

test('all factory handlers reject before doing work after a transition starts', async () => {
  const handlers = createFormulusMessageHandlers();
  profileActivity.block();
  for (const handler of Object.values(handlers)) {
    await expect((handler as () => Promise<unknown>)()).rejects.toThrow(
      'Profile transition',
    );
  }
  expect(ProfileStorage.getItem).not.toHaveBeenCalled();
});

test('generic wrapper preserves arguments, return values and full async lifetime', async () => {
  const work = deferred<number>();
  const original = jest.fn((_a: string, _b: number) => work.promise);
  const handlers = trackProfileHandlers({ example: original });
  const result = handlers.example('value', 2);
  expect(original).toHaveBeenCalledWith('value', 2);
  expect(profileActivity.isBusy()).toBe(true);
  work.resolve(7);
  await expect(result).resolves.toBe(7);
  expect(profileActivity.isBusy()).toBe(false);
});

test('native forms are tracked from pending launch through actual dismissal, with no timeout cancellation', async () => {
  jest.useFakeTimers();
  let operationId = '';
  const listener: Listener = payload => {
    operationId = (payload as { operationId: string }).operationId;
  };
  appEvents.addListener('openFormplayerRequested', listener);
  const form = openFormplayerFromNative('person');
  expect(operationId).not.toBe('');
  expect(profileActivity.isBusy()).toBe(true);
  jest.advanceTimersByTime(9 * 60 * 60 * 1000);
  expect(() => profileActivity.block()).toThrow('Wait for profile jobs');
  rejectFormOperation(operationId, new Error('dismissed'));
  await expect(form).rejects.toThrow('dismissed');
  expect(profileActivity.isBusy()).toBe(false);
  appEvents.removeListener('openFormplayerRequested', listener);
  jest.useRealTimers();
});

test('bridge form completion releases its tracked session', async () => {
  let operationId = '';
  const listener: Listener = payload => {
    operationId = (payload as { operationId: string }).operationId;
  };
  appEvents.addListener('openFormplayerRequested', listener);
  const form = createFormulusMessageHandlers().onOpenFormplayer({
    formType: 'person',
    params: {},
    savedData: {},
  });
  expect(profileActivity.isBusy()).toBe(true);
  const result = { status: 'cancelled' } as never;
  resolveFormOperation(operationId, result);
  await expect(form).resolves.toBe(result);
  expect(profileActivity.isBusy()).toBe(false);
  appEvents.removeListener('openFormplayerRequested', listener);
});

test('revision count is profile-owned while theme remains global', async () => {
  const handlers = createFormulusMessageHandlers();
  expect(await handlers.onGetCurrentDataRevisionCount()).toBe(12);
  expect(ProfileStorage.getItem).toHaveBeenCalledWith('@last_seen_version');
  expect(await handlers.onGetThemeMode()).toBe('dark');
  expect(GlobalStorage.getItem).toHaveBeenCalledWith('formulus-theme-mode');
});

test('signature IO stays in the profile and remains busy until file persistence finishes', async () => {
  const written = deferred<void>();
  const writing = deferred<void>();
  jest.mocked(RNFS.writeFile).mockImplementationOnce(() => {
    writing.resolve();
    return written.promise;
  });
  let onResult!: (result: unknown) => Promise<void>;
  const listener: Listener = payload => {
    onResult = (payload as { onResult: typeof onResult }).onResult;
  };
  appEvents.addListener('openSignatureCapture', listener);
  const capture =
    createFormulusMessageHandlers().onRequestSignature('signature');
  const callback = onResult({ status: 'success', data: { base64: 'image' } });
  await writing.promise;
  expect(RNFS.writeFile).toHaveBeenCalledWith(
    expect.stringMatching(/^\/documents\/profiles\/b\/signatures\//),
    'image',
    'base64',
  );
  expect(() => profileActivity.block()).toThrow('Wait for profile jobs');
  written.resolve();
  await callback;
  await expect(capture).resolves.toMatchObject({ status: 'success' });
  expect(profileActivity.isBusy()).toBe(false);
  profileActivity.block();
  await onResult({ status: 'success', data: { base64: 'late' } });
  expect(RNFS.writeFile).toHaveBeenCalledTimes(1);
  appEvents.removeListener('openSignatureCapture', listener);
});

test('image selection tracks the native picker promise even after its callback returns', async () => {
  const native = deferred<ImagePicker.ImagePickerResponse>();
  let chooseGallery!: () => void;
  const alert = jest
    .spyOn(Alert, 'alert')
    .mockImplementation((_title, _message, buttons) => {
      chooseGallery = buttons![1].onPress!;
    });
  jest
    .mocked(ImagePicker.launchImageLibrary)
    .mockImplementationOnce((_options, callback) => {
      callback?.({ didCancel: true });
      return native.promise;
    });
  const capture = createFormulusMessageHandlers().onRequestCamera('photo');
  chooseGallery();
  await expect(capture).resolves.toMatchObject({ status: 'cancelled' });
  expect(profileActivity.isBusy()).toBe(true);
  native.resolve({ didCancel: true });
  await native.promise;
  // Let the nested activity finally block run.
  await Promise.resolve();
  await Promise.resolve();
  expect(profileActivity.isBusy()).toBe(false);
  alert.mockRestore();
});

test('watch cleanup runs on handler disposal, listener teardown, and gated native updates', async () => {
  const handlers = createFormulusMessageHandlers();
  await handlers.onWatchLocation('field');
  disposeFormulusMessageHandlers(handlers);
  expect(mockWatchCleanup).toHaveBeenCalledTimes(1);
  const listener = jest.fn();
  appEvents.addListener('locationWatchUpdate', listener);
  profileActivity.block();
  appEvents.emit('locationWatchUpdate', {});
  expect(listener).not.toHaveBeenCalled();
  expect(mockStopWatch).toHaveBeenCalled();
  appEvents.removeListener('locationWatchUpdate', listener);
  expect(mockStopWatch).toHaveBeenCalledTimes(2);
});

test('manager reset rejects queued sends and clears delayed ready callbacks', async () => {
  jest.useFakeTimers();
  const ref = { current: { injectJavaScript: jest.fn() } };
  const manager = new FormulusWebViewMessageManager(ref as never);
  const queued = manager.send('onFormInit');
  manager.handleWebViewMessage({
    nativeEvent: { data: JSON.stringify({ type: 'onFormulusReady' }) },
  } as never);
  manager.reset();
  await expect(queued).rejects.toThrow('reset');
  jest.runAllTimers();
  expect(ref.current.injectJavaScript).not.toHaveBeenCalled();
  jest.useRealTimers();
});
