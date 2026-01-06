/**
 * ODE Button Group Component - React Native
 * 
 * Container for paired buttons with opposite styling
 */

import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Button from './Button';
import { ButtonVariant, ButtonProps } from '../shared/types';

interface NativeButtonProps extends ButtonProps {
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
   * Additional style
   */
  style?: ViewStyle;
}

const ButtonGroup: React.FC<ButtonGroupProps> = ({
  children,
  variant = 'primary',
  style,
}) => {
  const buttons = React.Children.toArray(children) as React.ReactElement<NativeButtonProps>[];

  return (
    <View style={[styles.container, style]}>
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
    </View>
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

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 12,
  },
});

export default ButtonGroup;
