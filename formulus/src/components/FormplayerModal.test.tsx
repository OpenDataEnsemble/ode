import React from 'react';
import { act, render } from '@testing-library/react-native';
import FormplayerModal, { FormplayerModalHandle } from './FormplayerModal';
import { FormSpec } from '../services/FormService';
import { createFormulusMessageHandlers } from '../webview/FormulusMessageHandlers';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(), setItem: jest.fn() },
}));
jest.mock('../diagnostics/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn() },
  persistWebViewConsole: jest.fn(),
  webViewTag: jest.fn(),
}));
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  const primitives = new Set([
    'Text',
    'View',
    'TouchableOpacity',
    'Modal',
    'ActivityIndicator',
  ]);
  return new Proxy(native, {
    get(target, key) {
      return primitives.has(String(key))
        ? String(key)
        : Reflect.get(target, key);
    },
  });
});
jest.mock('../profiles/ProfileActivity', () => ({
  profileActivity: jest
    .requireActual('../services/testUtils/profileMocks')
    .createProfileActivityMock(),
}));
jest.mock('../profiles/ProfileRuntime', () => ({
  getActiveProfile: () => ({ id: 'test' }),
}));
jest.mock('../profiles/ProfilePaths', () =>
  jest
    .requireActual('../services/testUtils/profileMocks')
    .createProfilePathsMock('/test'),
);
jest.mock('../profiles/ProfileStorage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(), setItem: jest.fn() },
}));
jest.mock('../database', () => ({
  databaseService: {
    getLocalRepo: () => ({
      saveObservation: mockSave,
      updateObservation: mockUpdate,
    }),
  },
}));
jest.mock('../database/DatabaseService', () => ({
  databaseService: {
    getLocalRepo: () => ({
      saveObservation: mockSave,
      updateObservation: mockUpdate,
    }),
  },
}));
jest.mock('../services', () => ({ FormService: { getInstance: jest.fn() } }));
jest.mock('../services/FormService', () => ({
  FormService: { getInstance: jest.fn() },
}));
jest.mock('../services/ExtensionService', () => ({
  ExtensionService: {
    getInstance: () => ({
      getCustomAppExtensions: async () => ({ functions: {}, renderers: {} }),
    }),
  },
}));
jest.mock('../services/GeolocationService', () => ({
  geolocationService: {
    beginObservationSession: jest.fn(),
    endObservationSession: jest.fn(),
  },
  GeolocationService: { getInstance: () => ({}) },
}));
jest.mock('../services/SyncService', () => ({ SyncService: {} }));
jest.mock('../services/ServerConfigService', () => ({
  ServerConfigService: {},
}));
jest.mock('../services/SequenceCounterService', () => ({
  sequenceCounterService: {},
}));
jest.mock('../services/QrcodeRequestCoordinator', () => ({
  qrcodeRequestCoordinator: {},
}));
jest.mock('../api/synkronus/Auth', () => ({ getUserInfo: jest.fn() }));
jest.mock('../services/LocaleSettingsService', () => ({
  localeSettingsService: { resolveActiveLocale: async () => 'en' },
}));
jest.mock('../services/FormLocaleSettingsService', () => ({
  formLocaleSettingsService: { resolveActiveFormLocale: async () => 'default' },
}));
jest.mock('../contexts/AppThemeContext', () => ({
  useAppTheme: () => ({ themeColors: {}, resolvedMode: 'light' }),
}));
jest.mock('../contexts/ConfirmModalContext', () => ({
  useConfirmModal: () => ({ showConfirm: mockConfirm }),
}));
jest.mock('../hooks/useScreenShellStyle', () => ({
  useScreenShellStyle: () => ({}),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@react-native-vector-icons/material-icons', () => 'Icon');
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: 'SafeAreaView',
}));
jest.mock('react-native-permissions', () => ({ PERMISSIONS: {}, RESULTS: {} }));
jest.mock('react-native-image-picker', () => ({}));
jest.mock('@react-native-documents/picker', () => ({}));
jest.mock('react-native-webview', () => ({}));
jest.mock('react-native-fs', () => ({
  exists: jest.fn(async () => false),
  mkdir: jest.fn(),
  MainBundlePath: '/app',
  DocumentDirectoryPath: '/docs',
}));
jest.mock('./CustomAppWebView', () => {
  const react = jest.requireActual<typeof import('react')>('react');
  return {
    __esModule: true,
    default: react.forwardRef((_props: unknown, ref) => {
      react.useImperativeHandle(ref, () => ({ sendFormInit: mockInit }));
      return null;
    }),
  };
});

const mockSave = jest.fn(async () => 'new-id');
const mockUpdate = jest.fn(async () => true);
const mockConfirm = jest.fn();
const mockInit = jest.fn(async () => {});

beforeEach(() => jest.clearAllMocks());

test.each([false, true])(
  'real modal -> bridge -> attachment persistence captures opening version (edit=%s)',
  async edit => {
    const ref = React.createRef<FormplayerModalHandle>();
    const screen = render(
      <FormplayerModal visible ref={ref} onClose={jest.fn()} />,
    );
    const spec: FormSpec = {
      id: 'person',
      name: 'Person',
      description: '',
      schemaVersion: '2',
      schema: { type: 'object' },
      uiSchema: {},
    };
    await act(async () => {
      await ref.current!.initializeForm(
        spec,
        null,
        edit ? 'existing' : null,
        null,
        null,
      );
    });
    expect(mockInit).toHaveBeenCalledWith(
      expect.objectContaining({ formType: 'person' }),
    );
    // Mutating the available spec must not change the opened session's snapshot.
    spec.schemaVersion = '3';
    await act(async () => {
      const handlers = createFormulusMessageHandlers();
      if (edit)
        await handlers.onUpdateObservation({
          formType: 'person',
          observationId: 'existing',
          finalData: { name: 'Edited' },
        });
      else
        await handlers.onSubmitObservation({
          formType: 'person',
          finalData: { name: 'New' },
          formVersion: 'untrusted',
        } as never);
    });
    if (edit) {
      expect(mockUpdate).toHaveBeenCalledWith({
        observationId: 'existing',
        data: { name: 'Edited' },
      });
      expect(mockSave).not.toHaveBeenCalled();
    } else {
      expect(mockSave).toHaveBeenCalledWith({
        formType: 'person',
        formVersion: '2',
        data: { name: 'New' },
      });
      expect(mockUpdate).not.toHaveBeenCalled();
    }
    screen.unmount();
  },
);
