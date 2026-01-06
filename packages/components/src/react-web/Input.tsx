/**
 * ODE Input Component - React Web
 * 
 * Modern minimalist input with clean styling and error states
 */

import React, { useState, useRef } from 'react';
import type { InputProps } from '../shared/types';
import tokensJson from '@ode/tokens/dist/json/tokens.json';

const tokens = tokensJson as any;

const getColor = (colorPath: string): string => {
  const parts = colorPath.split('.');
  let value: any = tokens;
  for (const part of parts) {
    value = value?.[part];
  }
  return value?.value || value || '#000000';
};

const Input: React.FC<InputProps> = ({
  label,
  placeholder,
  value,
  onChangeText,
  error,
  disabled = false,
  type = 'text',
  required = false,
  className = '',
  style,
  testID,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    if (onChangeText) {
      onChangeText(newValue);
    }
  };

  const borderColor = error
    ? getColor('color.semantic.error.500')
    : isFocused
    ? getColor('color.brand.primary.500')
    : getColor('color.neutral.400');

  const borderWidth = isFocused ? getColor('border.width.medium') : getColor('border.width.thin');
  const borderRadius = getColor('border.radius.sm');

  const containerStyle: React.CSSProperties = {
    marginBottom: getColor('spacing.4'),
    width: '100%',
    ...style,
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: getColor('font.size.sm'),
    fontWeight: getColor('font.weight.medium'),
    color: getColor('color.neutral.900'),
    marginBottom: getColor('spacing.2'),
    fontFamily: getColor('font.family.sans'),
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: getColor('spacing.4'),
    fontSize: getColor('font.size.base'),
    fontFamily: getColor('font.family.sans'),
    lineHeight: getColor('font.lineHeight.normal'),
    color: getColor('color.neutral.900'),
    backgroundColor: disabled ? getColor('color.neutral.100') : getColor('color.neutral.white'),
    border: `${borderWidth} solid ${borderColor}`,
    borderRadius,
    minHeight: getColor('touchTarget.large') || '56px',
    outline: 'none',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    boxSizing: 'border-box',
  };

  const errorStyle: React.CSSProperties = {
    marginTop: getColor('spacing.1'),
    fontSize: getColor('font.size.sm'),
    color: getColor('color.semantic.error.500'),
    fontFamily: getColor('font.family.sans'),
  };

  return (
    <div className={`ode-input ${className}`} style={containerStyle} data-testid={testID}>
      {label && (
        <label style={labelStyle}>
          {label}
          {required && <span style={{ color: getColor('color.semantic.error.500'), marginLeft: '4px' }}>*</span>}
        </label>
      )}
      <input
        ref={inputRef}
        type={type}
        value={value || ''}
        onChange={handleChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        style={inputStyle}
        aria-invalid={!!error}
        aria-describedby={error ? `${testID}-error` : undefined}
      />
      {error && (
        <div id={testID ? `${testID}-error` : undefined} style={errorStyle} role="alert">
          {error}
        </div>
      )}
    </div>
  );
};

export default Input;
