/**
 * AppConfigService
 *
 * Singleton service that reads, parses, and caches the custom app's
 * `app.config.json` file. Other native components (tab bar, headers,
 * FormplayerModal) use this service to retrieve the custom app's theme
 * colors so that the entire UI matches the brand.
 *
 * Usage:
 *   const service = AppConfigService.getInstance();
 *   await service.loadConfig();            // call once at startup
 *   const colors = service.getThemeColors('light');
 */

import RNFS from 'react-native-fs';
import { AppConfig, ThemeColors } from '../types/AppConfig';
import { colors as odeColors } from '../theme/colors';

/** Path where the custom app bundle is extracted on the device. */
const APP_CONFIG_PATH = `${RNFS.DocumentDirectoryPath}/app/app.config.json`;

/**
 * Build a fallback ThemeColors object from the ODE design tokens.
 * Used when no custom app config is available so that the app still
 * looks correct with the default ODE branding.
 */
function getOdeFallbackColors(mode: 'light' | 'dark'): ThemeColors {
  const isDark = mode === 'dark';
  return {
    primary: odeColors.brand.primary[500],
    primaryLight: odeColors.brand.primary[400],
    primaryDark: odeColors.brand.primary[600],
    onPrimary: odeColors.neutral.white,

    secondary: odeColors.brand.secondary[500],
    secondaryLight: odeColors.brand.secondary[400],
    secondaryDark: odeColors.brand.secondary[600],
    onSecondary: odeColors.neutral.white,

    background: isDark ? odeColors.neutral[900] : odeColors.neutral[50],
    surface: isDark ? odeColors.neutral[800] : odeColors.neutral.white,
    onBackground: isDark ? odeColors.neutral.white : odeColors.neutral[900],
    onSurface: isDark ? odeColors.neutral[300] : odeColors.neutral[600],

    error: odeColors.semantic.error[500],
    errorLight: odeColors.semantic.error[50],
    errorDark: odeColors.semantic.error[600],
    onError: odeColors.neutral.white,

    warning: odeColors.semantic.warning[500],
    success: odeColors.semantic.success[500],
    info: odeColors.semantic.info[500],

    divider: isDark ? odeColors.neutral[700] : odeColors.neutral[200],
  };
}

class AppConfigService {
  private static instance: AppConfigService;
  private config: AppConfig | null = null;
  private loaded = false;

  private constructor() {}

  /** Get the singleton instance. */
  static getInstance(): AppConfigService {
    if (!AppConfigService.instance) {
      AppConfigService.instance = new AppConfigService();
    }
    return AppConfigService.instance;
  }

  /**
   * Load and parse app.config.json from the custom app bundle.
   * Safe to call multiple times — subsequent calls are no-ops unless
   * `force` is true.
   */
  async loadConfig(force = false): Promise<void> {
    if (this.loaded && !force) {
      return;
    }

    try {
      const exists = await RNFS.exists(APP_CONFIG_PATH);
      if (!exists) {
        console.log(
          '[AppConfigService] No app.config.json found — using ODE defaults.',
        );
        this.config = null;
        this.loaded = true;
        return;
      }

      const raw = await RNFS.readFile(APP_CONFIG_PATH, 'utf8');
      const parsed: AppConfig = JSON.parse(raw);

      // Basic validation
      if (!parsed.theme?.light || !parsed.theme?.dark) {
        console.warn(
          '[AppConfigService] app.config.json is missing theme.light or theme.dark — ignoring.',
        );
        this.config = null;
      } else {
        this.config = parsed;
        console.log(
          `[AppConfigService] Loaded config for "${parsed.name}" v${parsed.version}`,
        );
      }
    } catch (err) {
      console.warn('[AppConfigService] Failed to load app.config.json:', err);
      this.config = null;
    }

    this.loaded = true;
  }

  /** Whether a custom app config has been successfully loaded. */
  hasConfig(): boolean {
    return this.config !== null;
  }

  /** Get the raw AppConfig (or null if none loaded). */
  getConfig(): AppConfig | null {
    return this.config;
  }

  /** Get the custom app name, or "Formulus" as the default. */
  getAppName(): string {
    return this.config?.name ?? 'Formulus';
  }

  /**
   * Get the theme colors for the requested mode.
   * Returns the custom app colors if available, otherwise ODE defaults.
   */
  getThemeColors(mode: 'light' | 'dark'): ThemeColors {
    if (this.config) {
      return this.config.theme[mode];
    }
    return getOdeFallbackColors(mode);
  }

  /**
   * Reset internal state (useful for testing or when a new app bundle is
   * downloaded and extracted).
   */
  reset(): void {
    this.config = null;
    this.loaded = false;
  }
}

export default AppConfigService;
