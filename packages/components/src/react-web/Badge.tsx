/**
 * ODE Badge Component - React Web
 * 
 * Modern minimalist badge for labels and status indicators
 */

import React from 'react';
import type { BadgeProps } from '../shared/types';
import tokensJson from '@ode/tokens/dist/json/tokens.json';

const tokens = tokensJson as any;

const getColor = (colorPath: string): string => {
  const parts = colorPath.split('.');
  let value: any = tokens;
  for (const part of parts) {
    value = value?.[part];
  }
  return value?.value || value || '#000000';
};

const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'medium',
  className = '',
  style,
  testID,
}) => {
  const getVariantColors = () => {
    switch (variant) {
      case 'primary':
        return {
          bg: getColor('color.brand.primary.50'),
          text: getColor('color.brand.primary.700'),
        };
      case 'secondary':
        return {
          bg: getColor('color.brand.secondary.50'),
          text: getColor('color.brand.secondary.700'),
        };
      case 'success':
        return {
          bg: getColor('color.semantic.success.50'),
          text: getColor('color.semantic.success.600'),
        };
      case 'error':
        return {
          bg: getColor('color.semantic.error.50'),
          text: getColor('color.semantic.error.600'),
        };
      case 'warning':
        return {
          bg: getColor('color.semantic.warning.50'),
          text: getColor('color.semantic.warning.600'),
        };
      case 'info':
        return {
          bg: getColor('color.semantic.info.50'),
          text: getColor('color.semantic.info.600'),
        };
      case 'neutral':
      default:
        return {
          bg: getColor('color.neutral.100'),
          text: getColor('color.neutral.700'),
        };
    }
  };

  const colors = getVariantColors();
  const borderRadius = getColor('border.radius.md');

  const sizeMap = {
    small: {
      padding: `${getColor('spacing.1')} ${getColor('spacing.2')}`,
      fontSize: getColor('font.size.xs'),
    },
    medium: {
      padding: `${getColor('spacing.2')} ${getColor('spacing.3')}`,
      fontSize: getColor('font.size.sm'),
    },
    large: {
      padding: `${getColor('spacing.2')} ${getColor('spacing.4')}`,
      fontSize: getColor('font.size.base'),
    },
  };

  const badgeStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
    color: colors.text,
    borderRadius,
    fontWeight: getColor('font.weight.medium'),
    fontFamily: getColor('font.family.sans'),
    lineHeight: getColor('font.lineHeight.none'),
    ...sizeMap[size],
    ...style,
  };

  return (
    <span className={`ode-badge ode-badge--${variant} ode-badge--${size} ${className}`} style={badgeStyle} data-testid={testID}>
      {children}
    </span>
  );
};

export default Badge;
