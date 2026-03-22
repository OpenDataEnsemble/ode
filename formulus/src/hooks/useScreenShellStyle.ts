import { useMemo } from 'react';
import { useAppTheme } from '../contexts/AppThemeContext';
import { colors } from '../theme/colors';

/**
 * Full-screen root style for app shells (Welcome, lists, settings, modals, etc.).
 * Solid theme background — no image decode or blur.
 */
export function useScreenShellStyle() {
  const { resolvedMode } = useAppTheme();
  return useMemo(
    () => ({
      flex: 1 as const,
      backgroundColor:
        resolvedMode === 'dark'
          ? colors.ui.screenShell.dark
          : colors.ui.screenShell.light,
    }),
    [resolvedMode],
  );
}
