/**
 * ODE Badge Component - React Native
 * 
 * Modern minimalist badge for labels and status indicators
 */

import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { BadgeProps } from '../shared/types';
import { tokens } from '@ode/tokens/dist/react-native/tokens';

const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'medium',
  style,
  testID,
}) => {
  const getVariantColors = () => {
    switch (variant) {
      case 'primary':
        return {
          bg: tokens.color.brand.primary[50],
          text: tokens.color.brand.primary[700],
        };
      case 'secondary':
        return {
          bg: tokens.color.brand.secondary[50],
          text: tokens.color.brand.secondary[700],
        };
      case 'success':
        return {
          bg: tokens.color.semantic.success[50],
          text: tokens.color.semantic.success[600],
        };
      case 'error':
        return {
          bg: tokens.color.semantic.error[50],
          text: tokens.color.semantic.error[600],
        };
      case 'warning':
        return {
          bg: tokens.color.semantic.warning[50],
          text: tokens.color.semantic.warning[600],
        };
      case 'info':
        return {
          bg: tokens.color.semantic.info[50],
          text: tokens.color.semantic.info[600],
        };
      case 'neutral':
      default:
        return {
          bg: tokens.color.neutral[100],
          text: tokens.color.neutral[700],
        };
    }
  };

  const colors = getVariantColors();
  const borderRadius = parseInt(tokens.border.radius.md.replace('px', ''));

  const sizeMap = {
    small: {
      paddingVertical: parseInt(tokens.spacing[1].replace('px', '')),
      paddingHorizontal: parseInt(tokens.spacing[2].replace('px', '')),
      fontSize: parseInt(tokens.font.size.xs.replace('px', '')),
    },
    medium: {
      paddingVertical: parseInt(tokens.spacing[2].replace('px', '')),
      paddingHorizontal: parseInt(tokens.spacing[3].replace('px', '')),
      fontSize: parseInt(tokens.font.size.sm.replace('px', '')),
    },
    large: {
      paddingVertical: parseInt(tokens.spacing[2].replace('px', '')),
      paddingHorizontal: parseInt(tokens.spacing[4].replace('px', '')),
      fontSize: parseInt(tokens.font.size.base.replace('px', '')),
    },
  };

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: colors.bg,
          borderRadius,
          ...sizeMap[size],
        },
        style,
      ]}
      testID={testID}
    >
      <Text
        style={[
          styles.text,
          {
            color: colors.text,
            fontSize: sizeMap[size].fontSize,
          },
        ]}
      >
        {children}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: tokens.font.weight.medium,
    fontFamily: tokens.font.family.sans,
    lineHeight: parseFloat(tokens.font.lineHeight.none),
  },
});

export default Badge;
