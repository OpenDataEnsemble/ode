import tokens from '@ode/tokens/dist/react-native/tokens-resolved';

type Tokens = {
  spacing: Record<string, string>;
  font: { size: Record<string, string>; weight: Record<string, string> };
  border: { width: { thin: string }; radius: Record<string, string> };
  touchTarget?: Record<string, string>;
  component?: {
    button?: {
      width?: { standalone?: string };
      minHeight?: string;
    };
  };
};

const t = tokens as Tokens;

const parsePx = (value: string | undefined): number =>
  parseInt(String(value ?? '').replace('px', ''), 10) || 0;

export const odeSpacing = {
  xxs: parsePx(t.spacing?.['1']) || 4,
  xs: parsePx(t.spacing?.['2']) || 8,
  sm: parsePx(t.spacing?.['3']) || 12,
  md: parsePx(t.spacing?.['4']) || 16,
  lg: parsePx(t.spacing?.['6']) || 24,
  xl: parsePx(t.spacing?.['8']) || 32,
};

/** Button tokens for standalone (e.g. permission/cancel) actions */
export const odeButton = {
  standaloneWidth: parsePx(t.component?.button?.width?.standalone) || 200,
  standaloneMaxHeight: parsePx(t.touchTarget?.medium) || 52,
};

export const odeTypography = {
  screenTitle: parsePx(t.font?.size?.['2xl']) || 28,
  sectionTitle: parsePx(t.font?.size?.xl) || 20,
  body: parsePx(t.font?.size?.base) || 16,
  bodySm: parsePx(t.font?.size?.sm) || 14,
  caption: parsePx(t.font?.size?.xs) || 12,
};

export const odeFontWeight = {
  regular: (t.font?.weight?.regular ?? '400') as '400' | '500' | '600' | '700',
  bold: (t.font?.weight?.bold ?? '700') as '400' | '500' | '600' | '700',
};

export const odeRadius = {
  card: parsePx(t.border?.radius?.lg) || 12,
  inner: parsePx(t.border?.radius?.md) || 8,
};

export const odeBorderWidth = {
  hairline: parsePx(t.border?.width?.thin) || 1,
};
