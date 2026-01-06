/**
 * Shared Types for ODE Components
 * 
 * Platform-agnostic type definitions used across React Native and React Web implementations
 */

export type ButtonVariant = 'primary' | 'secondary' | 'neutral';
export type ButtonSize = 'small' | 'medium' | 'large';
export type ButtonPosition = 'left' | 'right' | 'standalone';

export interface ButtonProps {
  /**
   * Button text content
   */
  children: React.ReactNode;
  
  /**
   * Click handler
   */
  onPress?: () => void;
  
  /**
   * Button variant (affects color scheme)
   * @default 'primary'
   */
  variant?: ButtonVariant;
  
  /**
   * Button size
   * @default 'medium'
   */
  size?: ButtonSize;
  
  /**
   * Whether button is disabled
   * @default false
   */
  disabled?: boolean;
  
  /**
   * Whether button is in loading state
   * @default false
   */
  loading?: boolean;
  
  /**
   * Position when used in a button group
   * 'left' = first button, 'right' = last button, 'standalone' = single button
   * @default 'standalone'
   */
  position?: ButtonPosition;
  
  /**
   * Additional className/style (platform-specific)
   */
  className?: string;
  style?: any;
  
  /**
   * Test ID for testing
   */
  testID?: string;
  
  /**
   * Accessibility label
   */
  accessibilityLabel?: string;
}

export interface InputProps {
  /**
   * Input label
   */
  label?: string;
  
  /**
   * Input placeholder
   */
  placeholder?: string;
  
  /**
   * Input value
   */
  value?: string;
  
  /**
   * Change handler
   */
  onChangeText?: (text: string) => void;
  
  /**
   * Error message
   */
  error?: string;
  
  /**
   * Whether input is disabled
   */
  disabled?: boolean;
  
  /**
   * Input type (web only)
   */
  type?: 'text' | 'email' | 'password' | 'number' | 'tel';
  
  /**
   * Whether input is required
   */
  required?: boolean;
  
  /**
   * Additional className/style
   */
  className?: string;
  style?: any;
  
  /**
   * Test ID
   */
  testID?: string;
}

export interface CardProps {
  /**
   * Card content
   */
  children: React.ReactNode;
  
  /**
   * Card title
   */
  title?: string;
  
  /**
   * Card subtitle
   */
  subtitle?: string;
  
  /**
   * Whether card is elevated (has shadow)
   * @default true
   */
  elevated?: boolean;
  
  /**
   * Additional className/style
   */
  className?: string;
  style?: any;
  
  /**
   * Click handler (makes card clickable)
   */
  onPress?: () => void;
  
  /**
   * Test ID
   */
  testID?: string;
}

export interface BadgeProps {
  /**
   * Badge content
   */
  children: React.ReactNode;
  
  /**
   * Badge variant
   * @default 'neutral'
   */
  variant?: 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info' | 'neutral';
  
  /**
   * Badge size
   * @default 'medium'
   */
  size?: 'small' | 'medium' | 'large';
  
  /**
   * Additional className/style
   */
  className?: string;
  style?: any;
  
  /**
   * Test ID
   */
  testID?: string;
}

export type ThemeMode = 'light' | 'dark';
