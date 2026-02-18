/**
 * Formulus Button
 *
 * Renders a themed button that respects the custom app's brand colors
 * via the AppThemeContext.  Primary and secondary variants use the custom
 * app's palette; danger stays semantic-red; tertiary stays neutral-grey.
 *
 * This replaces the previous wrapper around `@ode/components` ODEButton
 * because that component reads colors from `@ode/tokens` and cannot be
 * overridden at runtime.
 */

import React, { useState, useMemo } from 'react';
import {
  TouchableOpacity,
  Text,
  View,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useAppTheme } from '../../contexts/AppThemeContext';
import { colors } from '../../theme/colors';

export interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'tertiary' | 'danger';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  position?: 'left' | 'right' | 'middle' | 'top' | 'bottom' | 'standalone';
  /** When true the button is shown in its "active / selected" state */
  active?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  testID?: string;
  accessibilityLabel?: string;
  children?: React.ReactNode;
}

// ── Size maps ───────────────────────────────────────────────────────────

const PADDING = {
  small: { vertical: 6, horizontal: 14 },
  medium: { vertical: 10, horizontal: 20 },
  large: { vertical: 14, horizontal: 28 },
} as const;

const FONT_SIZE = { small: 13, medium: 15, large: 17 } as const;

// ── Component ───────────────────────────────────────────────────────────

const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  fullWidth = false,
  active = false,
  style,
  textStyle,
  testID,
  accessibilityLabel,
  children: _children,
}) => {
  const [isPressed, setIsPressed] = useState(false);
  const { themeColors } = useAppTheme();
  const isActiveOrPressed = active || isPressed;

  // ── Resolve variant colors ──────────────────────────────────────────
  const variantColors = useMemo(() => {
    // Semantic colors stay fixed regardless of custom app theme
    const errorMain = colors.semantic?.error?.[500] ?? '#F44336';
    const errorDark = colors.semantic?.error?.[600] ?? '#D32F2F';
    const errorLight = colors.semantic?.error?.[50] ?? '#FFEBEE';
    const neutralGrey = colors.neutral[600];

    switch (variant) {
      case 'primary':
        return {
          border: themeColors.primary,
          text: themeColors.primary,
          textOnFill: themeColors.onPrimary,
          activeBg: themeColors.primary,
        };
      case 'secondary':
        return {
          border: themeColors.secondary,
          text: themeColors.secondary,
          textOnFill: themeColors.onSecondary,
          activeBg: themeColors.secondary,
        };
      case 'danger':
        return {
          border: errorMain,
          text: errorDark,
          textOnFill: '#FFFFFF',
          activeBg: 'transparent',
          defaultBg: errorLight,
        };
      case 'tertiary':
      default:
        return {
          border: neutralGrey,
          text: neutralGrey,
          textOnFill: '#FFFFFF',
          activeBg: neutralGrey,
        };
    }
  }, [variant, themeColors]);

  // ── Computed styles ─────────────────────────────────────────────────
  const isDanger = variant === 'danger';

  const backgroundColor = isDanger
    ? isPressed
      ? 'transparent'
      : (variantColors.defaultBg ?? 'transparent')
    : isActiveOrPressed
      ? variantColors.activeBg
      : 'transparent';

  const borderColor = isDanger
    ? variantColors.border
    : isActiveOrPressed
      ? 'transparent'
      : variantColors.border;

  const textColor = isDanger
    ? variantColors.text
    : isActiveOrPressed
      ? variantColors.textOnFill
      : variantColors.text;

  const padding = PADDING[size];
  const fontSize = FONT_SIZE[size];

  return (
    <View
      style={[styles.wrapper, fullWidth && { width: '100%' }, style]}
      pointerEvents="box-none">
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
            backgroundColor,
            borderColor,
            opacity: disabled ? 0.5 : 1,
          },
        ]}
        testID={testID}
        accessibilityLabel={accessibilityLabel ?? title}
        accessibilityRole="button"
        accessibilityState={{ disabled: disabled || loading }}>
        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator
              size="small"
              color={textColor}
              style={styles.loader}
            />
            <Text
              style={[styles.text, { color: textColor, fontSize }, textStyle]}>
              {title}
            </Text>
          </View>
        ) : (
          <Text
            style={[styles.text, { color: textColor, fontSize }, textStyle]}>
            {title}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

// ── Static styles ─────────────────────────────────────────────────────

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
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  text: {
    fontWeight: '500',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loader: {
    marginRight: 4,
  },
});

export default Button;
