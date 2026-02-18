import {
  createTheme as muiCreateTheme,
  ThemeOptions,
} from '@mui/material/styles';
import { tokens } from './tokens-adapter';

/**
 * Material Design 3 Theme Configuration with ODE Design Tokens
 *
 * This theme implements modern Android / Material Design 3 guidelines
 * while using ODE design tokens for brand consistency:
 * - ODE brand colors (green primary #4F7F4E, gold secondary #E9B85B)
 * - Rounded corners (12dp for buttons, 4dp for text fields)
 * - Proper elevation and shadows from tokens
 * - Typography from ODE tokens
 * - Better focus states
 * - Touch targets ≥ 48dp (from tokens)
 * - Consistent spacing from tokens
 */

// Helper to parse pixel values
const parsePx = (value: string): number => {
  return parseInt(value.replace('px', ''), 10);
};

// Token-based helpers (single source: @ode/tokens)
const getDisabledOpacity = (): number =>
  parseFloat(
    (tokens as any).opacity?.['40'] ?? (tokens as any).opacity?.['50'] ?? '0.4',
  );
const _getDarkInputBackground = (): string =>
  (tokens as any).color?.theme?.['theme-dark']?.background?.elevated ??
  tokens.color.neutral[800];
const getDarkElevationShadow = (level: 'sm' | 'md' | 'lg'): string =>
  (tokens as any).shadow?.portal?.[level] ??
  (level === 'sm'
    ? `0 2px 8px rgba(0, 0, 0, ${(tokens as any).opacity?.['40'] ?? 0.4})`
    : level === 'md'
      ? `0 4px 12px rgba(0, 0, 0, ${(tokens as any).opacity?.['50'] ?? 0.5})`
      : `0 8px 24px rgba(0, 0, 0, ${(tokens as any).opacity?.['60'] ?? 0.6})`);

/**
 * Theme colors that a custom app can pass to override the default palette.
 * These arrive via `formParams.themeColors` from the Formulus native host.
 * When not provided, the Formplayer falls back to `@ode/tokens`.
 */
export interface CustomThemeColors {
  primary?: string;
  primaryLight?: string;
  primaryDark?: string;
  onPrimary?: string;

  secondary?: string;
  secondaryLight?: string;
  secondaryDark?: string;
  onSecondary?: string;

  background?: string;
  surface?: string;
  onBackground?: string;
  onSurface?: string;

  error?: string;
  errorLight?: string;
  errorDark?: string;
  onError?: string;

  warning?: string;
  success?: string;
  info?: string;

  divider?: string;
}

/**
 * Get theme options based on the mode (light or dark)
 * @param mode - 'light' or 'dark'
 * @param customColors - Optional color overrides from the custom app's theme
 * @returns ThemeOptions for Material-UI
 */
export const getThemeOptions = (
  mode: 'light' | 'dark',
  customColors?: CustomThemeColors,
): ThemeOptions => {
  const isDark = mode === 'dark';

  // Helper: use custom app color if provided, otherwise fall back to @ode/tokens.
  const c = (custom: string | undefined, fallback: string): string =>
    custom ?? fallback;

  return {
    palette: {
      mode: mode,
      primary: {
        main: c(customColors?.primary, tokens.color.brand.primary[500]),
        light: c(customColors?.primaryLight, tokens.color.brand.primary[400]),
        dark: c(customColors?.primaryDark, tokens.color.brand.primary[600]),
        contrastText: c(customColors?.onPrimary, tokens.color.neutral.white),
      },
      secondary: {
        main: c(customColors?.secondary, tokens.color.brand.secondary[500]),
        light: c(
          customColors?.secondaryLight,
          tokens.color.brand.secondary[400],
        ),
        dark: c(customColors?.secondaryDark, tokens.color.brand.secondary[600]),
        contrastText: c(customColors?.onSecondary, tokens.color.neutral.white),
      },
      error: {
        main: c(customColors?.error, tokens.color.semantic.error[500]),
        light: c(customColors?.errorLight, tokens.color.semantic.error[50]),
        dark: c(customColors?.errorDark, tokens.color.semantic.error[600]),
        contrastText: c(customColors?.onError, tokens.color.neutral.white),
      },
      warning: {
        main: c(customColors?.warning, tokens.color.semantic.warning[500]),
        light: tokens.color.semantic.warning[50],
        dark: tokens.color.semantic.warning[600],
        contrastText: tokens.color.neutral.white,
      },
      info: {
        main: c(customColors?.info, tokens.color.semantic.info[500]),
        light: tokens.color.semantic.info[50],
        dark: tokens.color.semantic.info[600],
        contrastText: tokens.color.neutral.white,
      },
      success: {
        main: c(customColors?.success, tokens.color.semantic.success[500]),
        light: tokens.color.semantic.success[50],
        dark: tokens.color.semantic.success[600],
        contrastText: tokens.color.neutral.white,
      },
      background: {
        default: c(
          customColors?.background,
          isDark ? tokens.color.neutral[900] : tokens.color.neutral[50],
        ),
        paper: c(
          customColors?.surface,
          isDark ? tokens.color.neutral[800] : tokens.color.neutral.white,
        ),
      },
      text: {
        primary: c(
          customColors?.onBackground,
          isDark ? tokens.color.neutral.white : tokens.color.neutral[900],
        ),
        secondary: c(
          customColors?.onSurface,
          isDark ? tokens.color.neutral[300] : tokens.color.neutral[600],
        ),
        disabled: isDark
          ? tokens.color.neutral[600]
          : tokens.color.neutral[400],
      },
      divider: c(
        customColors?.divider,
        isDark ? tokens.color.neutral[700] : tokens.color.neutral[200],
      ),
      grey: {
        50: tokens.color.neutral[50],
        100: tokens.color.neutral[100],
        200: tokens.color.neutral[200],
        300: tokens.color.neutral[300],
        400: tokens.color.neutral[400],
        500: tokens.color.neutral[500],
        600: tokens.color.neutral[600],
        700: tokens.color.neutral[700],
        800: tokens.color.neutral[800],
        900: tokens.color.neutral[900],
      },
    },
    typography: {
      fontFamily: tokens.typography.fontFamily.sans,
      fontSize: parsePx(tokens.typography.fontSize.base),
      h1: {
        fontSize: parsePx(tokens.typography.fontSize['5xl']),
        fontWeight: tokens.typography.fontWeight.regular,
        lineHeight: parseFloat(tokens.typography.lineHeight.tight),
        letterSpacing: tokens.typography.letterSpacing.tight,
      },
      h2: {
        fontSize: parsePx(tokens.typography.fontSize['4xl']),
        fontWeight: tokens.typography.fontWeight.regular,
        lineHeight: parseFloat(tokens.typography.lineHeight.tight),
        letterSpacing: tokens.typography.letterSpacing.tight,
      },
      h3: {
        fontSize: parsePx(tokens.typography.fontSize['3xl']),
        fontWeight: tokens.typography.fontWeight.regular,
        lineHeight: parseFloat(tokens.typography.lineHeight.tight),
      },
      h4: {
        fontSize: parsePx(tokens.typography.fontSize['2xl']),
        fontWeight: tokens.typography.fontWeight.regular,
        lineHeight: parseFloat(tokens.typography.lineHeight.tight),
      },
      h5: {
        fontSize: parsePx(tokens.typography.fontSize.xl),
        fontWeight: tokens.typography.fontWeight.medium,
        lineHeight: parseFloat(tokens.typography.lineHeight.tight),
      },
      h6: {
        fontSize: parsePx(tokens.typography.fontSize.base),
        fontWeight: tokens.typography.fontWeight.medium,
        lineHeight: parseFloat(tokens.typography.lineHeight.tight),
      },
      body1: {
        fontSize: parsePx(tokens.typography.fontSize.base),
        fontWeight: tokens.typography.fontWeight.regular,
        lineHeight: parseFloat(tokens.typography.lineHeight.normal),
        letterSpacing: tokens.typography.letterSpacing.normal,
      },
      body2: {
        fontSize: parsePx(tokens.typography.fontSize.sm),
        fontWeight: tokens.typography.fontWeight.regular,
        lineHeight: parseFloat(tokens.typography.lineHeight.normal),
        letterSpacing: tokens.typography.letterSpacing.normal,
      },
      button: {
        fontSize: parsePx(tokens.typography.fontSize.sm),
        fontWeight: tokens.typography.fontWeight.medium,
        lineHeight: 1.75,
        letterSpacing: tokens.typography.letterSpacing.wider,
        textTransform: 'none', // Material Design 3 uses lowercase buttons
      },
    },
    spacing: parsePx(tokens.spacing[1]), // Base spacing unit (4px)
    shape: {
      borderRadius: parsePx(tokens.border.radius.lg), // 12px - Material Design 3 default
    },
    components: {
      MuiFormControl: {
        styleOverrides: {
          root: {
            width: '100%',
            marginBottom: parsePx(tokens.spacing[4]),
          },
        },
      },
      // Button styling - Material Design 3 with ODE tokens
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: tokens.border.radius.full, // Fully rounded buttons (pill shape)
            padding: `${parsePx(tokens.spacing[3])}px ${parsePx(tokens.spacing[6])}px`, // 12px 24px
            minHeight: `${tokens.touchTarget.comfortable}px`, // 48px - from tokens
            fontSize: parsePx(tokens.typography.fontSize.sm),
            fontWeight: tokens.typography.fontWeight.medium,
            textTransform: 'none',
            boxShadow: 'none',
            '&:hover': {
              boxShadow: tokens.shadow.sm,
            },
            '&:active': {
              boxShadow: tokens.shadow.md,
            },
            '&:disabled': {
              opacity: getDisabledOpacity(),
              backgroundColor: isDark
                ? tokens.color.neutral[800]
                : tokens.color.neutral[300],
              color: isDark
                ? tokens.color.neutral[600]
                : tokens.color.neutral[500],
            },
          },
          contained: {
            boxShadow: tokens.shadow.sm,
            '&:hover': {
              boxShadow: tokens.shadow.md,
            },
          },
          outlined: {
            borderWidth: parsePx(tokens.border.width.thin),
            borderStyle: 'solid',
            '&:hover': {
              borderWidth: parsePx(tokens.border.width.thin),
            },
          },
          text: {
            '&:hover': {
              backgroundColor: isDark
                ? `${tokens.color.brand.primary[500]}20` // 12% opacity for dark mode
                : `${tokens.color.brand.primary[500]}14`, // 8% opacity for light mode
            },
          },
          sizeSmall: {
            minHeight: `${tokens.touchTarget.comfortable}px`, // Still maintain 48dp for accessibility
            padding: `${parsePx(tokens.spacing[3])}px ${parsePx(tokens.spacing[4])}px`,
            fontSize: parsePx(tokens.typography.fontSize.sm),
          },
          sizeLarge: {
            minHeight: `${tokens.touchTarget.large}px`, // 56px
            padding: `${parsePx(tokens.spacing[4])}px ${parsePx(tokens.spacing[8])}px`,
            fontSize: parsePx(tokens.typography.fontSize.base),
          },
        },
      },
      // TextField / Input styling - Material Design 3 with ODE tokens
      MuiTextField: {
        styleOverrides: {
          root: {
            width: '100%',
            marginBottom: parsePx(tokens.spacing[4]),
            '& .MuiOutlinedInput-root': {
              borderRadius: parsePx(tokens.border.radius.md), // 8px - match button, not too rounded
              backgroundColor: 'transparent',
              '& fieldset': {
                borderRadius: parsePx(tokens.border.radius.md), // Same as root so all sizes match
                borderColor: isDark
                  ? tokens.color.neutral[700]
                  : tokens.color.neutral[400], // Dark: #616161, Light: #BDBDBD
                borderWidth: parsePx(tokens.border.width.thin),
              },
              '&:hover fieldset': {
                borderColor: isDark
                  ? tokens.color.neutral[600]
                  : tokens.color.neutral[900], // Dark: #757575, Light: #212121
              },
              '&.Mui-focused fieldset': {
                borderColor: tokens.color.brand.primary[500],
                borderWidth: parsePx(tokens.border.width.medium), // 2px on focus
              },
              '&.Mui-error fieldset': {
                borderColor: tokens.color.semantic.error[500],
              },
              '&.Mui-disabled': {
                backgroundColor: isDark
                  ? 'transparent'
                  : tokens.color.neutral[100],
                opacity: isDark
                  ? parseFloat((tokens as any).opacity?.['50'] ?? '0.5')
                  : 1,
                '& fieldset': {
                  borderColor: isDark
                    ? tokens.color.neutral[700]
                    : tokens.color.neutral[300],
                },
              },
            },
            '& .MuiInputLabel-root': {
              color: isDark
                ? tokens.color.neutral[400]
                : tokens.color.neutral[600], // Dark: #BDBDBD, Light: #757575
              '&.Mui-focused': {
                color: tokens.color.brand.primary[500],
              },
              '&.Mui-error': {
                color: tokens.color.semantic.error[500],
              },
            },
            '& .MuiInputBase-input': {
              padding: `${parsePx(tokens.spacing[4])}px`,
              fontSize: parsePx(tokens.typography.fontSize.base),
              lineHeight: parseFloat(tokens.typography.lineHeight.normal),
              minHeight: `${tokens.touchTarget.large}px`, // 56px - Minimum touch target
              '&::placeholder': {
                color: isDark
                  ? tokens.color.neutral[500]
                  : tokens.color.neutral[400],
                opacity: 1,
              },
            },
            '& .MuiInputBase-inputMultiline': {
              padding: parsePx(tokens.spacing[4]),
              minHeight: `${tokens.touchTarget.large}px`,
            },
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: parsePx(tokens.border.radius.md), // 8px - match button (Name, Birth date, etc.)
            backgroundColor: 'transparent',
            '& fieldset': {
              borderRadius: parsePx(tokens.border.radius.md), // Force fieldset to match (fixes size="small" e.g. Birth date)
              borderColor: isDark
                ? tokens.color.neutral[700]
                : tokens.color.neutral[400],
              borderWidth: parsePx(tokens.border.width.thin),
            },
            '&:hover fieldset': {
              borderColor: isDark
                ? tokens.color.neutral[600]
                : tokens.color.neutral[900],
            },
            '&.Mui-focused fieldset': {
              borderColor: tokens.color.brand.primary[500],
              borderWidth: parsePx(tokens.border.width.medium),
            },
            '&.Mui-error fieldset': {
              borderColor: tokens.color.semantic.error[500],
            },
          },
          // Ensure size="small"
          sizeSmall: {
            borderRadius: parsePx(tokens.border.radius.md),
            '& fieldset': {
              borderRadius: parsePx(tokens.border.radius.md),
            },
          },
          input: {
            padding: parsePx(tokens.spacing[4]),
            fontSize: parsePx(tokens.typography.fontSize.base),
            lineHeight: parseFloat(tokens.typography.lineHeight.normal),
            minHeight: `${tokens.touchTarget.large}px`,
          },
        },
      },
      MuiInputBase: {
        styleOverrides: {
          root: {
            fontSize: parsePx(tokens.typography.fontSize.base),
            '&.Mui-focused': {
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: tokens.color.brand.primary[500],
                borderWidth: parsePx(tokens.border.width.medium),
              },
            },
          },
          input: {
            '&::placeholder': {
              color: isDark
                ? tokens.color.neutral[500]
                : tokens.color.neutral[400],
              opacity: 1,
            },
          },
        },
      },
      // FormControlLabel styling
      MuiFormControlLabel: {
        styleOverrides: {
          root: {
            marginLeft: 0,
            marginRight: 0,
          },
          label: {
            fontSize: parsePx(tokens.typography.fontSize.base),
            '&.Mui-disabled': {
              color: isDark
                ? tokens.color.neutral[600]
                : tokens.color.neutral[400],
            },
          },
        },
      },
      // Checkbox styling
      MuiCheckbox: {
        styleOverrides: {
          root: {
            padding: parsePx(tokens.spacing[3]),
            color: isDark
              ? tokens.color.neutral[500]
              : tokens.color.neutral[400],
            '&.Mui-checked': {
              color: tokens.color.brand.primary[500],
            },
            '&.Mui-disabled': {
              color: isDark
                ? tokens.color.neutral[700]
                : tokens.color.neutral[300],
            },
          },
        },
      },
      // Radio styling
      MuiRadio: {
        styleOverrides: {
          root: {
            padding: parsePx(tokens.spacing[3]),
            color: isDark
              ? tokens.color.neutral[500]
              : tokens.color.neutral[400],
            '&.Mui-checked': {
              color: tokens.color.brand.primary[500],
            },
            '&.Mui-disabled': {
              color: isDark
                ? tokens.color.neutral[700]
                : tokens.color.neutral[300],
            },
          },
        },
      },
      MuiRadioGroup: {
        styleOverrides: {
          root: {
            flexDirection: 'column',
          },
        },
      },
      MuiFormGroup: {
        styleOverrides: {
          root: {
            flexDirection: 'column',
          },
        },
      },
      // Switch styling
      MuiSwitch: {
        styleOverrides: {
          root: {
            width: 52,
            height: 32,
            padding: 0,
            '& .MuiSwitch-switchBase': {
              padding: 0,
              margin: 2,
              transitionDuration: '300ms',
              '&.Mui-checked': {
                transform: `translateX(${tokens.spacing?.[5] ?? '20px'})`,
                color: tokens.color.neutral.white,
                '& + .MuiSwitch-track': {
                  backgroundColor: tokens.color.brand.primary[500],
                  opacity: 1,
                  border: 0,
                },
                '&.Mui-disabled + .MuiSwitch-track': {
                  opacity: 0.5,
                },
              },
              '&.Mui-disabled .MuiSwitch-thumb': {
                color: isDark
                  ? tokens.color.neutral[700]
                  : tokens.color.neutral[200],
              },
            },
            '& .MuiSwitch-thumb': {
              boxSizing: 'border-box',
              width: 28,
              height: 28,
            },
            '& .MuiSwitch-track': {
              borderRadius: 16,
              backgroundColor: isDark
                ? tokens.color.neutral[700]
                : tokens.color.neutral[400],
              opacity: 1,
            },
          },
        },
      },
      // Select styling
      MuiSelect: {
        styleOverrides: {
          root: {
            borderRadius: parsePx(tokens.border.radius.md), // Same as text fields (8px, match button)
            minHeight: `${tokens.touchTarget.large}px`,
            '&.Mui-focused': {
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: tokens.color.brand.primary[500],
                borderWidth: parsePx(tokens.border.width.medium),
              },
            },
          },
        },
        defaultProps: {
          inputProps: {
            readOnly: true,
            inputMode: 'none',
          },
          MenuProps: {
            disableAutoFocus: true,
            disableEnforceFocus: true,
          },
        },
      },
      // Paper/Card styling for elevation
      MuiPaper: {
        styleOverrides: {
          root: {
            borderRadius: parsePx(tokens.border.radius.lg),
            backgroundColor: isDark
              ? tokens.color.neutral[900]
              : tokens.color.neutral.white, // Dark: #212121, Light: #FFFFFF
          },
          elevation1: {
            boxShadow: isDark ? getDarkElevationShadow('sm') : tokens.shadow.sm,
          },
          elevation2: {
            boxShadow: isDark ? getDarkElevationShadow('md') : tokens.shadow.md,
          },
          elevation3: {
            boxShadow: isDark ? getDarkElevationShadow('lg') : tokens.shadow.lg,
          },
        },
      },
      // Card styling
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: parsePx(tokens.border.radius.lg),
            backgroundColor: isDark
              ? tokens.color.neutral[800]
              : tokens.color.neutral.white, // Dark: #424242 (medium dark for cards), Light: #FFFFFF
            boxShadow: isDark ? getDarkElevationShadow('sm') : tokens.shadow.sm,
          },
        },
      },
      // IconButton styling
      MuiIconButton: {
        styleOverrides: {
          root: {
            padding: parsePx(tokens.spacing[3]),
            minWidth: `${tokens.touchTarget.comfortable}px`,
            minHeight: `${tokens.touchTarget.comfortable}px`,
            '&:hover': {
              backgroundColor: isDark
                ? `${tokens.color.brand.primary[500]}20` // 12% opacity for dark mode
                : `${tokens.color.brand.primary[500]}14`, // 8% opacity for light mode
            },
          },
          sizeSmall: {
            padding: parsePx(tokens.spacing[2]),
            minWidth: `${tokens.touchTarget.min}px`,
            minHeight: `${tokens.touchTarget.min}px`,
          },
        },
      },
      // Chip styling
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: parsePx(tokens.border.radius.md),
            height: '32px',
            fontSize: parsePx(tokens.typography.fontSize.sm),
          },
        },
      },
      // Alert styling
      MuiAlert: {
        styleOverrides: {
          root: {
            borderRadius: parsePx(tokens.border.radius.sm),
            backgroundColor: isDark ? tokens.color.neutral[800] : undefined, // Dark: #424242 for alerts (matches paper)
          },
        },
      },
      // Menu/Dropdown styling for dark mode
      MuiMenu: {
        styleOverrides: {
          paper: {
            backgroundColor: isDark
              ? tokens.color.neutral[800]
              : tokens.color.neutral.white, // Dark: #424242 (medium dark)
            border: isDark ? `1px solid ${tokens.color.neutral[700]}` : 'none', // Dark: #616161 border
          },
        },
      },
      MuiPopover: {
        styleOverrides: {
          paper: {
            backgroundColor: isDark
              ? tokens.color.neutral[800]
              : tokens.color.neutral.white, // Dark: #424242 (medium dark)
            border: isDark ? `1px solid ${tokens.color.neutral[700]}` : 'none', // Dark: #616161 border
          },
        },
      },
      // List styling for dark mode
      MuiList: {
        styleOverrides: {
          root: {
            backgroundColor: 'transparent', // Transparent - use parent background
            padding: 0, // Remove default padding to allow full control
          },
        },
      },
      // Divider styling - make sure it's visible in dark mode
      MuiDivider: {
        styleOverrides: {
          root: {
            borderColor: isDark
              ? tokens.color.neutral[700]
              : tokens.color.neutral[200], // Dark: #616161 (lighter gray for visibility), Light: #EEEEEE
            opacity: 1, // Ensure full opacity
          },
        },
      },
      // ListItem styling for dark mode
      MuiListItem: {
        styleOverrides: {
          root: {
            '&:hover': {
              backgroundColor: isDark
                ? tokens.color.neutral[700]
                : tokens.color.neutral[50], // Dark: #616161 on hover (lighter gray)
            },
          },
        },
      },
    },
  };
};

// Re-export createTheme from MUI for use in App.tsx
export const createTheme = muiCreateTheme;

// Create and export a default light theme for backward compatibility
export const theme = muiCreateTheme(getThemeOptions('light'));
