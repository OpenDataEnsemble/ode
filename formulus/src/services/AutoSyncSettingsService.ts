import ProfileStorage from '../profiles/ProfileStorage';

const AUTO_SYNC_SETTINGS_KEY = '@auto_sync_settings';

export const AUTO_SYNC_INTERVALS = [
  30_000,
  2 * 60_000,
  5 * 60_000,
  15 * 60_000,
  60 * 60_000,
  24 * 60 * 60_000,
] as const;

export type AutoSyncInterval = (typeof AUTO_SYNC_INTERVALS)[number];

export type AutoSyncSettings = {
  enabled: boolean;
  intervalMs: AutoSyncInterval;
};

export const DEFAULT_AUTO_SYNC_SETTINGS: AutoSyncSettings = {
  enabled: false,
  intervalMs: 5 * 60_000,
};

const isAutoSyncInterval = (value: unknown): value is AutoSyncInterval =>
  typeof value === 'number' &&
  AUTO_SYNC_INTERVALS.some(interval => interval === value);

export async function loadAutoSyncSettings(): Promise<AutoSyncSettings> {
  const raw = await ProfileStorage.getItem(AUTO_SYNC_SETTINGS_KEY);

  if (!raw) {
    return { ...DEFAULT_AUTO_SYNC_SETTINGS };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AutoSyncSettings>;

    return {
      enabled:
        typeof parsed.enabled === 'boolean'
          ? parsed.enabled
          : DEFAULT_AUTO_SYNC_SETTINGS.enabled,
      intervalMs: isAutoSyncInterval(parsed.intervalMs)
        ? parsed.intervalMs
        : DEFAULT_AUTO_SYNC_SETTINGS.intervalMs,
    };
  } catch {
    return { ...DEFAULT_AUTO_SYNC_SETTINGS };
  }
}

export async function saveAutoSyncSettings(
  settings: AutoSyncSettings,
): Promise<void> {
  await ProfileStorage.setItem(
    AUTO_SYNC_SETTINGS_KEY,
    JSON.stringify(settings),
  );
}
