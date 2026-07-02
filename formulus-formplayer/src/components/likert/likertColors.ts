import { tokens } from '../../theme/tokens-adapter';
import type { LikertColorMode } from './likertTypes';

function tokenOr(fallback: string, value?: string): string {
  return value && value.length > 0 ? value : fallback;
}

const ERROR = tokenOr('#F44336', tokens.color.semantic.error['500']);
const WARNING = tokenOr('#FF9500', tokens.color.semantic.warning['500']);
const SUCCESS = tokenOr('#34C759', tokens.color.semantic.success['500']);

/**
 * Semantic accent for an option position: low → error, mid → warning,
 * high → success. Applied to the SELECTED option only — unselected options
 * always stay neutral so the scale looks standard and uncluttered.
 */
export function getSpectrumColor(index: number, total: number): string {
  if (total <= 1) return WARNING;
  const t = index / (total - 1);
  if (t < 0.4) return ERROR;
  if (t <= 0.6) return WARNING;
  return SUCCESS;
}

export function resolveEffectiveColorMode(
  display: string,
  colorMode?: LikertColorMode,
): LikertColorMode {
  if (display === 'stars') return 'stars';
  return colorMode ?? 'neutral';
}
