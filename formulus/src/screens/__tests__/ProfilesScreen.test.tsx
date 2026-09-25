import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import ProfilesScreen from '../ProfilesScreen';
import SettingsScreen from '../SettingsScreen';
import WelcomeScreen from '../WelcomeScreen';
import MenuDrawer from '../../components/MenuDrawer';
import { profileRegistry } from '../../profiles/ProfileRegistry';
import {
  switchProfile,
  deleteProfile,
} from '../../profiles/ProfileTransitions';
import { setCredentialsForProfile } from '../../profiles/ProfileKeychain';
import { login } from '../../api/synkronus/Auth';
import { serverConfigService } from '../../services/ServerConfigService';
import { QRSettingsService } from '../../services/QRSettingsService';
import { loadSettingsHydrationFromStorage } from '../../services/SettingsHydrationCache';
import { ToastService } from '../../services/ToastService';
import type { ScannerModalResults } from '../../components/QRScannerModal';

jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  const primitives = new Set([
    'Text',
    'TextInput',
    'View',
    'Image',
    'ScrollView',
    'ActivityIndicator',
  ]);
  return new Proxy(native, {
    get(target, key) {
      if (key === 'TouchableOpacity') {
        return ({ children, ...props }: any) =>
          require('react').createElement(
            'TouchableOpacity',
            { accessible: true, ...props },
            children,
          );
      }
      if (primitives.has(String(key))) return String(key);
      return Reflect.get(target, key);
    },
  });
});

const mockNavigate = jest.fn();
const mockReset = jest.fn();
const mockNavigation = { navigate: mockNavigate, reset: mockReset };
const mockConfirm = jest.fn();
const mockListeners = new Set<() => void>();
let mockQRResult: (result: ScannerModalResults) => void;
const makeProfile = (
  id: string,
  label: string,
  serverUrl = '',
  urlLocked = false,
) => ({
  id,
  label,
  serverUrl,
  urlLocked,
  username: '',
  dbName: id,
  legacyClientId: false,
  legacyWebStorage: false,
});
let mockProfiles = [makeProfile('one', 'First', 'https://one.example', true)];
let mockActive = mockProfiles[0];
const notify = () => mockListeners.forEach(listener => listener());

jest.mock(
  '../../profiles/ProfileRegistry',
  () => ({
    profileRegistry: {
      list: () => mockProfiles,
      subscribe: (listener: () => void) => {
        mockListeners.add(listener);
        return () => mockListeners.delete(listener);
      },
      add: jest.fn(),
      rename: jest.fn(),
      updateConnection: jest.fn(),
    },
  }),
  { virtual: true },
);
jest.mock(
  '../../profiles/ProfileRuntime',
  () => ({ getActiveProfile: () => mockActive }),
  { virtual: true },
);
jest.mock(
  '../../profiles/ProfileTransitions',
  () => ({ switchProfile: jest.fn(), deleteProfile: jest.fn() }),
  { virtual: true },
);
jest.mock(
  '../../profiles/ProfileKeychain',
  () => ({ setCredentialsForProfile: jest.fn() }),
  { virtual: true },
);
jest.mock('../../navigation/ProfileNavigationIntent', () => ({
  transitionToProfiles: (transition: () => Promise<void>) => transition(),
}));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useFocusEffect: (callback: () => void) =>
    require('react').useEffect(callback, [callback]),
}));
jest.mock('react-i18next', () => {
  const messages = require('../../locales/en.json');
  const t = (key: string, options: Record<string, string> = {}) =>
    (messages[key] || key).replace(
      /\{\{(\w+)\}\}/g,
      (_: string, name: string) => options[name] || '',
    );
  return { useTranslation: () => ({ t }) };
});
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children, ...props }: any) => {
    const { View } = require('react-native');
    return <View {...props}>{children}</View>;
  },
}));
jest.mock('@react-native-vector-icons/material-design-icons', () => 'Icon');
jest.mock('../../contexts/AppThemeContext', () => ({
  useAppTheme: () => ({
    themeColors: {
      primary: 'green',
      secondary: 'blue',
      onPrimary: 'white',
      onSurface: 'black',
      divider: 'gray',
    },
  }),
}));
jest.mock('../../hooks/useScreenShellStyle', () => ({
  useScreenShellStyle: () => ({ flex: 1 }),
}));
jest.mock('../../contexts/ConfirmModalContext', () => ({
  useConfirmModal: () => ({ showConfirm: mockConfirm }),
}));
jest.mock('../../theme/odeDesign', () => ({
  odeSpacing: { xs: 4, sm: 8, md: 16, lg: 24 },
  odeTypography: { body: 16 },
  odeBorderWidth: { hairline: 1 },
  odeRadius: { card: 8, inner: 4 },
  odeScreenHeaderHeight: 60,
}));
jest.mock('../../components/common', () => {
  return {
    Button: ({ title, onPress, disabled, accessibilityLabel }: any) => {
      const { Text, TouchableOpacity } = require('react-native');
      return (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel || title}
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={onPress}>
          <Text>{title}</Text>
        </TouchableOpacity>
      );
    },
    LocalePicker: () => {
      const { Text } = require('react-native');
      return <Text>Locale picker</Text>;
    },
    FormLocalePicker: () => {
      const { Text } = require('react-native');
      return <Text>Form locale picker</Text>;
    },
    Input: ({ disabled, rightAccessory, ...props }: any) => {
      const { TextInput, View } = require('react-native');
      return (
        <View>
          <TextInput
            {...props}
            editable={!disabled}
            accessibilityState={{ disabled }}
          />
          {rightAccessory}
        </View>
      );
    },
  };
});
jest.mock('../../components/QRScannerModal', () => ({
  __esModule: true,
  default: ({ onResult }: any) => {
    mockQRResult = onResult;
    return null;
  },
}));
jest.mock('../../api/synkronus/Auth', () => ({
  login: jest.fn(),
  getUserInfo: jest.fn(async () => null),
  isRateLimitedError: (error: any) => error?.status === 429,
  isVersionMismatchError: (error: any) =>
    error?.name === 'VersionMismatchError',
}));
jest.mock('../../services/ServerConfigService', () => ({
  normalizeServerUrl: (raw: string) => {
    try {
      const url = new URL(
        raw.includes('://') ? raw.trim() : `https://${raw.trim()}`,
      );
      return {
        ok: true,
        href: url.href.replace(/\/$/, '').toLowerCase(),
        isHttp: url.protocol === 'http:',
      };
    } catch {
      return { ok: false };
    }
  },
  serverConfigService: { isHealthEndpointOk: jest.fn() },
}));
jest.mock('../../services/QRSettingsService', () => ({
  QRSettingsService: { processQRCode: jest.fn() },
}));
jest.mock('../../services/SettingsHydrationCache', () => ({
  loadSettingsHydrationFromStorage: jest.fn(),
  getSettingsHydrationCredentialPair: (snapshot: any) =>
    snapshot.credentials || null,
}));
jest.mock('../../services/ToastService', () => ({
  ToastService: { showLong: jest.fn(), showShort: jest.fn() },
}));

jest.mock(
  '../../components/common/Button',
  () => require('../../components/common').Button,
);
jest.mock('@ode/tokens/dist/react-native/tokens-resolved', () => ({}), {
  virtual: true,
});
jest.mock('../../theme/colors', () => {
  const colors = {
    neutral: { white: 'white', black: 'black', transparent: 'transparent' },
    brand: { primary: { 500: 'green' } },
    semantic: { error: { ios: 'red' }, info: { ios: 'blue' } },
    ui: { gray: { medium: 'gray', ios: 'gray' } },
  };
  return { __esModule: true, default: colors, colors, withAlpha: () => 'gray' };
});
jest.mock('react-native-svg', () => ({
  __esModule: true,
  default: 'Svg',
  Defs: 'Defs',
  LinearGradient: 'LinearGradient',
  Stop: 'Stop',
  Rect: 'Rect',
}));
jest.mock('lucide-react-native', () => ({
  Moon: 'Moon',
  Monitor: 'Monitor',
  Sun: 'Sun',
  Languages: 'Languages',
}));
jest.mock('../../services/AppVersionService', () => ({
  appVersionService: { getFullVersion: async () => '1.3.3' },
}));
jest.mock('../../services/LocaleSettingsService', () => ({
  localeSettingsService: { load: async () => {}, getPreference: () => 'auto' },
}));
jest.mock('../../services/FormLocaleSettingsService', () => ({
  formLocaleSettingsService: {
    load: async () => {},
    getPreference: () => 'default',
  },
}));
jest.mock('../../services/FormLocaleIndexService', () => ({
  formLocaleIndexService: { getLocales: async () => [] },
}));
jest.mock('../../i18n', () => ({ syncFormulusI18nLanguage: jest.fn() }));
jest.mock('../../webview/FormulusMessageHandlers', () => ({
  appEvents: { addListener: jest.fn(), removeListener: jest.fn() },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockListeners.clear();
  mockProfiles = [
    makeProfile('one', 'First', 'https://one.example', true),
    makeProfile('two', 'Second'),
  ];
  mockActive = mockProfiles[0];
  jest.mocked(loadSettingsHydrationFromStorage).mockResolvedValue({
    ready: true,
    serverUrl: mockActive.serverUrl,
    credentials: false,
  });
  jest.mocked(serverConfigService.isHealthEndpointOk).mockResolvedValue(true);
  jest
    .mocked(login)
    .mockResolvedValue({ username: 'new-user', role: 'read-write' });
  jest.mocked(setCredentialsForProfile).mockResolvedValue(undefined);
  jest
    .mocked(profileRegistry.updateConnection)
    .mockImplementation(async connection => {
      mockActive = { ...mockActive, ...connection };
      mockProfiles = mockProfiles.map(profile =>
        profile.id === mockActive.id ? mockActive : profile,
      );
      notify();
    });
  jest.mocked(profileRegistry.rename).mockImplementation(async (id, label) => {
    mockProfiles = mockProfiles.map(profile =>
      profile.id === id ? { ...profile, label } : profile,
    );
    mockActive = mockProfiles.find(profile => profile.id === mockActive.id)!;
    notify();
  });
  jest
    .mocked(profileRegistry.add)
    .mockImplementation(async (label, connection) => {
      const created = {
        ...makeProfile('three', label || 'Third'),
        ...connection,
      };
      mockProfiles = [...mockProfiles, created];
      notify();
      return created;
    });
  jest.mocked(switchProfile).mockImplementation(async id => {
    mockActive = mockProfiles.find(profile => profile.id === id)!;
    notify();
  });
  jest.mocked(deleteProfile).mockImplementation(async id => {
    mockProfiles = mockProfiles.filter(profile => profile.id !== id);
    if (mockActive.id === id) mockActive = mockProfiles[0];
    notify();
  });
  jest.mocked(QRSettingsService.processQRCode).mockResolvedValue({
    serverUrl: 'https://one.example',
    username: 'qr-user',
    password: 'qr-secret',
  });
});

async function setup() {
  const screen = render(<ProfilesScreen />);
  await waitFor(() =>
    expect(screen.getByPlaceholderText('Username')).toHaveProp(
      'editable',
      true,
    ),
  );
  return screen;
}

async function scan() {
  await act(async () => {
    mockQRResult({
      status: 'success',
      data: { value: 'encoded-qr' },
    } as ScannerModalResults);
  });
}

async function confirm() {
  await act(async () => {
    mockConfirm.mock.lastCall![0].buttons[1].onPress();
  });
}

function cancel() {
  act(() => {
    mockConfirm.mock.lastCall![0].buttons[0].onPress();
  });
}

function openProfiles(screen: ReturnType<typeof render>) {
  fireEvent.press(screen.getByRole('button', { name: 'Choose profile' }));
}

function addFromEditor(screen: ReturnType<typeof render>) {
  fireEvent.press(screen.getAllByRole('button', { name: 'Add profile' })[1]);
}

async function openQRCreation(screen: ReturnType<typeof render>) {
  await scan();
  expect(profileRegistry.add).not.toHaveBeenCalled();
  expect(mockConfirm.mock.lastCall![0].title).toBe(
    'Add a profile for this server?',
  );
  await confirm();
  expect(screen.getByPlaceholderText('Profile name')).toHaveProp('value', '');
  expect(profileRegistry.add).not.toHaveBeenCalled();
}

test('Welcome opens Profiles rather than device Settings', () => {
  const screen = render(<WelcomeScreen />);
  fireEvent.press(screen.getByRole('button', { name: 'Get started' }));
  expect(mockReset).toHaveBeenCalledWith({
    index: 0,
    routes: [{ name: 'MainApp', params: { screen: 'Profiles' } }],
  });
});

test('drawer shows the active label and routes Login to Profiles while preserving Settings', async () => {
  const onNavigate = jest.fn();
  const screen = render(
    <MenuDrawer
      visible
      onClose={jest.fn()}
      onNavigate={onNavigate}
      onLogout={jest.fn()}
    />,
  );
  expect(screen.getByText('First')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Login' }));
  expect(onNavigate).toHaveBeenLastCalledWith('Profiles');
  fireEvent.press(screen.getByText('Settings'));
  expect(onNavigate).toHaveBeenLastCalledWith('Settings');
  await act(async () => {
    await profileRegistry.rename('one', 'New name');
  });
  expect(screen.getByText('New name')).toBeTruthy();
});

test('Settings keeps device theme, locale controls and version without connection fields', async () => {
  const screen = render(<SettingsScreen />);
  await waitFor(() => expect(screen.getByText('v1.3.3')).toBeTruthy());
  expect(screen.getByLabelText('Theme: System')).toBeTruthy();
  expect(screen.getByText('Locale picker')).toBeTruthy();
  expect(screen.getByText('Form locale picker')).toBeTruthy();
  expect(screen.queryByPlaceholderText('Server URL')).toBeNull();
  expect(screen.queryByPlaceholderText('Username')).toBeNull();
  expect(screen.queryByPlaceholderText('Password')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Login' })).toBeNull();
});

test('locks a previously authenticated URL but allows re-authentication without wiping data', async () => {
  const screen = await setup();
  expect(screen.getByPlaceholderText('Server URL')).toHaveProp(
    'editable',
    false,
  );
  expect(screen.queryByText(/server URL is locked/i)).toBeNull();
  expect(screen.queryByText(/Keep each server/)).toBeNull();
  expect(screen.queryByText(/Deleted profiles are cleaned up/)).toBeNull();
  fireEvent.changeText(screen.getByPlaceholderText('Username'), ' new-user ');
  fireEvent.changeText(screen.getByPlaceholderText('Password'), ' new-secret ');
  fireEvent.press(screen.getByRole('button', { name: 'Login' }));
  await waitFor(() =>
    expect(login).toHaveBeenCalledWith('new-user', ' new-secret '),
  );
  expect(profileRegistry.updateConnection).toHaveBeenLastCalledWith({
    username: 'new-user',
    urlLocked: true,
  });
  expect(deleteProfile).not.toHaveBeenCalled();
  expect(mockNavigate).toHaveBeenCalledWith('Sync');
});

test('normalizes the initial server and locks it only after successful login', async () => {
  mockActive = mockProfiles[1];
  const screen = await setup();
  fireEvent.changeText(
    screen.getByPlaceholderText('Server URL'),
    'Two.Example/',
  );
  fireEvent.changeText(screen.getByPlaceholderText('Username'), 'new-user');
  fireEvent.changeText(screen.getByPlaceholderText('Password'), 'secret');
  fireEvent.press(screen.getByRole('button', { name: 'Login' }));
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('Sync'));
  expect(profileRegistry.updateConnection).toHaveBeenNthCalledWith(1, {
    serverUrl: 'https://two.example',
    username: 'new-user',
  });
  expect(profileRegistry.updateConnection).toHaveBeenNthCalledWith(2, {
    username: 'new-user',
    urlLocked: true,
  });
});

test.each([
  [{ status: 429 }, 'Too many login attempts.'],
  [
    { name: 'VersionMismatchError', message: 'secret raw error' },
    'incompatible versions',
  ],
  [new Error('secret raw error'), 'Login failed.'],
])(
  'reports safe login errors without locking an unconfigured profile',
  async (error, message) => {
    mockActive = mockProfiles[1];
    jest.mocked(login).mockRejectedValueOnce(error);
    const screen = await setup();
    fireEvent.changeText(
      screen.getByPlaceholderText('Server URL'),
      'two.example',
    );
    fireEvent.changeText(screen.getByPlaceholderText('Username'), 'new-user');
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'secret');
    fireEvent.press(screen.getByRole('button', { name: 'Login' }));
    await waitFor(() =>
      expect(ToastService.showLong).toHaveBeenCalledWith(
        expect.stringContaining(message),
      ),
    );
    expect(mockActive.urlLocked).toBe(false);
    expect(mockNavigate).not.toHaveBeenCalled();
  },
);

test('does not send credentials when the health check fails', async () => {
  jest
    .mocked(serverConfigService.isHealthEndpointOk)
    .mockResolvedValueOnce(false);
  const screen = await setup();
  fireEvent.changeText(screen.getByPlaceholderText('Username'), 'user');
  fireEvent.changeText(screen.getByPlaceholderText('Password'), 'secret');
  fireEvent.press(screen.getByRole('button', { name: 'Login' }));
  await waitFor(() =>
    expect(ToastService.showLong).toHaveBeenCalledWith(
      expect.stringContaining('healthy server'),
    ),
  );
  expect(login).not.toHaveBeenCalled();
});

test('same-server QR fills credentials and logs in without adding or switching', async () => {
  const screen = await setup();
  await scan();
  await waitFor(() =>
    expect(login).toHaveBeenCalledWith('qr-user', 'qr-secret'),
  );
  expect(screen.getByPlaceholderText('Password')).toHaveProp(
    'value',
    'qr-secret',
  );
  expect(profileRegistry.add).not.toHaveBeenCalled();
  expect(switchProfile).not.toHaveBeenCalled();
});

test('locked-server QR cancellation keeps the active connection and creates nothing', async () => {
  jest.mocked(QRSettingsService.processQRCode).mockResolvedValueOnce({
    serverUrl: 'https://new.example',
    username: 'qr-user',
    password: 'qr-secret',
  });
  const screen = await setup();
  await scan();
  expect(
    mockConfirm.mock.lastCall![0].buttons.map(
      (button: { text: string }) => button.text,
    ),
  ).toEqual(['Cancel', 'Add profile']);
  expect(profileRegistry.add).not.toHaveBeenCalled();
  cancel();
  expect(screen.queryByPlaceholderText('Profile name')).toBeNull();
  expect(profileRegistry.add).not.toHaveBeenCalled();
  expect(mockActive.id).toBe('one');
});

test('QR creation requires a name before persisting scanned fields', async () => {
  jest.mocked(QRSettingsService.processQRCode).mockResolvedValueOnce({
    serverUrl: 'https://new.example',
    username: 'qr-user',
    password: 'qr-secret',
  });
  const screen = await setup();
  await openQRCreation(screen);
  expect(screen.getByPlaceholderText('Profile name')).toHaveProp(
    'required',
    true,
  );
  expect(
    screen
      .UNSAFE_getAllByType('TextInput')
      .map(input => input.props.placeholder),
  ).toEqual(['Profile name', 'Server URL', 'Username', 'Password']);
  expect(
    screen.getAllByRole('button', { name: 'Add profile' })[1],
  ).toBeDisabled();
  fireEvent.changeText(screen.getByPlaceholderText('Profile name'), '   ');
  expect(
    screen.getAllByRole('button', { name: 'Add profile' })[1],
  ).toBeDisabled();
  expect(profileRegistry.add).not.toHaveBeenCalled();
});

test('different-server QR preserves the old profile and securely hands credentials to the new profile', async () => {
  jest.mocked(QRSettingsService.processQRCode).mockResolvedValueOnce({
    serverUrl: 'https://new.example',
    username: 'qr-user',
    password: 'qr-secret',
  });
  jest
    .mocked(loadSettingsHydrationFromStorage)
    .mockResolvedValueOnce({
      ready: true,
      serverUrl: mockActive.serverUrl,
      credentials: false,
    })
    .mockResolvedValueOnce({
      ready: true,
      serverUrl: 'https://new.example',
      credentials: { username: 'qr-user', password: 'qr-secret' },
    });
  const screen = await setup();
  await openQRCreation(screen);
  expect(screen.getByPlaceholderText('Server URL')).toHaveProp(
    'value',
    'https://new.example',
  );
  expect(screen.getByPlaceholderText('Username')).toHaveProp(
    'value',
    'qr-user',
  );
  expect(screen.getByPlaceholderText('Password')).toHaveProp(
    'value',
    'qr-secret',
  );
  fireEvent.changeText(
    screen.getByPlaceholderText('Profile name'),
    ' QR fieldwork ',
  );
  addFromEditor(screen);
  await waitFor(() =>
    expect(profileRegistry.add).toHaveBeenCalledWith('QR fieldwork', {
      serverUrl: 'https://new.example',
      username: 'qr-user',
    }),
  );
  expect(setCredentialsForProfile).toHaveBeenCalledWith(
    'three',
    'qr-user',
    'qr-secret',
  );
  expect(
    jest.mocked(setCredentialsForProfile).mock.invocationCallOrder[0],
  ).toBeLessThan(jest.mocked(switchProfile).mock.invocationCallOrder[0]);
  expect(mockProfiles[0].serverUrl).toBe('https://one.example');
  expect(deleteProfile).not.toHaveBeenCalled();
  expect(switchProfile).toHaveBeenCalledWith('three');
  await waitFor(() =>
    expect(screen.getByPlaceholderText('Password')).toHaveProp(
      'value',
      'qr-secret',
    ),
  );
});

test('QR keychain failure keeps the created profile but never switches or stores plaintext credentials', async () => {
  jest.mocked(QRSettingsService.processQRCode).mockResolvedValueOnce({
    serverUrl: 'https://new.example',
    username: 'qr-user',
    password: 'qr-secret',
  });
  jest
    .mocked(setCredentialsForProfile)
    .mockRejectedValueOnce(new Error('secret native error'));
  const screen = await setup();
  await openQRCreation(screen);
  fireEvent.changeText(
    screen.getByPlaceholderText('Profile name'),
    'QR fieldwork',
  );
  addFromEditor(screen);
  await waitFor(() =>
    expect(ToastService.showLong).toHaveBeenCalledWith(
      expect.stringContaining('saved securely'),
    ),
  );
  expect(profileRegistry.add).toHaveBeenCalledWith('QR fieldwork', {
    serverUrl: 'https://new.example',
    username: 'qr-user',
  });
  expect(switchProfile).not.toHaveBeenCalled();
  expect(mockActive.id).toBe('one');
  expect(JSON.stringify(mockProfiles)).not.toContain('qr-secret');
});

test('rejected QR switch leaves the old profile selected and explains that adding again is unnecessary', async () => {
  jest.mocked(QRSettingsService.processQRCode).mockResolvedValueOnce({
    serverUrl: 'https://new.example',
    username: 'qr-user',
    password: 'qr-secret',
  });
  jest.mocked(switchProfile).mockRejectedValueOnce(new Error('busy'));
  const screen = await setup();
  await openQRCreation(screen);
  fireEvent.changeText(
    screen.getByPlaceholderText('Profile name'),
    'QR fieldwork',
  );
  addFromEditor(screen);
  await waitFor(() =>
    expect(ToastService.showLong).toHaveBeenCalledWith(
      expect.stringContaining('Do not add it again'),
    ),
  );
  expect(mockActive.id).toBe('one');
});

test('dropdown radio options appear only after expanding and Cancel leaves the active profile unchanged', async () => {
  const screen = await setup();
  expect(screen.getByRole('button', { name: 'Choose profile' })).toHaveProp(
    'accessibilityState',
    { expanded: false, disabled: false },
  );
  expect(
    screen.queryByRole('radio', { name: 'Use profile Second' }),
  ).toBeNull();
  openProfiles(screen);
  expect(screen.getByRole('radio', { name: 'Use profile First' })).toHaveProp(
    'accessibilityState',
    { checked: true, disabled: false },
  );
  fireEvent.press(screen.getByRole('radio', { name: 'Use profile Second' }));
  expect(mockConfirm.mock.lastCall![0].title).toBe('Switch profile?');
  expect(mockConfirm.mock.lastCall![0].message).toContain('Second');
  expect(
    mockConfirm.mock.lastCall![0].buttons.map(
      (button: { text: string }) => button.text,
    ),
  ).toEqual(['Cancel', 'OK']);
  expect(switchProfile).not.toHaveBeenCalled();
  cancel();
  expect(switchProfile).not.toHaveBeenCalled();
  expect(mockActive.id).toBe('one');
  expect(screen.queryByRole('radio')).toBeNull();
});

test('confirming a dropdown selection switches to the chosen profile', async () => {
  const screen = await setup();
  openProfiles(screen);
  fireEvent.press(screen.getByRole('radio', { name: 'Use profile Second' }));
  expect(switchProfile).not.toHaveBeenCalled();
  await confirm();
  await waitFor(() => expect(switchProfile).toHaveBeenCalledWith('two'));
  expect(mockActive.id).toBe('two');
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Scan QR' })).not.toBeDisabled(),
  );
  expect(screen.getByRole('button', { name: 'Choose profile' })).toBeTruthy();
});

test('rejects switching during sync or an open form and retains the active selection', async () => {
  jest
    .mocked(switchProfile)
    .mockRejectedValueOnce(new Error('sensitive internal state'));
  const screen = await setup();
  openProfiles(screen);
  fireEvent.press(screen.getByRole('radio', { name: 'Use profile Second' }));
  await confirm();
  await waitFor(() =>
    expect(ToastService.showLong).toHaveBeenCalledWith(
      expect.stringContaining('Close any open form'),
    ),
  );
  expect(screen.getByRole('button', { name: 'Choose profile' })).toHaveProp(
    'accessibilityState',
    { expanded: false, disabled: false },
  );
  expect(mockActive.id).toBe('one');
  expect(mockNavigate).not.toHaveBeenCalled();
});

test('new-profile panel requires a name and Cancel abandons manual entry', async () => {
  const screen = await setup();
  fireEvent.press(screen.getByRole('button', { name: 'Add profile' }));
  expect(
    screen.getAllByRole('button', { name: 'Add profile' })[1],
  ).toBeDisabled();
  fireEvent.changeText(screen.getByPlaceholderText('Profile name'), '   ');
  expect(
    screen.getAllByRole('button', { name: 'Add profile' })[1],
  ).toBeDisabled();
  fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByPlaceholderText('Profile name')).toBeNull();
  expect(profileRegistry.add).not.toHaveBeenCalled();
});

test('creation QR fills manual fields without saving until a name is entered', async () => {
  jest.mocked(QRSettingsService.processQRCode).mockResolvedValueOnce({
    serverUrl: 'https://scanned.example',
    username: 'scan-user',
    password: 'scan-secret',
  });
  const screen = await setup();
  fireEvent.press(screen.getByRole('button', { name: 'Add profile' }));
  fireEvent.changeText(
    screen.getByPlaceholderText('Profile name'),
    ' Fieldwork ',
  );
  await scan();
  expect(mockConfirm).not.toHaveBeenCalled();
  expect(profileRegistry.add).not.toHaveBeenCalled();
  expect(screen.getByPlaceholderText('Profile name')).toHaveProp(
    'value',
    ' Fieldwork ',
  );
  expect(screen.getByPlaceholderText('Server URL')).toHaveProp(
    'value',
    'https://scanned.example',
  );
  expect(screen.getByPlaceholderText('Username')).toHaveProp(
    'value',
    'scan-user',
  );
  expect(screen.getByPlaceholderText('Password')).toHaveProp(
    'value',
    'scan-secret',
  );
  addFromEditor(screen);
  await waitFor(() =>
    expect(profileRegistry.add).toHaveBeenCalledWith('Fieldwork', {
      serverUrl: 'https://scanned.example',
      username: 'scan-user',
    }),
  );
  expect(setCredentialsForProfile).toHaveBeenCalledWith(
    'three',
    'scan-user',
    'scan-secret',
  );
  expect(
    jest.mocked(setCredentialsForProfile).mock.invocationCallOrder[0],
  ).toBeLessThan(jest.mocked(switchProfile).mock.invocationCallOrder[0]);
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Scan QR' })).not.toBeDisabled(),
  );
});

test('failed registry add does not save credentials or switch profiles', async () => {
  jest
    .mocked(profileRegistry.add)
    .mockRejectedValueOnce(new Error('internal add failure'));
  const screen = await setup();
  fireEvent.press(screen.getByRole('button', { name: 'Add profile' }));
  fireEvent.changeText(
    screen.getByPlaceholderText('Profile name'),
    ' Fieldwork ',
  );
  addFromEditor(screen);
  await waitFor(() =>
    expect(ToastService.showLong).toHaveBeenCalledWith(
      expect.stringContaining('Could not add the profile'),
    ),
  );
  expect(profileRegistry.add).toHaveBeenCalledWith('Fieldwork', {
    serverUrl: '',
    username: '',
  });
  expect(setCredentialsForProfile).not.toHaveBeenCalled();
  expect(switchProfile).not.toHaveBeenCalled();
  expect(mockActive.id).toBe('one');
});

test('a false keychain save result blocks switching to a scanned profile', async () => {
  jest.mocked(QRSettingsService.processQRCode).mockResolvedValueOnce({
    serverUrl: 'https://new.example',
    username: 'qr-user',
    password: 'qr-secret',
  });
  jest.mocked(setCredentialsForProfile).mockResolvedValueOnce(false);
  const screen = await setup();
  await openQRCreation(screen);
  fireEvent.changeText(
    screen.getByPlaceholderText('Profile name'),
    'QR fieldwork',
  );
  addFromEditor(screen);
  await waitFor(() =>
    expect(ToastService.showLong).toHaveBeenCalledWith(
      expect.stringContaining('saved securely'),
    ),
  );
  expect(switchProfile).not.toHaveBeenCalled();
  expect(mockActive.id).toBe('one');
  expect(JSON.stringify(mockProfiles)).not.toContain('qr-secret');
});

test('does not attach a password to a profile without a server URL and username', async () => {
  const screen = await setup();
  fireEvent.press(screen.getByRole('button', { name: 'Add profile' }));
  fireEvent.changeText(
    screen.getByPlaceholderText('Profile name'),
    'Fieldwork',
  );
  fireEvent.changeText(screen.getByPlaceholderText('Password'), 'secret');
  addFromEditor(screen);
  await waitFor(() =>
    expect(ToastService.showLong).toHaveBeenCalledWith(
      expect.stringContaining('Enter a server URL and username'),
    ),
  );
  expect(profileRegistry.add).not.toHaveBeenCalled();
  expect(setCredentialsForProfile).not.toHaveBeenCalled();
});

test('can rename and delete an inactive profile from the dropdown', async () => {
  const screen = await setup();
  openProfiles(screen);
  fireEvent.press(
    screen.getByRole('button', { name: 'Rename profile Second' }),
  );
  fireEvent.changeText(screen.getByPlaceholderText('Profile name'), 'Away');
  fireEvent.press(screen.getByRole('button', { name: 'Save name' }));
  await waitFor(() =>
    expect(profileRegistry.rename).toHaveBeenCalledWith('two', 'Away'),
  );
  expect(mockActive.id).toBe('one');
  openProfiles(screen);
  fireEvent.press(screen.getByRole('button', { name: 'Delete profile Away' }));
  expect(deleteProfile).not.toHaveBeenCalled();
  await confirm();
  await waitFor(() => expect(deleteProfile).toHaveBeenCalledWith('two'));
  expect(mockActive.id).toBe('one');
});

test('adds a named profile via manual connection and renames the active profile', async () => {
  const screen = await setup();
  fireEvent.press(screen.getByRole('button', { name: 'Add profile' }));
  expect(
    screen.getByText(
      'Make sure to only connect to trusted Synkronus servers. Custom app code may access data from other profiles on this device!',
    ),
  ).toBeTruthy();
  expect(screen.getByRole('alert')).toBeTruthy();
  expect(
    screen
      .UNSAFE_getAllByType('Icon')
      .some(icon => icon.props.name === 'alert-circle-outline'),
  ).toBe(true);
  expect(
    screen
      .UNSAFE_getAllByType('TextInput')
      .map(input => input.props.placeholder),
  ).toEqual(['Profile name', 'Server URL', 'Username', 'Password']);
  expect(screen.getByPlaceholderText('Profile name')).toHaveProp(
    'required',
    true,
  );
  expect(screen.getByRole('button', { name: 'Scan QR' })).toBeTruthy();
  expect(
    screen
      .UNSAFE_getAllByType('Icon')
      .some(icon => icon.props.name === 'qrcode-scan'),
  ).toBe(true);
  fireEvent.changeText(
    screen.getByPlaceholderText('Profile name'),
    ' Fieldwork ',
  );
  fireEvent.changeText(
    screen.getByPlaceholderText('Server URL'),
    'New.Example/',
  );
  fireEvent.changeText(screen.getByPlaceholderText('Username'), ' user ');
  addFromEditor(screen);
  await waitFor(() =>
    expect(profileRegistry.add).toHaveBeenCalledWith('Fieldwork', {
      serverUrl: 'https://new.example',
      username: 'user',
    }),
  );
  await waitFor(() => expect(switchProfile).toHaveBeenCalledWith('three'));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Scan QR' })).not.toBeDisabled(),
  );
  expect(mockActive.label).toBe('Fieldwork');
  fireEvent.press(
    screen.getByRole('button', { name: 'Rename profile Fieldwork' }),
  );
  fireEvent.changeText(screen.getByPlaceholderText('Profile name'), 'Renamed');
  fireEvent.press(screen.getByRole('button', { name: 'Save name' }));
  await waitFor(() => expect(mockActive.label).toBe('Renamed'));
  expect(profileRegistry.rename).toHaveBeenCalledWith('three', 'Renamed');
});

test('deleting the active profile asks for confirmation and uses the central fallback', async () => {
  const screen = await setup();
  fireEvent.press(screen.getByRole('button', { name: 'Delete profile First' }));
  expect(deleteProfile).not.toHaveBeenCalled();
  expect(mockConfirm.mock.calls[0][0].message).toContain(
    'Unsynced data will be lost',
  );
  expect(mockConfirm.mock.calls[0][0].message).toContain(
    'the next time you fully close and reopen Formulus',
  );
  expect(mockConfirm.mock.calls[0][0].message).toContain('uninstall Formulus');
  await confirm();
  await waitFor(() => expect(mockActive.id).toBe('two'));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Scan QR' })).not.toBeDisabled(),
  );
  expect(screen.getByRole('button', { name: 'Choose profile' })).toBeTruthy();
  expect(deleteProfile).toHaveBeenCalledWith('one');
});

test('disables deletion of the last profile', async () => {
  mockProfiles = [mockActive];
  const screen = await setup();
  expect(
    screen.getByRole('button', { name: 'Delete profile First' }),
  ).toBeDisabled();
});

test('never copies a late keychain result from a previous profile into the new profile', async () => {
  let resolveOld: (value: any) => void = () => {};
  jest.mocked(loadSettingsHydrationFromStorage).mockImplementationOnce(
    () =>
      new Promise(resolve => {
        resolveOld = resolve;
      }),
  );
  const screen = render(<ProfilesScreen />);
  openProfiles(screen);
  fireEvent.press(screen.getByRole('radio', { name: 'Use profile Second' }));
  await confirm();
  await waitFor(() =>
    expect(screen.getByPlaceholderText('Username')).toHaveProp(
      'editable',
      true,
    ),
  );
  await act(async () =>
    resolveOld({
      ready: true,
      credentials: { username: 'old-user', password: 'old-secret' },
    }),
  );
  expect(screen.getByPlaceholderText('Password')).toHaveProp('value', '');
  expect(screen.getByPlaceholderText('Username')).toHaveProp('value', '');
});
