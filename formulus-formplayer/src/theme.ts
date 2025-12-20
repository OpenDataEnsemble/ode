import { createTheme, ThemeOptions } from '@mui/material/styles';
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

const themeOptions: ThemeOptions = {
  palette: {
    mode: 'light',
    primary: {
      main: tokens.color.brand.primary[500], // #4F7F4E - ODE Primary Green
      light: tokens.color.brand.primary[400],
      dark: tokens.color.brand.primary[600],
      contrastText: tokens.color.neutral.white,
    },
    secondary: {
      main: tokens.color.brand.secondary[500], // #E9B85B - ODE Secondary Gold
      light: tokens.color.brand.secondary[400],
      dark: tokens.color.brand.secondary[600],
      contrastText: tokens.color.neutral.white,
    },
    error: {
      main: tokens.color.semantic.error[500],
      light: tokens.color.semantic.error[50],
      dark: tokens.color.semantic.error[600],
      contrastText: tokens.color.neutral.white,
    },
    warning: {
      main: tokens.color.semantic.warning[500],
      light: tokens.color.semantic.warning[50],
      dark: tokens.color.semantic.warning[600],
      contrastText: tokens.color.neutral.white,
    },
    info: {
      main: tokens.color.semantic.info[500],
      light: tokens.color.semantic.info[50],
      dark: tokens.color.semantic.info[600],
      contrastText: tokens.color.neutral.white,
    },
    success: {
      main: tokens.color.semantic.success[500],
      light: tokens.color.semantic.success[50],
      dark: tokens.color.semantic.success[600],
      contrastText: tokens.color.neutral.white,
    },
    background: {
      default: tokens.color.neutral[50], // #FAFAFA
      paper: tokens.color.neutral.white,
    },
    text: {
      primary: tokens.color.neutral[900], // #212121
      secondary: tokens.color.neutral[600], // #757575
      disabled: tokens.color.neutral[400], // #BDBDBD
    },
    divider: tokens.color.neutral[200], // #EEEEEE
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
            opacity: 0.38,
            backgroundColor: tokens.color.neutral[300],
            color: tokens.color.neutral[500],
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
            backgroundColor: `${tokens.color.brand.primary[500]}14`, // 8% opacity
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
          '& .MuiOutlinedInput-root': {
            borderRadius: parsePx(tokens.border.radius.sm), // 4px - Material Design 3 text field
            backgroundColor: 'transparent',
            '& fieldset': {
              borderColor: tokens.color.neutral[400],
              borderWidth: parsePx(tokens.border.width.thin),
            },
            '&:hover fieldset': {
              borderColor: tokens.color.neutral[900],
            },
            '&.Mui-focused fieldset': {
              borderColor: tokens.color.brand.primary[500],
              borderWidth: parsePx(tokens.border.width.medium), // 2px on focus
            },
            '&.Mui-error fieldset': {
              borderColor: tokens.color.semantic.error[500],
            },
            '&.Mui-disabled': {
              backgroundColor: tokens.color.neutral[100],
              '& fieldset': {
                borderColor: tokens.color.neutral[300],
              },
            },
          },
          '& .MuiInputLabel-root': {
            color: tokens.color.neutral[600],
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
              color: tokens.color.neutral[400],
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
          borderRadius: parsePx(tokens.border.radius.sm),
          '& fieldset': {
            borderColor: tokens.color.neutral[400],
            borderWidth: parsePx(tokens.border.width.thin),
          },
          '&:hover fieldset': {
            borderColor: tokens.color.neutral[900],
          },
          '&.Mui-focused fieldset': {
            borderColor: tokens.color.brand.primary[500],
            borderWidth: parsePx(tokens.border.width.medium),
          },
          '&.Mui-error fieldset': {
            borderColor: tokens.color.semantic.error[500],
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
            color: tokens.color.neutral[400],
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
            color: tokens.color.neutral[400],
          },
        },
      },
    },
    // Checkbox styling
    MuiCheckbox: {
      styleOverrides: {
        root: {
          padding: parsePx(tokens.spacing[3]),
          color: tokens.color.neutral[400],
          '&.Mui-checked': {
            color: tokens.color.brand.primary[500],
          },
          '&.Mui-disabled': {
            color: tokens.color.neutral[300],
          },
        },
      },
    },
    // Radio styling
    MuiRadio: {
      styleOverrides: {
        root: {
          padding: parsePx(tokens.spacing[3]),
          color: tokens.color.neutral[400],
          '&.Mui-checked': {
            color: tokens.color.brand.primary[500],
          },
          '&.Mui-disabled': {
            color: tokens.color.neutral[300],
          },
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
              transform: 'translateX(20px)',
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
              color: tokens.color.neutral[200],
            },
          },
          '& .MuiSwitch-thumb': {
            boxSizing: 'border-box',
            width: 28,
            height: 28,
          },
          '& .MuiSwitch-track': {
            borderRadius: 16,
            backgroundColor: tokens.color.neutral[400],
            opacity: 1,
          },
        },
      },
    },
    // Select styling
    MuiSelect: {
      styleOverrides: {
        root: {
          borderRadius: parsePx(tokens.border.radius.sm),
          minHeight: `${tokens.touchTarget.large}px`,
          '&.Mui-focused': {
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: tokens.color.brand.primary[500],
              borderWidth: parsePx(tokens.border.width.medium),
            },
          },
        },
      },
    },
    // Paper/Card styling for elevation
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: parsePx(tokens.border.radius.lg),
        },
        elevation1: {
          boxShadow: tokens.shadow.sm,
        },
        elevation2: {
          boxShadow: tokens.shadow.md,
        },
        elevation3: {
          boxShadow: tokens.shadow.lg,
        },
      },
    },
    // Card styling
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: parsePx(tokens.border.radius.lg),
          boxShadow: tokens.shadow.sm,
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
            backgroundColor: `${tokens.color.brand.primary[500]}14`, // 8% opacity
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
        },
      },
    },
  },
};

// Create and export the theme
export const theme = createTheme(themeOptions);
