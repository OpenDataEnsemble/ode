/**
 * ODE Card Component - React Web
 * 
 * Modern minimalist card with subtle elevation and clean styling
 */

import React from 'react';
import type { CardProps } from '../shared/types';
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

const Card: React.FC<CardProps> = ({
  children,
  title,
  subtitle,
  elevated = true,
  className = '',
  style,
  onPress,
  testID,
}) => {
  const borderRadius = getColor('border.radius.lg');
  const shadow = elevated ? getColor('shadow.sm') : 'none';

  const cardStyle: React.CSSProperties = {
    backgroundColor: getColor('color.neutral.white'),
    borderRadius,
    padding: getColor('spacing.6'),
    boxShadow: shadow,
    border: `1px solid ${getColor('color.neutral.200')}`,
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    cursor: onPress ? 'pointer' : 'default',
    ...style,
  };

  const titleStyle: React.CSSProperties = {
    fontSize: getColor('font.size.xl'),
    fontWeight: getColor('font.weight.semibold'),
    color: getColor('color.neutral.900'),
    marginBottom: subtitle ? getColor('spacing.2') : getColor('spacing.4'),
    fontFamily: getColor('font.family.sans'),
    lineHeight: getColor('font.lineHeight.tight'),
  };

  const subtitleStyle: React.CSSProperties = {
    fontSize: getColor('font.size.sm'),
    fontWeight: getColor('font.weight.regular'),
    color: getColor('color.neutral.600'),
    marginBottom: getColor('spacing.4'),
    fontFamily: getColor('font.family.sans'),
    lineHeight: getColor('font.lineHeight.normal'),
  };

  const handleClick = () => {
    if (onPress) {
      onPress();
    }
  };

  return (
    <>
      <style>
        {onPress && `
          .ode-card-clickable:hover {
            box-shadow: ${getColor('shadow.md')} !important;
            transform: translateY(-2px);
          }
        `}
      </style>
      <div
        className={`ode-card ${onPress ? 'ode-card-clickable' : ''} ${className}`}
        style={cardStyle}
        onClick={handleClick}
        data-testid={testID}
        role={onPress ? 'button' : undefined}
        tabIndex={onPress ? 0 : undefined}
        onKeyDown={(e) => {
          if (onPress && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onPress();
          }
        }}
      >
        {title && <h3 style={titleStyle}>{title}</h3>}
        {subtitle && <p style={subtitleStyle}>{subtitle}</p>}
        {children}
      </div>
    </>
  );
};

export default Card;
