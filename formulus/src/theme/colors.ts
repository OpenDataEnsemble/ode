/**
 * ODE Design System Color Tokens
 * Sourced from @ode/tokens package (single source of truth).
 *
 * Primary: Green (#4F7F4E)
 * Secondary: Gold (#E9B85B)
 */

import tokens from '@ode/tokens/dist/react-native/tokens-resolved';

const c = (tokens as { color: Record<string, unknown> }).color as Record<
  string,
  unknown
>;
const n = c.neutral as Record<string, string>;
const brand = c.brand as {
  primary: Record<string, unknown>;
  secondary: Record<string, unknown>;
};

export const colors = {
  brand: {
    primary: brand.primary as Record<string, string>,
    secondary: brand.secondary as Record<string, string>,
  },
  neutral: {
    white: n.white,
    50: n['50'],
    100: n['100'],
    200: n['200'],
    300: n['300'],
    400: n['400'],
    500: n['500'],
    600: n['600'],
    700: n['700'],
    800: n['800'],
    900: n['900'],
    black: n.black,
    transparent: 'transparent',
  },
  semantic: {
    success: {
      50: (c.semantic as Record<string, Record<string, Record<string, string>>>)
        .success['50'],
      500: (
        c.semantic as Record<string, Record<string, Record<string, string>>>
      ).success['500'],
      600: (
        c.semantic as Record<string, Record<string, Record<string, string>>>
      ).success['600'],
    },
    error: {
      50: (c.semantic as Record<string, Record<string, Record<string, string>>>)
        .error['50'],
      500: (
        c.semantic as Record<string, Record<string, Record<string, string>>>
      ).error['500'],
      600: (
        c.semantic as Record<string, Record<string, Record<string, string>>>
      ).error['600'],
      ios:
        (c.semantic as Record<string, Record<string, string>>)?.error?.ios ??
        '#FF3B30',
    },
    warning: {
      50: (c.semantic as Record<string, Record<string, Record<string, string>>>)
        .warning['50'],
      500: (
        c.semantic as Record<string, Record<string, Record<string, string>>>
      ).warning['500'],
      600: (
        c.semantic as Record<string, Record<string, Record<string, string>>>
      ).warning['600'],
    },
    info: {
      50: (c.semantic as Record<string, Record<string, Record<string, string>>>)
        .info['50'],
      500: (
        c.semantic as Record<string, Record<string, Record<string, string>>>
      ).info['500'],
      600: (
        c.semantic as Record<string, Record<string, Record<string, string>>>
      ).info['600'],
      ios:
        (c.semantic as Record<string, Record<string, string>>)?.info?.ios ??
        '#007AFF',
      light:
        (c.semantic as Record<string, Record<string, string>>)?.info?.light ??
        '#E3F2FD',
      medium:
        (c.semantic as Record<string, Record<string, string>>)?.info?.medium ??
        '#4A90E2',
    },
    scanner: {
      success:
        (c.semantic as Record<string, Record<string, Record<string, string>>>)
          ?.scanner?.success ?? '#00ff00',
    },
  },
  ui: {
    gray: {
      lightest:
        (c.semantic as Record<string, Record<string, Record<string, string>>>)
          ?.ui?.gray?.lightest ?? '#F8F8F8',
      lighter:
        (c.semantic as Record<string, Record<string, Record<string, string>>>)
          ?.ui?.gray?.lighter ?? '#F0F2F5',
      light:
        (c.semantic as Record<string, Record<string, Record<string, string>>>)
          ?.ui?.gray?.light ?? '#E5E5E5',
      medium:
        (c.semantic as Record<string, Record<string, Record<string, string>>>)
          ?.ui?.gray?.medium ?? '#CCCCCC',
      ios:
        (c.semantic as Record<string, Record<string, Record<string, string>>>)
          ?.ui?.gray?.ios ?? '#8E8E93',
    },
    background:
      (c.semantic as Record<string, Record<string, Record<string, string>>>)?.ui
        ?.overlay?.background ?? 'rgba(0, 0, 0, 0.5)',
    /** Full-screen shell behind primary app surfaces (replaces former blurred bitmap). */
    screenShell: {
      light: '#ebebeb',
      dark: '#413b2e',
    },
  },
};

/**
 * Parse a color string to r,g,b (0-255). Handles #RRGGBB, #RGB, #RRGGBBAA, rgb(), rgba().
 * Returns null if parsing fails.
 */
function parseColorToRgb(
  color: string,
): { r: number; g: number; b: number } | null {
  const s = String(color).trim();

  // #RRGGBB or #RRGGBBAA or #RGB
  const hexMatch = s.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/);
  if (hexMatch) {
    let h = hexMatch[1];
    if (h.length === 3) {
      h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    }
    if (h.length >= 6) {
      const r = parseInt(h.slice(0, 2), 16);
      const g = parseInt(h.slice(2, 4), 16);
      const b = parseInt(h.slice(4, 6), 16);
      return { r, g, b };
    }
  }

  // rgb(r,g,b) or rgba(r,g,b,a)
  const rgbMatch = s.match(/^rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgbMatch) {
    return {
      r: Math.min(255, parseInt(rgbMatch[1], 10)),
      g: Math.min(255, parseInt(rgbMatch[2], 10)),
      b: Math.min(255, parseInt(rgbMatch[3], 10)),
    };
  }

  return null;
}

/**
 * Return a color with the given alpha for translucent container backgrounds.
 * Accepts #RRGGBB, #RGB, #RRGGBBAA, rgb(), rgba(). Returns rgba(r,g,b,a)
 * so the screen shell background shows through; rgba has reliable alpha on Android.
 */
export function withAlpha(color: string, alpha: number): string {
  const parsed = parseColorToRgb(color);
  const a = Math.max(0, Math.min(1, alpha));
  if (!parsed) {
    return `rgba(255,255,255,${a})`;
  }
  return `rgba(${parsed.r},${parsed.g},${parsed.b},${a})`;
}

/** Alpha for container backgrounds: more transparent so the screen shell shows through. */
export const CONTAINER_ALPHA = 0.4;

export default colors;
