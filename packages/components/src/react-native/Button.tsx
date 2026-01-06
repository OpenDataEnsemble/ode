/**
 * ODE Button Component - React Native
 * 
 * Modern minimalist button with fading border effect.
 * When two buttons are placed together, they have opposite styles.
 */

import React, { useState, useMemo } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  View,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { ButtonProps, ButtonVariant, ButtonPosition } from '../shared/types';
import { getOppositeVariant, getFadeDirection } from '../shared/utils';
import { tokens } from '@ode/tokens/dist/react-native/tokens';

export interface NativeButtonProps extends ButtonProps {
  /**
   * Whether this button is part of a pair (for opposite styling)
   */
  isPaired?: boolean;
  
  /**
   * The variant of the paired button (if any)
   */
  pairedVariant?: ButtonVariant;
}

const Button: React.FC<NativeButtonProps> = ({
  children,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  position = 'standalone',
  isPaired = false,
  pairedVariant,
  style,
  testID,
  accessibilityLabel,
}) => {
  const [isPressed, setIsPressed] = useState(false);

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
  const borderColor = useMemo(() => {
    switch (actualVariant) {
      case 'primary':
        return tokens.color.brand.primary[500];
      case 'secondary':
        return tokens.color.brand.secondary[500];
      case 'neutral':
        return tokens.color.neutral[600];
      default:
        return tokens.color.brand.primary[500];
    }
  }, [actualVariant]);

  const textColor = isPressed 
    ? '#FFFFFF' // Light text on dark background when pressed
    : borderColor;

  const backgroundColor = isPressed ? borderColor : 'transparent';

  // Size-based spacing
  const paddingMap = {
    small: { vertical: tokens.spacing[2], horizontal: tokens.spacing[4] },
    medium: { vertical: tokens.spacing[3], horizontal: tokens.spacing[6] },
    large: { vertical: tokens.spacing[4], horizontal: tokens.spacing[8] },
  };

  const fontSizeMap = {
    small: parseInt(tokens.font.size.sm.replace('px', '')),
    medium: parseInt(tokens.font.size.base.replace('px', '')),
    large: parseInt(tokens.font.size.lg.replace('px', '')),
  };

  const padding = paddingMap[size];
  const fontSize = fontSizeMap[size];
  const borderRadius = parseInt(tokens.border.radius.full.replace('px', '')) || 9999;
  const borderWidth = parseInt(tokens.border.width.thin.replace('px', '')) || 1;


  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      onPressIn={() => setIsPressed(true)}
      onPressOut={() => setIsPressed(false)}
      disabled={disabled || loading}
      style={[
        styles.button,
        {
          paddingVertical: padding.vertical,
          paddingHorizontal: padding.horizontal,
          borderRadius,
          backgroundColor,
          borderWidth,
          borderColor: isPressed ? 'transparent' : borderColor,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
      testID={testID}
      accessibilityLabel={accessibilityLabel || (typeof children === 'string' ? children : undefined)}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
    >
      {/* Border fade effect - simplified approach for React Native */}
      {!isPressed && (
        <View
          style={[
            styles.borderFadeOverlay,
            {
              borderColor,
              borderWidth,
              borderRadius,
              // Create fade effect by positioning overlay
              [fadeDirection === 'right' ? 'right' : 'left']: 0,
              width: fadeDirection === 'right' ? '15%' : '15%',
              opacity: 0.3, // Subtle fade effect
            },
          ]}
          pointerEvents="none"
        />
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator
            size="small"
            color={textColor}
            style={styles.loader}
          />
          <Text style={[styles.text, { color: textColor, fontSize }]}>
            {children}
          </Text>
        </View>
      ) : (
        <Text style={[styles.text, { color: textColor, fontSize }]}>
          {children}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48, // tokens.touchTarget.comfortable
    overflow: 'visible', // Allow border fade to be visible
  },
  borderFadeOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  text: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontWeight: '500',
    letterSpacing: 0.025,
    textAlign: 'center',
    zIndex: 1,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 1,
  },
  loader: {
    marginRight: 4,
  },
});

export default Button;
