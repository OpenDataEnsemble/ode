/**
 * ODE Input Component - React Native
 * 
 * Modern minimalist input with clean styling and error states
 */

import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { InputProps } from '../shared/types';
import { tokens } from '@ode/tokens/dist/react-native/tokens';

const Input: React.FC<InputProps> = ({
  label,
  placeholder,
  value,
  onChangeText,
  error,
  disabled = false,
  required = false,
  style,
  testID,
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const borderColor = error
    ? tokens.color.semantic.error[500]
    : isFocused
    ? tokens.color.brand.primary[500]
    : tokens.color.neutral[400];

  const borderWidth = isFocused ? parseInt(tokens.border.width.medium.replace('px', '')) : parseInt(tokens.border.width.thin.replace('px', ''));
  const borderRadius = parseInt(tokens.border.radius.sm.replace('px', ''));

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
        placeholderTextColor={tokens.color.neutral[400]}
        editable={!disabled}
        style={[
          styles.input,
          {
            borderColor,
            borderWidth,
            borderRadius,
            backgroundColor: disabled ? tokens.color.neutral[100] : tokens.color.neutral.white,
            color: tokens.color.neutral[900],
          },
        ]}
        testID={testID ? `${testID}-input` : undefined}
        accessibilityLabel={label || placeholder}
        accessibilityState={{ disabled, invalid: !!error }}
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
    marginBottom: parseInt(tokens.spacing[4].replace('px', '')),
    width: '100%',
  },
  label: {
    fontSize: parseInt(tokens.font.size.sm.replace('px', '')),
    fontWeight: tokens.font.weight.medium,
    color: tokens.color.neutral[900],
    marginBottom: parseInt(tokens.spacing[2].replace('px', '')),
    fontFamily: tokens.font.family.sans,
  },
  required: {
    color: tokens.color.semantic.error[500],
  },
  input: {
    width: '100%',
    padding: parseInt(tokens.spacing[4].replace('px', '')),
    fontSize: parseInt(tokens.font.size.base.replace('px', '')),
    fontFamily: tokens.font.family.sans,
    lineHeight: parseFloat(tokens.font.lineHeight.normal),
    minHeight: 56, // tokens.touchTarget.large
  },
  error: {
    marginTop: parseInt(tokens.spacing[1].replace('px', '')),
    fontSize: parseInt(tokens.font.size.sm.replace('px', '')),
    color: tokens.color.semantic.error[500],
    fontFamily: tokens.font.family.sans,
  },
});

export default Input;
