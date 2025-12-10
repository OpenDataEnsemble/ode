import React from 'react';
import { TextInput, Text, View, StyleSheet, TextInputProps, ViewStyle } from 'react-native';

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
  testID?: string;
}

const Input: React.FC<InputProps> = ({
  label,
  error,
  containerStyle,
  testID,
  style,
  ...textInputProps
}) => {
  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        {...textInputProps}
        style={[styles.input, error && styles.inputError, style]}
        placeholderTextColor="#999999"
        testID={testID}
        accessibilityLabel={label || textInputProps.placeholder || 'Text input'}
        accessibilityRole="text"
        accessibilityState={{invalid: !!error}}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333333',
    marginBottom: 8,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#CCCCCC',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#000000',
    backgroundColor: '#FFFFFF',
  },
  inputError: {
    borderColor: '#FF3B30',
  },
  errorText: {
    fontSize: 12,
    color: '#FF3B30',
    marginTop: 4,
  },
});

export default Input;

