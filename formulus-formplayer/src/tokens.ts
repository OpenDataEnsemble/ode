/**
 * ODE Design Tokens
 * 
 * Design tokens from the @ode/tokens package.
 * These values are sourced from packages/tokens/src/tokens/
 * and should be kept in sync with the token definitions there.
 * 
 * Note: This file defines tokens directly to work within Create React App's
 * restrictions on importing files outside src/. In a future refactor, this
 * could be replaced with importing from the built @ode/tokens package.
 */

// Helper function to parse pixel values to numbers
const parsePx = (value: string): number => {
  return parseInt(value.replace('px', ''), 10);
};

// Export token values in a convenient format
export const tokens = {
  color: {
    brand: {
      primary: {
        50: '#F0F7EF',
        100: '#D9E9D8',
        200: '#B9D5B8',
        300: '#90BD8F',
        400: '#6FA46E',
        500: '#4F7F4E', // ODE Primary Green
        600: '#3F6A3E',
        700: '#30552F',
        800: '#224021',
        900: '#173016',
      },
      secondary: {
        50: '#FEF9EE',
        100: '#FCEFD2',
        200: '#F9E0A8',
        300: '#F5CC75',
        400: '#F0B84D',
        500: '#E9B85B', // ODE Secondary Gold
        600: '#D9A230',
        700: '#B8861C',
        800: '#976D1A',
        900: '#7C5818',
      },
    },
    neutral: {
      white: '#FFFFFF',
      50: '#FAFAFA',
      100: '#F5F5F5',
      200: '#EEEEEE',
      300: '#E0E0E0',
      400: '#BDBDBD',
      500: '#9E9E9E',
      600: '#757575',
      700: '#616161',
      800: '#424242',
      900: '#212121',
      black: '#000000',
    },
    semantic: {
      success: {
        50: '#F0F9F0',
        500: '#34C759',
        600: '#2E7D32',
      },
      error: {
        50: '#FEF2F2',
        500: '#F44336',
        600: '#DC2626',
      },
      warning: {
        50: '#FFFBEB',
        500: '#FF9500',
        600: '#D97706',
      },
      info: {
        50: '#EFF6FF',
        500: '#2196F3',
        600: '#2563EB',
      },
    },
  },
  spacing: {
    0: '0px',
    1: '4px',
    2: '8px',
    3: '12px',
    4: '16px',
    6: '24px',
    8: '32px',
    10: '40px',
    12: '48px',
    16: '64px',
    20: '80px',
    24: '96px',
  },
  border: {
    radius: {
      none: '0px',
      sm: '4px',
      md: '8px',
      lg: '12px',
      xl: '16px',
      full: '9999px',
    },
    width: {
      none: '0px',
      hairline: '0.5px',
      thin: '1px',
      medium: '2px',
      thick: '3px',
    },
  },
  typography: {
    fontFamily: {
      sans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif",
      mono: "'Courier New', Consolas, monospace",
      display: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    },
    fontSize: {
      xs: '12px',
      sm: '14px',
      base: '16px',
      lg: '18px',
      xl: '20px',
      '2xl': '24px',
      '3xl': '32px',
      '4xl': '40px',
      '5xl': '48px',
      '6xl': '60px',
    },
    fontWeight: {
      light: '300',
      regular: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
    },
    lineHeight: {
      none: '1',
      tight: '1.25',
      normal: '1.5',
      relaxed: '1.75',
      loose: '2',
    },
    letterSpacing: {
      tighter: '-0.05em',
      tight: '-0.025em',
      normal: '0',
      wide: '0.025em',
      wider: '0.05em',
      widest: '0.1em',
    },
  },
  shadow: {
    none: 'none',
    xs: '0 1px 2px 0 rgba(0,0,0,0.05)',
    sm: '0 1px 3px 0 rgba(0,0,0,0.1)',
    md: '0 4px 6px -1px rgba(0,0,0,0.1)',
    lg: '0 10px 15px -3px rgba(0,0,0,0.1)',
    xl: '0 20px 25px -5px rgba(0,0,0,0.1)',
    '2xl': '0 25px 50px -12px rgba(0,0,0,0.25)',
  },
  touchTarget: {
    min: parsePx('44px'),
    comfortable: parsePx('48px'),
    large: parsePx('56px'),
  },
};
