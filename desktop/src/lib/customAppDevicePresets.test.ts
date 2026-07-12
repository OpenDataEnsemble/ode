import { describe, expect, it } from 'vitest';
import {
  computeDeviceFitScale,
  getCustomAppDevicePreset,
  loadStoredDeviceViewport,
  resolveDeviceDimensions,
} from './customAppDevicePresets';

describe('computeDeviceFitScale', () => {
  it('returns 1 when container is smaller than padding', () => {
    expect(computeDeviceFitScale(10, 10, 390, 844)).toBe(1);
  });

  it('scales down when device is larger than container', () => {
    const scale = computeDeviceFitScale(400, 800, 390, 844, 24);
    expect(scale).toBeLessThan(1);
    expect(scale).toBeCloseTo(752 / 844, 3);
  });

  it('scales up when device is smaller than container', () => {
    const scale = computeDeviceFitScale(1200, 900, 375, 667, 24);
    expect(scale).toBeGreaterThan(1);
    expect(scale).toBeCloseTo(852 / 667, 3);
  });
});

describe('resolveDeviceDimensions', () => {
  it('keeps portrait dimensions when landscape is false', () => {
    const preset = getCustomAppDevicePreset('android-compact-phone');
    expect(resolveDeviceDimensions(preset, false)).toEqual({
      width: 1080,
      height: 2340,
    });
  });

  it('swaps dimensions in landscape', () => {
    const preset = getCustomAppDevicePreset('android-small-tablet');
    expect(resolveDeviceDimensions(preset, false)).toEqual({
      width: 1200,
      height: 1920,
    });
    expect(resolveDeviceDimensions(preset, true)).toEqual({
      width: 1920,
      height: 1200,
    });
  });
});

describe('loadStoredDeviceViewport', () => {
  it('migrates legacy landscape preset ids', () => {
    localStorage.setItem(
      'ode-desktop.custom-app-device-preset',
      'android-medium-phone-landscape',
    );
    expect(loadStoredDeviceViewport()).toEqual({
      presetId: 'android-medium-phone',
      landscape: true,
    });
    localStorage.removeItem('ode-desktop.custom-app-device-preset');
  });
});
