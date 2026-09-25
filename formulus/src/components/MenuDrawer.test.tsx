import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import MenuDrawer from './MenuDrawer';
import { getUserInfo } from '../api/synkronus/Auth';

jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  const react = jest.requireActual<typeof import('react')>('react');
  const primitives = new Set(['Text', 'View', 'ScrollView']);
  return new Proxy(native, {
    get(target, key) {
      if (key === 'TouchableOpacity') {
        return ({ children, ...props }: { children?: React.ReactNode }) =>
          react.createElement(
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

const mockActiveProfile = { id: 'one', label: 'Work' };
let mockMode = 'light';

jest.mock('../navigation/useProfiles', () => ({
  useProfiles: () => ({ activeProfile: mockActiveProfile }),
}));
jest.mock('../profiles/ProfileRuntime', () => ({
  getActiveProfile: () => mockActiveProfile,
}));
jest.mock('../api/synkronus/Auth', () => ({ getUserInfo: jest.fn() }));
jest.mock('../contexts/AppThemeContext', () => ({
  useAppTheme: () => ({
    resolvedMode: mockMode,
    themeColors: {
      primary: 'green',
      onPrimary: 'white',
      onSurface: 'light-text',
      surface: 'surface',
      divider: 'gray',
    },
  }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@react-native-vector-icons/material-design-icons', () => 'Icon');
jest.mock('react-native-svg', () => ({
  __esModule: true,
  default: 'Svg',
  Defs: 'Defs',
  LinearGradient: 'LinearGradient',
  Stop: 'Stop',
  Rect: 'Rect',
}));
jest.mock('../theme/odeDesign', () => ({
  odeSpacing: { xxs: 2, xs: 4, sm: 8, md: 16 },
  odeTypography: { body: 16, caption: 12, sectionTitle: 20 },
  odeBorderWidth: { hairline: 1 },
  odeRadius: { card: 8, inner: 4 },
}));
jest.mock('../theme/colors', () => ({
  __esModule: true,
  default: {
    neutral: {
      white: 'white',
      black: 'black',
      transparent: 'transparent',
      900: 'dark-text',
    },
    semantic: { error: { ios: 'red' }, info: { ios: 'blue' } },
    ui: { gray: { medium: 'gray', ios: 'gray' } },
  },
  withAlpha: () => 'gray',
}));
jest.mock('./common/Button', () => () => null);

const mockedGetUserInfo = jest.mocked(getUserInfo);

beforeEach(() => {
  mockMode = 'light';
  mockedGetUserInfo.mockReset();
});

test.each([
  ['light', 'dark-text'],
  ['dark', 'light-text'],
])('shows the signed-in username and role in %s mode', async (mode, color) => {
  mockMode = mode;
  const username = 'a-very-long-username-that-must-not-overlap-the-badge';
  mockedGetUserInfo.mockResolvedValue({ username, role: 'read-write' });

  const screen = render(
    <MenuDrawer
      visible
      onClose={jest.fn()}
      onNavigate={jest.fn()}
      onLogout={jest.fn()}
    />,
  );

  const name = await waitFor(() => screen.getByText(username));
  expect(name).toHaveProp('accessibilityLabel', username);
  expect(name).toHaveProp('numberOfLines', 1);
  expect(name).toHaveProp('ellipsizeMode', 'tail');
  expect(StyleSheet.flatten(name.props.style)).toMatchObject({
    color,
    alignSelf: 'stretch',
  });
  expect(screen.getByText('roles.readWrite')).toBeTruthy();
});

test('does not show a username when signed out', async () => {
  mockedGetUserInfo.mockResolvedValue(null);
  const screen = render(
    <MenuDrawer
      visible
      onClose={jest.fn()}
      onNavigate={jest.fn()}
      onLogout={jest.fn()}
    />,
  );

  await waitFor(() => expect(mockedGetUserInfo).toHaveBeenCalled());
  expect(screen.getByText('menu.notLoggedIn')).toBeTruthy();
  expect(screen.queryByText('roles.readWrite')).toBeNull();
});
