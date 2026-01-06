/**
 * ODE Button Group Component - React Web
 * 
 * Container for paired buttons with opposite styling
 */

import React from 'react';
import type { ButtonVariant } from '../shared/types';
import type { ButtonProps } from '../shared/types';

interface WebButtonProps extends ButtonProps {
  isPaired?: boolean;
  pairedVariant?: ButtonVariant;
  position?: 'left' | 'right' | 'standalone';
}

interface ButtonGroupProps {
  /**
   * Buttons to render
   */
  children: React.ReactElement<ButtonProps>[];
  
  /**
   * Variant for the first button (second will be opposite)
   */
  variant?: ButtonVariant;
  
  /**
   * Additional className
   */
  className?: string;
  
  /**
   * Additional style
   */
  style?: React.CSSProperties;
}

const ButtonGroup: React.FC<ButtonGroupProps> = ({
  children,
  variant = 'primary',
  className = '',
  style,
}) => {
  const buttons = React.Children.toArray(children) as React.ReactElement<WebButtonProps>[];

  return (
    <div
      className={`ode-button-group ${className}`}
      style={{
        display: 'inline-flex',
        gap: '12px',
        ...style,
      }}
    >
      {buttons.map((button, index) => {
        const isFirst = index === 0;
        const isLast = index === buttons.length - 1;
        const position = isFirst ? 'left' : isLast ? 'right' : 'standalone';
        const isPaired = buttons.length > 1;

        return React.cloneElement(button, {
          key: index,
          position,
          isPaired,
          pairedVariant: isFirst ? variant : getOppositeVariant(variant),
          variant: isFirst ? variant : undefined, // Let the button determine its own variant if paired
        } as any);
      })}
    </div>
  );
};

function getOppositeVariant(variant: ButtonVariant): ButtonVariant {
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

export default ButtonGroup;
