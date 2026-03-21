import React, { useState } from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import Icon from '@react-native-vector-icons/material-design-icons';
import Input from './Input';
import type { InputProps } from './Input';
import { useAppTheme } from '../../contexts/AppThemeContext';

export interface PasswordInputProps extends Omit<
  InputProps,
  'secureTextEntry' | 'rightAccessory'
> {
  /**
   * When false, no label is rendered even if `label` is set.
   * @default true
   */
  showLabel?: boolean;
}

/**
 * Password field built on {@link Input} with a show/hide visibility toggle.
 */
const PasswordInput: React.FC<PasswordInputProps> = ({
  label,
  showLabel = true,
  ...inputProps
}) => {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const { themeColors } = useAppTheme();

  const accessibilityLabel = isPasswordVisible
    ? 'Hide password'
    : 'Show password';

  return (
    <Input
      {...inputProps}
      label={showLabel ? label : undefined}
      secureTextEntry={!isPasswordVisible}
      rightAccessory={
        <TouchableOpacity
          style={styles.toggle}
          onPress={() => setIsPasswordVisible(prev => !prev)}
          accessibilityLabel={accessibilityLabel}
          accessibilityRole="button"
          accessibilityHint={
            isPasswordVisible ? 'Tap to hide password' : 'Tap to show password'
          }
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Icon
            name={isPasswordVisible ? 'eye-off' : 'eye'}
            size={22}
            color={themeColors.primary as string}
          />
        </TouchableOpacity>
      }
    />
  );
};

const styles = StyleSheet.create({
  toggle: {
    paddingRight: 16,
  },
});

export default PasswordInput;
