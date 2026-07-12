import { describe, expect, it } from 'vitest';
import {
  computeDeviceFitScale,
  formatDevicePixelRatioLabel,
  getCustomAppDevicePreset,
  loadStoredDeviceViewport,
  resolveDeviceDimensions,
  resolveDevicePixelRatio,
} from './customAppDevicePresets';
import { buildDevicePixelRatioInjectionScript } from './devicePixelRatioStub';

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
  it('uses layout CSS viewport for android presets', () => {
    const preset = getCustomAppDevicePreset('android-compact-phone-high');
    expect(resolveDeviceDimensions(preset, false)).toEqual({
      width: 360,
      height: 780,
    });
    expect(preset.label).toBe('Compact phone 6.1″ · 360×780 · 3×');
  });

  it('keeps layout constant across DPI tiers and varies DPR', () => {
    const high = getCustomAppDevicePreset('android-compact-phone-high');
    const medium = getCustomAppDevicePreset('android-compact-phone-medium');
    const low = getCustomAppDevicePreset('android-compact-phone-low');
    expect(resolveDeviceDimensions(medium, false)).toEqual({
      width: 360,
      height: 780,
    });
    expect(resolveDeviceDimensions(low, false)).toEqual({
      width: 360,
      height: 780,
    });
    expect(high.devicePixelRatio).toBe(3);
    expect(medium.devicePixelRatio).toBe(2.5);
    expect(low.devicePixelRatio).toBe(2);
  });

  it('uses higher DPR for large phone high tier', () => {
    const preset = getCustomAppDevicePreset('android-large-phone-high');
    expect(resolveDeviceDimensions(preset, false)).toEqual({
      width: 412,
      height: 915,
    });
    expect(preset.devicePixelRatio).toBe(3.5);
  });

  it('swaps dimensions in landscape', () => {
    const preset = getCustomAppDevicePreset('android-small-tablet-high');
    expect(resolveDeviceDimensions(preset, false)).toEqual({
      width: 600,
      height: 960,
    });
    expect(resolveDeviceDimensions(preset, true)).toEqual({
      width: 960,
      height: 600,
    });
  });
});

describe('resolveDevicePixelRatio', () => {
  it('returns 1 for responsive preset', () => {
    expect(
      resolveDevicePixelRatio(getCustomAppDevicePreset('responsive')),
    ).toBe(1);
  });

  it('returns preset DPR for fixed devices', () => {
    expect(resolveDevicePixelRatio(getCustomAppDevicePreset('iphone-se'))).toBe(
      2,
    );
  });
});

describe('formatDevicePixelRatioLabel', () => {
  it('formats integer and fractional multipliers', () => {
    expect(formatDevicePixelRatioLabel(2)).toBe('2×');
    expect(formatDevicePixelRatioLabel(2.5)).toBe('2.5×');
    expect(formatDevicePixelRatioLabel(3.5)).toBe('3.5×');
  });
});

describe('buildDevicePixelRatioInjectionScript', () => {
  it('skips injection when DPR is 1', () => {
    expect(buildDevicePixelRatioInjectionScript(1)).toBe('');
  });

  it('emits override script for non-unity DPR', () => {
    const script = buildDevicePixelRatioInjectionScript(3.5);
    expect(script).toContain('devicePixelRatio');
    expect(script).toContain('3.5');
  });
});

describe('loadStoredDeviceViewport', () => {
  it('migrates legacy landscape preset ids', () => {
    localStorage.setItem(
      'ode-desktop.custom-app-device-preset',
      'android-medium-phone-landscape',
    );
    expect(loadStoredDeviceViewport()).toEqual({
      presetId: 'android-medium-phone-high',
      landscape: true,
    });
    localStorage.removeItem('ode-desktop.custom-app-device-preset');
  });

  it('migrates legacy android preset ids without dpi suffix to high', () => {
    localStorage.setItem(
      'ode-desktop.custom-app-device-preset',
      'android-large-phone',
    );
    expect(loadStoredDeviceViewport()).toEqual({
      presetId: 'android-large-phone-high',
      landscape: false,
    });
    localStorage.removeItem('ode-desktop.custom-app-device-preset');
  });
});
