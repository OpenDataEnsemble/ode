import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import QRScannerModalImpl from './QRScannerModalImpl';
import { resetCameraReopenGate } from '../services/cameraReopenGate';

jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  const primitives = new Set([
    'Text',
    'View',
    'Pressable',
    'Modal',
    'StatusBar',
    'ActivityIndicator',
  ]);
  return new Proxy(native, {
    get(target, key) {
      if (primitives.has(String(key))) return String(key);
      return Reflect.get(target, key);
    },
  });
});

jest.mock('react-native-camera-kit-no-google', () => ({
  Camera: 'MockCamera',
  CameraType: { Back: 'back' },
}));
jest.mock('react-native-permissions', () => ({
  PERMISSIONS: { ANDROID: { CAMERA: 'camera' }, IOS: { CAMERA: 'camera' } },
  RESULTS: { GRANTED: 'granted', DENIED: 'denied' },
  check: jest.fn().mockResolvedValue('granted'),
  request: jest.fn().mockResolvedValue('granted'),
}));
jest.mock('./common/Button', () => {
  const react = jest.requireActual<typeof import('react')>('react');
  return ({ title, onPress }: { title: string; onPress: () => void }) =>
    react.createElement(
      'Pressable',
      { onPress, accessibilityLabel: title },
      react.createElement('Text', null, title),
    );
});

beforeEach(() => resetCameraReopenGate());

test('native camera errors stop scanning; retry remounts, cancel reports cancellation', async () => {
  const onResult = jest.fn();
  const onClose = jest.fn();
  const screen = render(
    <QRScannerModalImpl
      visible
      fieldId="code"
      onResult={onResult}
      onClose={onClose}
    />,
  );

  await waitFor(() =>
    expect(screen.UNSAFE_queryByType('MockCamera')).not.toBeNull(),
  );
  const camera = screen.UNSAFE_getByType('MockCamera');
  act(() => {
    camera.props.onError({ nativeEvent: { errorMessage: 'Camera in use' } });
  });
  expect(screen.getByText('Camera error: Camera in use')).toBeTruthy();
  expect(screen.UNSAFE_queryByType('MockCamera')).toBeNull();
  expect(onResult).not.toHaveBeenCalled();

  fireEvent.press(screen.getByText('Retry'));
  await waitFor(() =>
    expect(screen.UNSAFE_queryByType('MockCamera')).not.toBeNull(),
  );
  fireEvent.press(screen.getByText('Cancel'));
  expect(onResult).toHaveBeenCalledWith({
    fieldId: 'code',
    status: 'cancelled',
    message: 'QR code scanning cancelled by user',
  });
  expect(onClose).toHaveBeenCalledTimes(1);
});
