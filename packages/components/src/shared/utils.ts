/**
 * Shared Utilities for ODE Components
 * 
 * Platform-agnostic utility functions
 */

import type { ButtonVariant, ButtonPosition, ThemeMode } from './types';

/**
 * Get the opposite button variant for paired buttons
 */
export function getOppositeVariant(variant: ButtonVariant): ButtonVariant {
  switch (variant) {
    case 'primary':
      return 'secondary';
    case 'secondary':
      return 'primary';
    case 'neutral':
      return 'neutral';
    default:
      return 'primary';
  }
}

/**
 * Get text color for button based on variant and mode
 */
export function getButtonTextColor(
  _variant: ButtonVariant,
  isHovered: boolean,
  mode: ThemeMode = 'light'
): string {
  if (isHovered) {
    // When hovered, text should contrast with the background
    return mode === 'light' ? '#FFFFFF' : '#000000';
  }
  
  // When not hovered, text matches border color
  // This will be handled by the component implementation
  return 'inherit';
}

/**
 * Get border color for button variant
 */
export function getButtonBorderColor(variant: ButtonVariant): string {
  // These will be replaced with actual token values in implementations
  switch (variant) {
    case 'primary':
      return '#4F7F4E'; // brand.primary[500]
    case 'secondary':
      return '#E9B85B'; // brand.secondary[500]
    case 'neutral':
      return '#757575'; // neutral[600]
    default:
      return '#4F7F4E';
  }
}

/**
 * Get background color for button variant (used on hover)
 */
export function getButtonBackgroundColor(variant: ButtonVariant): string {
  return getButtonBorderColor(variant);
}

/**
 * Determine if button should fade on left or right
 * Left button fades on right, right button fades on left
 */
export function getFadeDirection(position: ButtonPosition): 'left' | 'right' {
  switch (position) {
    case 'left':
      return 'right';
    case 'right':
      return 'left';
    case 'standalone':
      return 'right'; // Default fade on right for standalone
    default:
      return 'right';
  }
}
