/**
 * Formulus Input
 *
 * Wraps a standard TextInput with styling that respects the custom app's
 * theme via AppThemeContext.  The focus border uses the app's primary color
 * instead of the hardcoded ODE green from @ode/tokens.
 */

import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ViewStyle } from 'react-native';
import { useAppTheme } from '../../contexts/AppThemeContext';
import { colors } from '../../theme/colors';

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
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const { themeColors } = useAppTheme();

  const borderColor = error
    ? (colors.semantic?.error?.[500] ?? '#F44336')
    : isFocused
      ? themeColors.primary
      : colors.neutral[400];

  const borderWidth = isFocused ? 2 : 1;

  return (
    <View style={[styles.container, style]} testID={testID}>
      {label && (
        <Text style={styles.label}>
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
      )}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        placeholderTextColor={colors.neutral[400]}
        editable={!disabled}
        secureTextEntry={secureTextEntry}
        style={[
          styles.input,
          {
            borderColor,
            borderWidth,
            backgroundColor: disabled
              ? colors.neutral[100]
              : colors.neutral.white,
          },
        ]}
        testID={testID ? `${testID}-input` : undefined}
        accessibilityLabel={label || placeholder}
        accessibilityState={{ disabled }}
      />
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
  input: {
    width: '100%',
    padding: 16,
    fontSize: 16,
    lineHeight: 24,
    minHeight: 56,
    borderRadius: 6,
    color: colors.neutral[900],
  },
  error: {
    marginTop: 4,
    fontSize: 14,
    color: colors.semantic?.error?.[500] ?? '#F44336',
  },
});

export default Input;
