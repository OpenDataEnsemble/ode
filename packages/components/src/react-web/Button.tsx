/**
 * ODE Button Component - React Web
 * 
 * Modern minimalist button with fading border effect.
 * When two buttons are placed together, they have opposite styles.
 */

import React, { useState, useMemo } from 'react';
import type { ButtonProps, ButtonVariant } from '../shared/types';
import { getOppositeVariant, getFadeDirection } from '../shared/utils';
import tokensJson from '@ode/tokens/dist/json/tokens.json';

export interface WebButtonProps extends ButtonProps {
  /**
   * Whether this button is part of a pair (for opposite styling)
   */
  isPaired?: boolean;
  
  /**
   * The variant of the paired button (if any)
   */
  pairedVariant?: ButtonVariant;
}

// Extract token values
const tokens = tokensJson as any;

const Button: React.FC<WebButtonProps> = ({
  children,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  position = 'standalone',
  isPaired = false,
  pairedVariant,
  className = '',
  style,
  testID,
  accessibilityLabel,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  // Determine actual variant - if paired, use opposite of paired variant
  const actualVariant: ButtonVariant = useMemo(() => {
    if (isPaired && pairedVariant) {
      return getOppositeVariant(pairedVariant);
    }
    return variant;
  }, [isPaired, pairedVariant, variant]);

  // Get fade direction based on position
  const fadeDirection = getFadeDirection(position);

  // Get colors from tokens
  const getColor = (colorPath: string): string => {
    const parts = colorPath.split('.');
    let value: any = tokens;
    for (const part of parts) {
      value = value?.[part];
    }
    return value?.value || value || '#000000';
  };

  const borderColor = useMemo(() => {
    switch (actualVariant) {
      case 'primary':
        return getColor('color.brand.primary.500');
      case 'secondary':
        return getColor('color.brand.secondary.500');
      case 'neutral':
        return getColor('color.neutral.600');
      default:
        return getColor('color.brand.primary.500');
    }
  }, [actualVariant]);

  const borderRadius = getColor('border.radius.full');
  const borderWidth = getColor('border.width.thin');

  // Size-based spacing
  const paddingMap = {
    small: { vertical: getColor('spacing.2'), horizontal: getColor('spacing.4') },
    medium: { vertical: getColor('spacing.3'), horizontal: getColor('spacing.6') },
    large: { vertical: getColor('spacing.4'), horizontal: getColor('spacing.8') },
  };

  const fontSizeMap = {
    small: getColor('font.size.sm'),
    medium: getColor('font.size.base'),
    large: getColor('font.size.lg'),
  };

  const padding = paddingMap[size];
  const fontSize = fontSizeMap[size];

  const buttonStyle: React.CSSProperties = {
    position: 'relative',
    padding: `${padding.vertical} ${padding.horizontal}`,
    fontSize,
    fontFamily: getColor('font.family.sans'),
    fontWeight: getColor('font.weight.medium'),
    color: isHovered 
      ? (document.documentElement.classList.contains('dark') ? '#000000' : '#FFFFFF')
      : borderColor,
    backgroundColor: isHovered ? borderColor : 'transparent',
    border: 'none',
    borderRadius,
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    outline: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: getColor('touchTarget.comfortable') || '48px',
    textTransform: 'none',
    letterSpacing: getColor('font.letterSpacing.wide'),
    overflow: 'hidden',
    ...style,
  };

  // Border effect using SVG mask for better fade control
  const borderId = `border-fade-${fadeDirection}-${actualVariant}`;

  const handleClick = () => {
    if (!disabled && !loading && onPress) {
      onPress();
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      disabled={disabled || loading}
      className={`ode-button ode-button--${actualVariant} ode-button--${size} ${className}`}
      style={buttonStyle}
      data-testid={testID}
      aria-label={accessibilityLabel || (typeof children === 'string' ? children : undefined)}
      aria-disabled={disabled || loading}
    >
      {/* SVG for fading border effect */}
      <svg
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          opacity: isHovered ? 0 : 1,
          transition: 'opacity 0.3s ease',
        }}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={borderId} x1="0%" y1="0%" x2="100%" y2="0%">
            {fadeDirection === 'right' ? (
              <>
                <stop offset="0%" stopColor={borderColor} stopOpacity="1" />
                <stop offset="85%" stopColor={borderColor} stopOpacity="1" />
                <stop offset="100%" stopColor={borderColor} stopOpacity="0" />
              </>
            ) : (
              <>
                <stop offset="0%" stopColor={borderColor} stopOpacity="0" />
                <stop offset="15%" stopColor={borderColor} stopOpacity="1" />
                <stop offset="100%" stopColor={borderColor} stopOpacity="1" />
              </>
            )}
          </linearGradient>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          rx={borderRadius}
          ry={borderRadius}
          fill="none"
          stroke={`url(#${borderId})`}
          strokeWidth={borderWidth}
        />
      </svg>

      {loading ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', position: 'relative', zIndex: 1 }}>
          <span
            style={{
              width: '16px',
              height: '16px',
              border: `2px solid ${isHovered ? (document.documentElement.classList.contains('dark') ? '#000000' : '#FFFFFF') : borderColor}`,
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 0.6s linear infinite',
            }}
          />
          {children}
        </span>
      ) : (
        <span style={{ position: 'relative', zIndex: 1 }}>{children}</span>
      )}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </button>
  );
};

export default Button;
