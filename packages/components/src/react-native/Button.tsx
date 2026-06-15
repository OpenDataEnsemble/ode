/**
 * ODE Button Component - React Native
 *
 * Synkronus-style: full borders on all sides, border.radius.md (8px), thin border,
 * token-based spacing/typography. Same border radius in px for common design language.
 */

import React, { useState, useMemo } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  View,
  ActivityIndicator,
  useColorScheme,
} from 'react-native';
import { ButtonProps, ButtonVariant } from '../shared/types';
import { getOppositeVariant } from '../shared/utils';
import tokens from '@ode/tokens/dist/react-native/tokens-resolved';

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
  active = false,
  isPaired = false,
  pairedVariant,
  style,
  testID,
  accessibilityLabel,
}) => {
  const [isPressed, setIsPressed] = useState(false);
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';
  const isActiveOrPressed = active || isPressed;

  // Determine actual variant - if paired, use opposite of paired variant
  const actualVariant: ButtonVariant = useMemo(() => {
    if (isPaired && pairedVariant) {
      return getOppositeVariant(pairedVariant);
    }
    return variant;
  }, [isPaired, pairedVariant, variant]);

  const primaryGreen = tokens.color.brand.primary[500];
  const errorRed =
    (tokens.color.semantic as any)?.error?.[500] ?? tokens.color.semantic?.error?.[500];
  const errorRedDark =
    (tokens.color.semantic as any)?.error?.[600] ?? tokens.color.semantic?.error?.[600];
  const errorRedLight =
    (tokens.color.semantic as any)?.error?.[50] ?? tokens.color.semantic?.error?.[50];
  const neutralGrey = tokens.color.neutral[600];
  const textOnFill = tokens.color.neutral.white;

  const borderColor = useMemo(() => {
    switch (actualVariant) {
      case 'primary':
        return primaryGreen;
      case 'secondary':
        return tokens.color.brand.secondary[500];
      case 'neutral':
        return neutralGrey;
      case 'danger':
        return errorRed ?? neutralGrey;
      default:
        return primaryGreen;
    }
  }, [actualVariant, primaryGreen, neutralGrey, errorRed]);

  // Danger button style (matches formplayer error buttons):
  // Default: light pink background (error.50) in light mode, error.500 at 15% in dark mode
  //          red border (error.500), darker red text (error.600)
  // Pressed: transparent background, red border (same), darker red text (same)
  const dangerDefaultBorder = errorRed ?? neutralGrey;
  const dangerDefaultText = errorRedDark ?? errorRed ?? neutralGrey;
  const dangerDefaultBg = isDarkMode
    ? 'rgba(244, 67, 54, 0.15)' // error.500 (#f44336) at 15% for dark mode
    : (errorRedLight ?? 'transparent'); // Light pink (error.50) in light mode

  const pressedBg = actualVariant === 'danger' ? 'transparent' : borderColor;
  const pressedBorderColor = actualVariant === 'danger' ? dangerDefaultBorder : 'transparent';

  const textColor =
    actualVariant === 'danger' ? dangerDefaultText : isActiveOrPressed ? textOnFill : borderColor;
  const activeBorderColor =
    actualVariant === 'danger'
      ? dangerDefaultBorder
      : isActiveOrPressed
        ? pressedBorderColor
        : borderColor;
  const backgroundColor =
    actualVariant === 'danger'
      ? isPressed
        ? 'transparent'
        : dangerDefaultBg
      : isActiveOrPressed
        ? pressedBg
        : 'transparent';

  const parsePx = (v: string) => parseInt(String(v).replace('px', ''), 10) || 0;
  const paddingMap = {
    small: { vertical: parsePx(tokens.spacing[2]), horizontal: parsePx(tokens.spacing[4]) },
    medium: { vertical: parsePx(tokens.spacing[3]), horizontal: parsePx(tokens.spacing[6]) },
    large: { vertical: parsePx(tokens.spacing[4]), horizontal: parsePx(tokens.spacing[8]) },
  };

  const fontSizeMap = {
    small: parseInt(tokens.font.size.sm.replace('px', '')),
    medium: parseInt(tokens.font.size.base.replace('px', '')),
    large: parseInt(tokens.font.size.lg.replace('px', '')),
  };

  const padding = paddingMap[size];
  const fontSize = fontSizeMap[size];
  // Common design language: border.radius.md in px (8px from tokens)
  const borderRadius = parseInt(String(tokens.border.radius.md).replace('px', ''), 10) || 8;
  const borderWidth = parseInt(String(tokens.border.width.thin).replace('px', ''), 10) || 1;
  const letterSpacing =
    Number(String(tokens.font.letterSpacing?.wide ?? 0.025).replace('em', '')) *
    (fontSizeMap[size] || 16);

  // Full borders on all sides, same radius on all corners (px)
  const borderStyle = useMemo(
    () => ({
      borderLeftWidth: borderWidth,
      borderRightWidth: borderWidth,
      borderTopWidth: borderWidth,
      borderBottomWidth: borderWidth,
      borderTopLeftRadius: borderRadius,
      borderBottomLeftRadius: borderRadius,
      borderTopRightRadius: borderRadius,
      borderBottomRightRadius: borderRadius,
    }),
    [borderWidth, borderRadius]
  );

  return (
    <View style={[styles.wrapper, style]} pointerEvents="box-none">
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onPress}
        onPressIn={() => setIsPressed(true)}
        onPressOut={() => setIsPressed(false)}
        disabled={disabled || loading}
        style={[
          styles.button,
          borderStyle,
          {
            paddingVertical: padding.vertical,
            paddingHorizontal: padding.horizontal,
            backgroundColor,
            borderColor: activeBorderColor,
            opacity: disabled ? 0.5 : 1,
          },
        ]}
        testID={testID}
        accessibilityLabel={
          accessibilityLabel || (typeof children === 'string' ? children : undefined)
        }
        accessibilityRole="button"
        accessibilityState={{ disabled: disabled || loading }}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={textColor} style={styles.loader} />
            <Text style={[styles.text, { color: textColor, fontSize, letterSpacing }]}>
              {children}
            </Text>
          </View>
        ) : (
          <Text style={[styles.text, { color: textColor, fontSize, letterSpacing }]}>
            {children}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    minHeight: 48,
    overflow: 'hidden',
  },
  button: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    overflow: 'hidden',
  },
  text: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontWeight: '500',
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
