/**
 * Tokens Adapter
 *
 * Adapts the @ode/tokens JSON export to match the structure expected by theme.ts
 * The JSON format from Style Dictionary includes { value: "..." } wrappers,
 * and uses "font" instead of "typography", so we transform it to match.
 */

import tokensJson from '@ode/tokens/dist/json/tokens.json';

// Helper to recursively extract values from { value: "..." } structure
const extractValues = (obj: any): any => {
  if (obj && typeof obj === 'object' && 'value' in obj && Object.keys(obj).length === 1) {
    // This is a { value: "..." } wrapper, extract the value
    return obj.value;
  }

  if (Array.isArray(obj)) {
    return obj.map(extractValues);
  }

  if (obj && typeof obj === 'object') {
    const result: any = {};
    for (const key in obj) {
      result[key] = extractValues(obj[key]);
    }
    return result;
  }

  return obj;
};

// Helper to parse pixel values to numbers
const parsePx = (value: string): number => {
  return parseInt(value.replace('px', ''), 10);
};

// Transform the tokens and map font -> typography structure
const transformed = extractValues(tokensJson);

// Map font structure to typography structure to match theme.ts expectations
if (transformed.font) {
  transformed.typography = {
    fontFamily: transformed.font.family,
    fontSize: transformed.font.size,
    fontWeight: transformed.font.weight,
    lineHeight: transformed.font.lineHeight,
    letterSpacing: transformed.font.letterSpacing,
  };
  // Keep font for backwards compatibility, but typography is the primary
}

// Parse touchTarget values from "48px" strings to numbers (48)
if (transformed.touchTarget) {
  transformed.touchTarget = {
    min: parsePx(transformed.touchTarget.min),
    comfortable: parsePx(transformed.touchTarget.comfortable),
    large: parsePx(transformed.touchTarget.large),
  };
}

export const tokens = transformed as any;
