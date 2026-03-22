/**
 * Formulus Input
 *
 * Wraps a standard TextInput with styling that respects the custom app's
 * theme via AppThemeContext.  The focus border uses the app's primary color
 * instead of the hardcoded ODE green from @ode/tokens.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ViewStyle,
  TextInputProps,
} from 'react-native';
import { useAppTheme } from '../../contexts/AppThemeContext';
import colors from '../../theme/colors';

export interface InputProps {
  label?: string;
  placeholder?: string;
  value?: string;
  onChangeText?: (text: string) => void;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  secureTextEntry?: boolean;
  style?: ViewStyle;
  testID?: string;
  /** Optional element rendered on the right inside the input border (e.g. icon button). */
  rightAccessory?: React.ReactNode;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoCorrect?: boolean;
  keyboardType?: TextInputProps['keyboardType'];
}

const Input: React.FC<InputProps> = ({
  label,
  placeholder,
  value,
  onChangeText,
  error,
  disabled = false,
  required = false,
  secureTextEntry = false,
  style,
  testID,
  rightAccessory,
  autoCapitalize,
  autoCorrect,
  keyboardType,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const { themeColors, resolvedMode } = useAppTheme();

  const borderColor = error
    ? (colors.semantic?.error?.[500] ?? '#F44336')
    : isFocused
      ? themeColors.primary
      : colors.neutral[400];

  const borderWidth = isFocused ? 2 : 1;

  const inputBackgroundColor =
    resolvedMode === 'dark'
      ? (themeColors.surface as string)
      : colors.neutral.white;

  const inputTextColor =
    resolvedMode === 'dark'
      ? (themeColors.onSurface as string)
      : (colors.neutral[900] as string);
  const placeholderColor =
    resolvedMode === 'dark'
      ? (colors.neutral[400] as string)
      : (colors.neutral[400] as string);

  return (
    <View style={[styles.container, style]} testID={testID}>
      {label && (
        <Text style={styles.label}>
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
      )}
      <View
        style={[
          styles.inputWrapper,
          {
            borderColor,
            borderWidth,
            backgroundColor: disabled
              ? colors.neutral[100]
              : inputBackgroundColor,
          },
        ]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          placeholderTextColor={placeholderColor}
          editable={!disabled}
          secureTextEntry={secureTextEntry}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          keyboardType={keyboardType}
          style={[styles.input, { color: inputTextColor }]}
          testID={testID ? `${testID}-input` : undefined}
          accessibilityLabel={label || placeholder}
          accessibilityState={{ disabled }}
        />
        {rightAccessory}
      </View>
      {error && (
        <Text style={styles.error} role="alert">
          {error}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    width: '100%',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.neutral[900],
    marginBottom: 8,
  },
  required: {
    color: colors.semantic?.error?.[500] ?? '#F44336',
  },
  inputWrapper: {
    width: '100%',
    minHeight: 56,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    lineHeight: 24,
    minHeight: 56,
    color: colors.neutral[900],
  },
  error: {
    marginTop: 4,
    fontSize: 14,
    color: colors.semantic?.error?.[500] ?? '#F44336',
  },
});

export default Input;
