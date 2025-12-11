import React, {useState} from 'react';
import {
  TextInput,
  Text,
  View,
  StyleSheet,
  TextInputProps,
  ViewStyle,
  TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export interface PasswordInputProps extends Omit<TextInputProps, 'secureTextEntry'> {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
  testID?: string;
  /**
   * Show label above the input (default: true)
   */
  showLabel?: boolean;
}

/**
 * Reusable PasswordInput component with visibility toggle.
 */
const PasswordInput: React.FC<PasswordInputProps> = ({
  label,
  error,
  containerStyle,
  testID,
  style,
  showLabel = true,
  ...textInputProps
}) => {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const togglePasswordVisibility = () => {
    setIsPasswordVisible(prev => !prev);
  };

  const accessibilityLabel = isPasswordVisible
    ? 'Hide password'
    : 'Show password';

  // Extract paddingHorizontal from style to calculate proper paddingRight
  const inputStyle = StyleSheet.flatten([styles.input, style]);
  const paddingHorizontal = inputStyle.paddingHorizontal || 12;
  const paddingRight = typeof paddingHorizontal === 'number' 
    ? paddingHorizontal + 40 // Space for icon + some padding
    : 45; // Default fallback

  return (
    <View style={[styles.container, containerStyle]}>
      {showLabel && label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.inputContainer}>
        <TextInput
          {...textInputProps}
          style={[
            styles.input,
            error && styles.inputError,
            textInputProps.multiline && styles.inputMultiline,
            style,
            {paddingRight}, // Ensure icon space is always available
          ]}
          secureTextEntry={!isPasswordVisible}
          placeholderTextColor={textInputProps.placeholderTextColor || '#999999'}
          testID={testID}
          accessibilityLabel={
            textInputProps.accessibilityLabel ||
            label ||
            textInputProps.placeholder ||
            'Password input'
          }
          accessibilityRole="text"
          accessibilityState={{invalid: !!error}}
        />
        <TouchableOpacity
          style={styles.eyeButton}
          onPress={togglePasswordVisibility}
          accessibilityLabel={accessibilityLabel}
          accessibilityRole="button"
          accessibilityHint={
            isPasswordVisible
              ? 'Tap to hide password'
              : 'Tap to show password'
          }
          hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
          <Icon
            name={isPasswordVisible ? 'eye-off' : 'eye'}
            size={22}
            color="#666666"
          />
        </TouchableOpacity>
      </View>
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
  inputContainer: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
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
  inputMultiline: {
    minHeight: 48,
    paddingTop: 12,
    paddingBottom: 12,
  },
  eyeButton: {
    position: 'absolute',
    right: 12,
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 12,
    color: '#FF3B30',
    marginTop: 4,
  },
});

export default PasswordInput;

