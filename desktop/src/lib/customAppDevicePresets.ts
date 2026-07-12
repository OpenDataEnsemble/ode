export type CustomAppDevicePresetId =
  | 'responsive'
  | 'iphone-se'
  | 'ipad-air'
  | 'android-compact-phone-high'
  | 'android-compact-phone-medium'
  | 'android-compact-phone-low'
  | 'android-medium-phone-high'
  | 'android-medium-phone-medium'
  | 'android-medium-phone-low'
  | 'android-large-phone-high'
  | 'android-large-phone-medium'
  | 'android-large-phone-low'
  | 'android-small-tablet-high'
  | 'android-small-tablet-medium'
  | 'android-small-tablet-low'
  | 'android-standard-tablet-high'
  | 'android-standard-tablet-medium'
  | 'android-standard-tablet-low'
  | 'android-large-tablet-high'
  | 'android-large-tablet-medium'
  | 'android-large-tablet-low';

export type CustomAppDeviceOrientation = 'portrait' | 'landscape';

export type AndroidDeviceDpi = 'high' | 'medium' | 'low';

/** Width × height in portrait (width is the narrow side). */
export interface CustomAppDevicePreset {
  id: CustomAppDevicePresetId;
  label: string;
  /** CSS layout viewport width (portrait). */
  width: number;
  /** CSS layout viewport height (portrait). */
  height: number;
  devicePixelRatio: number;
}

interface AndroidDeviceSize {
  key: string;
  label: string;
  width: number;
  height: number;
}

const ANDROID_DEVICE_SIZES: AndroidDeviceSize[] = [
  {
    key: 'compact-phone',
    label: 'Compact phone 6.1″',
    width: 360,
    height: 780,
  },
  {
    key: 'medium-phone',
    label: 'Medium phone 6.5″',
    width: 393,
    height: 852,
  },
  {
    key: 'large-phone',
    label: 'Large phone 6.8″',
    width: 412,
    height: 915,
  },
  {
    key: 'small-tablet',
    label: 'Small tablet 8″',
    width: 600,
    height: 960,
  },
  {
    key: 'standard-tablet',
    label: 'Standard tablet 10″',
    width: 800,
    height: 1280,
  },
  {
    key: 'large-tablet',
    label: 'Large tablet 12″',
    width: 1024,
    height: 1366,
  },
];

/** DPR tiers for the same layout size (simulates sharper vs budget panels). */
const ANDROID_DPI_TO_DPR: Record<AndroidDeviceDpi, number> = {
  low: 2,
  medium: 2.5,
  high: 3,
};

/** Large flagship phones often report slightly higher DPR than compact devices. */
const ANDROID_LARGE_PHONE_HIGH_DPR = 3.5;

export function formatDevicePixelRatioLabel(devicePixelRatio: number): string {
  const rounded = Math.round(devicePixelRatio * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${text}×`;
}

function layoutFirstLabel(
  deviceLabel: string,
  width: number,
  height: number,
  devicePixelRatio: number,
): string {
  return `${deviceLabel} · ${width}×${height} · ${formatDevicePixelRatioLabel(devicePixelRatio)}`;
}

function androidDpiDevicePixelRatio(
  sizeKey: string,
  dpi: AndroidDeviceDpi,
): number {
  if (sizeKey === 'large-phone' && dpi === 'high') {
    return ANDROID_LARGE_PHONE_HIGH_DPR;
  }
  return ANDROID_DPI_TO_DPR[dpi];
}

function buildAndroidPresets(): CustomAppDevicePreset[] {
  const presets: CustomAppDevicePreset[] = [];
  for (const size of ANDROID_DEVICE_SIZES) {
    for (const dpi of ['high', 'medium', 'low'] as const) {
      const devicePixelRatio = androidDpiDevicePixelRatio(size.key, dpi);
      presets.push({
        id: `android-${size.key}-${dpi}` as CustomAppDevicePresetId,
        label: layoutFirstLabel(
          size.label,
          size.width,
          size.height,
          devicePixelRatio,
        ),
        width: size.width,
        height: size.height,
        devicePixelRatio,
      });
    }
  }
  return presets;
}

export const CUSTOM_APP_DEVICE_PRESETS: CustomAppDevicePreset[] = [
  {
    id: 'responsive',
    label: 'Responsive (fill panel)',
    width: 0,
    height: 0,
    devicePixelRatio: 1,
  },
  {
    id: 'iphone-se',
    label: layoutFirstLabel('iPhone SE', 375, 667, 2),
    width: 375,
    height: 667,
    devicePixelRatio: 2,
  },
  {
    id: 'ipad-air',
    label: layoutFirstLabel('iPad Air', 820, 1180, 2),
    width: 820,
    height: 1180,
    devicePixelRatio: 2,
  },
  ...buildAndroidPresets(),
];

export const CUSTOM_APP_DEVICE_PRESET_STORAGE_KEY =
  'ode-desktop.custom-app-device-preset';

export const CUSTOM_APP_DEVICE_ORIENTATION_STORAGE_KEY =
  'ode-desktop.custom-app-device-orientation';

/** Maps legacy preset ids (portrait/landscape split in dropdown) to preset + orientation. */
const LEGACY_PRESET_ID_MAP: Record<
  string,
  { id: CustomAppDevicePresetId; landscape: boolean }
> = {
  'iphone-se-portrait': { id: 'iphone-se', landscape: false },
  'iphone-se-landscape': { id: 'iphone-se', landscape: true },
  'ipad-air-portrait': { id: 'ipad-air', landscape: false },
  'ipad-air-landscape': { id: 'ipad-air', landscape: true },
  'android-compact-phone': {
    id: 'android-compact-phone-high',
    landscape: false,
  },
  'android-compact-phone-portrait': {
    id: 'android-compact-phone-high',
    landscape: false,
  },
  'android-compact-phone-landscape': {
    id: 'android-compact-phone-high',
    landscape: true,
  },
  'android-medium-phone': {
    id: 'android-medium-phone-high',
    landscape: false,
  },
  'android-medium-phone-portrait': {
    id: 'android-medium-phone-high',
    landscape: false,
  },
  'android-medium-phone-landscape': {
    id: 'android-medium-phone-high',
    landscape: true,
  },
  'android-large-phone': {
    id: 'android-large-phone-high',
    landscape: false,
  },
  'android-large-phone-portrait': {
    id: 'android-large-phone-high',
    landscape: false,
  },
  'android-large-phone-landscape': {
    id: 'android-large-phone-high',
    landscape: true,
  },
  'android-small-tablet': {
    id: 'android-small-tablet-high',
    landscape: false,
  },
  'android-small-tablet-portrait': {
    id: 'android-small-tablet-high',
    landscape: false,
  },
  'android-small-tablet-landscape': {
    id: 'android-small-tablet-high',
    landscape: true,
  },
  'android-standard-tablet': {
    id: 'android-standard-tablet-high',
    landscape: false,
  },
  'android-standard-tablet-portrait': {
    id: 'android-standard-tablet-high',
    landscape: false,
  },
  'android-standard-tablet-landscape': {
    id: 'android-standard-tablet-high',
    landscape: true,
  },
  'android-large-tablet': {
    id: 'android-large-tablet-high',
    landscape: false,
  },
  'android-large-tablet-portrait': {
    id: 'android-large-tablet-high',
    landscape: false,
  },
  'android-large-tablet-landscape': {
    id: 'android-large-tablet-high',
    landscape: true,
  },
};

export function getCustomAppDevicePreset(
  id: CustomAppDevicePresetId,
): CustomAppDevicePreset {
  return (
    CUSTOM_APP_DEVICE_PRESETS.find(p => p.id === id) ??
    CUSTOM_APP_DEVICE_PRESETS[0]
  );
}

export function isResponsiveDevicePreset(
  preset: CustomAppDevicePreset,
): boolean {
  return preset.id === 'responsive' || preset.width <= 0 || preset.height <= 0;
}

export function resolveDeviceDimensions(
  preset: CustomAppDevicePreset,
  landscape: boolean,
): { width: number; height: number } {
  if (landscape) {
    return { width: preset.height, height: preset.width };
  }
  return { width: preset.width, height: preset.height };
}

export function resolveDevicePixelRatio(preset: CustomAppDevicePreset): number {
  if (isResponsiveDevicePreset(preset)) {
    return 1;
  }
  return preset.devicePixelRatio > 0 ? preset.devicePixelRatio : 1;
}

/** Scale device frame to fit container while preserving aspect ratio. */
export function computeDeviceFitScale(
  containerWidth: number,
  containerHeight: number,
  deviceWidth: number,
  deviceHeight: number,
  padding = 24,
): number {
  const availW = Math.max(0, containerWidth - padding * 2);
  const availH = Math.max(0, containerHeight - padding * 2);
  if (availW <= 0 || availH <= 0 || deviceWidth <= 0 || deviceHeight <= 0) {
    return 1;
  }
  return Math.min(availW / deviceWidth, availH / deviceHeight);
}

export interface StoredCustomAppDeviceViewport {
  presetId: CustomAppDevicePresetId;
  landscape: boolean;
}

export function loadStoredDeviceViewport(): StoredCustomAppDeviceViewport {
  try {
    const rawPreset = localStorage.getItem(
      CUSTOM_APP_DEVICE_PRESET_STORAGE_KEY,
    );
    if (rawPreset) {
      const legacy = LEGACY_PRESET_ID_MAP[rawPreset];
      if (legacy) {
        return { presetId: legacy.id, landscape: legacy.landscape };
      }
      if (CUSTOM_APP_DEVICE_PRESETS.some(p => p.id === rawPreset)) {
        const rawOrientation = localStorage.getItem(
          CUSTOM_APP_DEVICE_ORIENTATION_STORAGE_KEY,
        );
        const landscape = rawOrientation === 'landscape';
        return {
          presetId: rawPreset as CustomAppDevicePresetId,
          landscape,
        };
      }
    }
  } catch {
    /* ignore */
  }
  return { presetId: 'responsive', landscape: false };
}

export function storeDeviceViewport(
  presetId: CustomAppDevicePresetId,
  landscape: boolean,
): void {
  try {
    localStorage.setItem(CUSTOM_APP_DEVICE_PRESET_STORAGE_KEY, presetId);
    localStorage.setItem(
      CUSTOM_APP_DEVICE_ORIENTATION_STORAGE_KEY,
      landscape ? 'landscape' : 'portrait',
    );
  } catch {
    /* ignore */
  }
}

/** @deprecated Use {@link loadStoredDeviceViewport} */
export function loadStoredDevicePresetId(): CustomAppDevicePresetId {
  return loadStoredDeviceViewport().presetId;
}

/** @deprecated Use {@link storeDeviceViewport} */
export function storeDevicePresetId(id: CustomAppDevicePresetId): void {
  storeDeviceViewport(id, false);
}
