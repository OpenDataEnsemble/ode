/**
 * Type declarations for @ode/components/react-web
 *
 * Types are inferred from the library's shared types and component interfaces.
 * This provides full type safety and IntelliSense while avoiding the need to
 * type-check the component implementations.
 */

declare module '@ode/components/react-web' {
  import type { FC, CSSProperties, ReactElement } from 'react';

  // Import types from the shared types package
  // Using the package export path that matches the components package.json exports
  import type {
    ButtonProps,
    ButtonVariant,
    ButtonSize,
    InputProps,
    CardProps,
    BadgeProps,
  } from '@ode/components/src/shared/types';

  // Web-specific button props
  export interface WebButtonProps extends ButtonProps {
    isPaired?: boolean;
    pairedVariant?: ButtonVariant;
    /** Native `<button type>` for form / mobile IME (Go, Send). @default 'button' */
    nativeType?: 'button' | 'submit' | 'reset';
  }

  // ButtonGroup props
  export interface ButtonGroupProps {
    children: ReactElement<ButtonProps>[];
    variant?: ButtonVariant;
    className?: string;
    style?: CSSProperties;
  }

  // Re-export shared types
  export type {
    ButtonProps,
    ButtonVariant,
    ButtonSize,
    InputProps,
    CardProps,
    BadgeProps,
  };

  // Export components with proper types
  export const Button: FC<WebButtonProps>;
  export const ButtonGroup: FC<ButtonGroupProps>;
  export const Input: FC<InputProps>;
  export const Card: FC<CardProps>;
  export const Badge: FC<BadgeProps>;
}
