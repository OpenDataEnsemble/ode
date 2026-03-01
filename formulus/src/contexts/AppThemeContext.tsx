/**
 * AppThemeContext
 *
 * React context that provides the custom app's theme colors to every
 * component in the tree.  It loads the `app.config.json` from the custom
 * app bundle at startup and re-loads whenever the bundle is updated.
 *
 * Usage:
 *   // Wrap the app root:
 *   <AppThemeProvider>
 *     <NavigationContainer>…</NavigationContainer>
 *   </AppThemeProvider>
 *
 *   // Consume in any component:
 *   const { themeColors, reloadTheme } = useAppTheme();
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppConfigService from '../services/AppConfigService';
import { ThemeColors } from '../types/AppConfig';

// ── Context shape ──────────────────────────────────────────────────────

export type ThemeMode = 'system' | 'light' | 'dark';

interface AppThemeContextValue {
  /** Resolved theme colors for the current color scheme (light / dark). */
  themeColors: ThemeColors;
  /** Whether the initial config load has completed. */
  isReady: boolean;
  /** Force-reload the config (e.g. after a new app bundle is extracted). */
  reloadTheme: () => Promise<void>;
  /** Current theme mode selection (system / light / dark). */
  themeMode: ThemeMode;
  /** Update the theme mode selection. */
  setThemeMode: (mode: ThemeMode) => void;
  /** Resolved light/dark mode after applying themeMode override. */
  resolvedMode: 'light' | 'dark';
}

const AppThemeContext = createContext<AppThemeContextValue | undefined>(
  undefined,
);

// ── Provider ───────────────────────────────────────────────────────────

interface AppThemeProviderProps {
  children: React.ReactNode;
}

export const AppThemeProvider: React.FC<AppThemeProviderProps> = ({
  children,
}) => {
  const colorScheme = useColorScheme();
  const systemMode = colorScheme === 'dark' ? 'dark' : 'light';

  // A counter that bumps every time the config is (re-)loaded so that
  // consumers re-derive themeColors even though the object reference
  // inside AppConfigService changed.
  const [configVersion, setConfigVersion] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');

  const THEME_MODE_STORAGE_KEY = 'formulus-theme-mode';

  // Initial config load on mount.
  useEffect(() => {
    (async () => {
      try {
        // Load remote app theme config
        await AppConfigService.getInstance().loadConfig();
        // Load persisted theme mode override
        const storedMode = (await AsyncStorage.getItem(
          THEME_MODE_STORAGE_KEY,
        )) as ThemeMode | null;
        if (
          storedMode === 'light' ||
          storedMode === 'dark' ||
          storedMode === 'system'
        ) {
          setThemeModeState(storedMode);
        }
      } catch (err) {
        console.warn('[AppThemeProvider] Initial config load failed:', err);
      } finally {
        setConfigVersion(v => v + 1);
        setIsReady(true);
      }
    })();
  }, []);

  // Called by HomeScreen (or anyone) after a new bundle is extracted.
  const reloadTheme = useCallback(async () => {
    try {
      await AppConfigService.getInstance().loadConfig(/* force */ true);
    } catch (err) {
      console.warn('[AppThemeProvider] Config reload failed:', err);
    }
    setConfigVersion(v => v + 1);
  }, []);

  const setThemeMode = useCallback(async (mode: ThemeMode) => {
    try {
      setThemeModeState(mode);
      await AsyncStorage.setItem(THEME_MODE_STORAGE_KEY, mode);
    } catch (err) {
      console.warn('[AppThemeProvider] Failed to persist theme mode:', err);
    }
  }, []);

  const resolvedMode: 'light' | 'dark' =
    themeMode === 'system' ? systemMode : themeMode;

  // Re-derive colors whenever the color scheme changes OR the config is
  // reloaded (configVersion bumps).
  const themeColors = useMemo(() => {
    // configVersion is captured so eslint is happy — the actual value is
    // not used; it just forces recomputation.
    void configVersion;
    return AppConfigService.getInstance().getThemeColors(resolvedMode);
  }, [resolvedMode, configVersion]);

  const value = useMemo<AppThemeContextValue>(
    () => ({
      themeColors,
      isReady,
      reloadTheme,
      themeMode,
      setThemeMode,
      resolvedMode,
    }),
    [themeColors, isReady, reloadTheme, themeMode, setThemeMode, resolvedMode],
  );

  return (
    <AppThemeContext.Provider value={value}>
      {children}
    </AppThemeContext.Provider>
  );
};

// ── Hook ───────────────────────────────────────────────────────────────

/**
 * Access the custom app's resolved theme colors from any component.
 * Must be used inside an `<AppThemeProvider>`.
 */
export function useAppTheme(): AppThemeContextValue {
  const ctx = useContext(AppThemeContext);
  if (!ctx) {
    throw new Error('useAppTheme must be used within an <AppThemeProvider>');
  }
  return ctx;
}
