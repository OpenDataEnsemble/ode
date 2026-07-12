export type CustomAppDevicePresetId =
  | 'responsive'
  | 'iphone-se'
  | 'ipad-air'
  | 'android-compact-phone'
  | 'android-medium-phone'
  | 'android-large-phone'
  | 'android-small-tablet'
  | 'android-standard-tablet'
  | 'android-large-tablet';

export type CustomAppDeviceOrientation = 'portrait' | 'landscape';

/** Width × height in portrait (width is the narrow side). */
export interface CustomAppDevicePreset {
  id: CustomAppDevicePresetId;
  label: string;
  width: number;
  height: number;
}

export const CUSTOM_APP_DEVICE_PRESETS: CustomAppDevicePreset[] = [
  { id: 'responsive', label: 'Responsive (fill panel)', width: 0, height: 0 },
  { id: 'iphone-se', label: 'iPhone SE', width: 375, height: 667 },
  { id: 'ipad-air', label: 'iPad Air', width: 820, height: 1180 },
  {
    id: 'android-compact-phone',
    label: 'Compact phone 6.1″',
    width: 1080,
    height: 2340,
  },
  {
    id: 'android-medium-phone',
    label: 'Medium phone 6.5″',
    width: 1080,
    height: 2400,
  },
  {
    id: 'android-large-phone',
    label: 'Large phone 6.8″',
    width: 1440,
    height: 3120,
  },
  {
    id: 'android-small-tablet',
    label: 'Small tablet 8″',
    width: 1200,
    height: 1920,
  },
  {
    id: 'android-standard-tablet',
    label: 'Standard tablet 10″',
    width: 1200,
    height: 2000,
  },
  {
    id: 'android-large-tablet',
    label: 'Large tablet 12″',
    width: 1600,
    height: 2560,
  },
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
  'android-compact-phone-portrait': {
    id: 'android-compact-phone',
    landscape: false,
  },
  'android-compact-phone-landscape': {
    id: 'android-compact-phone',
    landscape: true,
  },
  'android-medium-phone-portrait': {
    id: 'android-medium-phone',
    landscape: false,
  },
  'android-medium-phone-landscape': {
    id: 'android-medium-phone',
    landscape: true,
  },
  'android-large-phone-portrait': {
    id: 'android-large-phone',
    landscape: false,
  },
  'android-large-phone-landscape': {
    id: 'android-large-phone',
    landscape: true,
  },
  'android-small-tablet-portrait': {
    id: 'android-small-tablet',
    landscape: false,
  },
  'android-small-tablet-landscape': {
    id: 'android-small-tablet',
    landscape: true,
  },
  'android-standard-tablet-portrait': {
    id: 'android-standard-tablet',
    landscape: false,
  },
  'android-standard-tablet-landscape': {
    id: 'android-standard-tablet',
    landscape: true,
  },
  'android-large-tablet-portrait': {
    id: 'android-large-tablet',
    landscape: false,
  },
  'android-large-tablet-landscape': {
    id: 'android-large-tablet',
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
