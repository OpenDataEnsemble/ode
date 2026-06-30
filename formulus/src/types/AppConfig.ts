/**
 * AppConfig Types
 *
 * Defines the shape of app.config.json — the configuration file that each
 * custom app ships to declare its brand identity (colors, name, version, etc.).
 *
 * Formulus reads this file at startup and uses it to tint native UI elements
 * (tab bar, headers, modals) and to forward theme colors to the Formplayer
 * WebView so that forms match the custom app's look and feel.
 */
import { VisibleMainTab } from './NavigationTypes';

/**
 * Color tokens for a single mode (light or dark).
 *
 * These follow Material Design 3 color roles so that any component can pick
 * the right semantic color without knowing the actual hex value.
 */
export interface ThemeColors {
  /** Brand primary color */
  primary: string;
  /** Lighter variant of primary */
  primaryLight: string;
  /** Darker variant of primary */
  primaryDark: string;
  /** Text/icon color that sits on top of primary surfaces */
  onPrimary: string;

  /** Brand secondary color */
  secondary: string;
  /** Lighter variant of secondary */
  secondaryLight: string;
  /** Darker variant of secondary */
  secondaryDark: string;
  /** Text/icon color that sits on top of secondary surfaces */
  onSecondary: string;

  /** Main background color */
  background: string;
  /** Elevated surface color (cards, sheets) */
  surface: string;
  /** Text/icon color on background */
  onBackground: string;
  /** Text/icon color on surface */
  onSurface: string;

  /** Error color */
  error: string;
  /** Lighter variant of error */
  errorLight: string;
  /** Darker variant of error */
  errorDark: string;
  /** Text/icon color on error surfaces */
  onError: string;

  /** Warning color */
  warning: string;
  /** Success color */
  success: string;
  /** Info color */
  info: string;

  /** Divider / border color */
  divider: string;
}

/**
 * Theme block inside app.config.json.
 * Contains separate palettes for light and dark mode.
 */
export interface AppTheme {
  light: ThemeColors;
  dark: ThemeColors;
}

/**
 * Native navigation configuration for the Formulus tab bar.
 */
/**
 * Local-only observation index definition (from app.config.json).
 * Never synced; used for fast getObservationsByQuery filters.
 */
export interface ObservationIndexDef {
  key: string;
  /** JSON path relative to observation data, e.g. $.p_id */
  path: string;
  valueType?: 'string' | 'number';
  /** Optional form type patterns (suffix * for prefix match) */
  formTypes?: string[];
  enableExpressionIndex?: boolean;
}

export interface NavigationConfig {
  /**
   * Visible native tabs in display order.
   * Accepts string values from app.config.json and is validated at runtime.
   */
  tabs: string[];
}

/**
 * Root shape of app.config.json.
 */
export interface AppConfig {
  /** Optional JSON-schema reference (for editor auto-complete) */
  $schema?: string;
  /** Human-readable app name (e.g. "Ento", "AnthroCollect") */
  name: string;
  /** Semantic version of the custom app */
  version: string;
  /** Theme definition with light and dark palettes */
  theme: AppTheme;
  /**
   * Optional native navigation settings.
   * If omitted, Formulus shows all default native tabs.
   */
  navigation?: NavigationConfig;
  /** Local index definitions for observation queries */
  observationIndexes?: ObservationIndexDef[];
  /**
   * Default UI locale when device language is not in ODE catalogs (en, pt, fr).
   * Used when Formulus Settings language is Auto.
   */
  defaultLocale?: string;
}

// Keep this alias exported so app-config consumers can strongly type
// validated tab selections after runtime filtering.
export type { VisibleMainTab };
