/**
 * ODE Components
 * 
 * Main entry point - exports platform-specific components
 * 
 * Usage:
 * - For React Web: import { Button } from '@ode/components/react-web'
 * - For React Native: import { Button } from '@ode/components/react-native'
 */

// Re-export shared types
export type {
  ButtonProps,
  InputProps,
  CardProps,
  BadgeProps,
  ButtonVariant,
  ButtonSize,
  ButtonPosition,
  ThemeMode,
} from './shared/types';

// Platform-specific exports should be imported directly:
// import { Button } from '@ode/components/react-web'
// import { Button } from '@ode/components/react-native'
