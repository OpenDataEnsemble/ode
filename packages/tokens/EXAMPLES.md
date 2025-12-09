# Design Tokens - Usage Examples

This document provides practical examples of using ODE design tokens in different contexts.

## Table of Contents

1. [CSS Examples](#css-examples)
2. [React Web Examples](#react-web-examples)
3. [React Native Examples](#react-native-examples)
4. [Material UI Theming](#material-ui-theming)

---

## CSS Examples

### Primary Button

```css
.button-primary {
  /* Colors */
  background-color: var(--color-brand-primary-500);
  color: var(--color-neutral-white);
  
  /* Typography */
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  line-height: var(--line-height-normal);
  
  /* Spacing */
  padding: var(--spacing-3) var(--spacing-6); /* 12px 24px */
  
  /* Borders */
  border: none;
  border-radius: var(--border-radius-md); /* 8px */
  
  /* Effects */
  box-shadow: var(--shadow-sm);
  transition: all var(--duration-fast) var(--easing-ease-out);
  
  /* Accessibility */
  min-height: var(--touch-target-min); /* 44px */
}

.button-primary:hover {
  background-color: var(--color-brand-primary-400);
  box-shadow: var(--shadow-md);
}

.button-primary:focus-visible {
  outline: var(--focus-ringWidth) solid var(--focus-ringColor);
  outline-offset: var(--focus-ringOffset);
}

.button-primary:active {
  background-color: var(--color-brand-primary-600);
}

.button-primary:disabled {
  background-color: var(--color-neutral-300);
  color: var(--color-neutral-500);
  opacity: var(--opacity-50);
  cursor: not-allowed;
}
```

### Input Field

```css
.input {
  /* Colors */
  background-color: var(--color-neutral-white);
  color: var(--color-neutral-900);
  border-color: var(--color-neutral-300);
  
  /* Typography */
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-regular);
  line-height: var(--line-height-normal);
  
  /* Spacing */
  padding: var(--spacing-3) var(--spacing-4); /* 12px 16px */
  
  /* Borders */
  border-width: var(--border-width-thin); /* 1px */
  border-style: solid;
  border-radius: var(--border-radius-sm); /* 4px */
  
  /* Effects */
  transition: border-color var(--duration-fast) var(--easing-ease-out);
}

.input:focus {
  border-width: var(--border-width-medium); /* 2px */
  border-color: var(--focus-ringColor);
  outline: none;
}

.input-error {
  border-color: var(--color-semantic-error-500);
}

.input:disabled {
  background-color: var(--color-neutral-100);
  color: var(--color-neutral-400);
  opacity: var(--opacity-50);
  cursor: not-allowed;
}
```

### Card Component

```css
.card {
  /* Colors */
  background-color: var(--color-neutral-white);
  border-color: var(--color-neutral-200);
  
  /* Spacing */
  padding: var(--spacing-6); /* 24px */
  
  /* Borders */
  border-width: var(--border-width-thin);
  border-style: solid;
  border-radius: var(--border-radius-md); /* 8px */
  
  /* Effects */
  box-shadow: var(--shadow-sm);
}

.card-header {
  margin-bottom: var(--spacing-4); /* 16px */
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-neutral-900);
}

.card-body {
  color: var(--color-neutral-600);
  font-size: var(--font-size-base);
  line-height: var(--line-height-relaxed);
}
```

### Responsive Container

```css
.container {
  width: 100%;
  max-width: var(--container-xl); /* 1280px */
  padding: var(--spacing-4); /* 16px */
  margin: 0 auto;
}

/* Tablet and up */
@media (min-width: var(--breakpoint-md)) {
  .container {
    padding: var(--spacing-6); /* 24px */
  }
}

/* Desktop and up */
@media (min-width: var(--breakpoint-lg)) {
  .container {
    padding: var(--spacing-8); /* 32px */
  }
}
```

### Alert/Toast Component

```css
.alert {
  padding: var(--spacing-4);
  border-radius: var(--border-radius-md);
  border-width: var(--border-width-thin);
  border-style: solid;
  box-shadow: var(--shadow-md);
}

.alert-success {
  background-color: var(--color-semantic-success-50);
  border-color: var(--color-semantic-success-500);
  color: var(--color-semantic-success-600);
}

.alert-error {
  background-color: var(--color-semantic-error-50);
  border-color: var(--color-semantic-error-500);
  color: var(--color-semantic-error-600);
}

.alert-warning {
  background-color: var(--color-semantic-warning-50);
  border-color: var(--color-semantic-warning-500);
  color: var(--color-semantic-warning-600);
}

.alert-info {
  background-color: var(--color-semantic-info-50);
  border-color: var(--color-semantic-info-500);
  color: var(--color-semantic-info-600);
}
```

---

## React Web Examples

### Using CSS Variables

```jsx
import './styles.css'; // Imports tokens.css

function Button({ children, variant = 'primary' }) {
  return (
    <button className={`button button-${variant}`}>
      {children}
    </button>
  );
}
```

### Using JavaScript Tokens

```jsx
import { 
  colorBrandPrimary500, 
  spacing3, 
  spacing6,
  borderRadiusMd 
} from '@ode/tokens/dist/js/tokens';

function Button({ children }) {
  const buttonStyle = {
    backgroundColor: colorBrandPrimary500,
    padding: `${spacing3} ${spacing6}`,
    borderRadius: borderRadiusMd,
    color: '#FFFFFF',
    border: 'none',
    cursor: 'pointer'
  };

  return (
    <button style={buttonStyle}>
      {children}
    </button>
  );
}
```

### Styled Components

```jsx
import styled from 'styled-components';
import tokens from '@ode/tokens/dist/js/tokens';

const Button = styled.button`
  background-color: ${tokens.color.brand.primary[500]};
  color: ${tokens.color.neutral.white};
  padding: ${tokens.spacing[3]} ${tokens.spacing[6]};
  border-radius: ${tokens.border.radius.md};
  font-size: ${tokens.font.size.base};
  font-weight: ${tokens.font.weight.medium};
  border: none;
  cursor: pointer;
  transition: all ${tokens.duration.fast} ${tokens.easing.easeOut};

  &:hover {
    background-color: ${tokens.color.brand.primary[400]};
  }

  &:focus-visible {
    outline: ${tokens.focus.ringWidth} solid ${tokens.focus.ringColor};
    outline-offset: ${tokens.focus.ringOffset};
  }
`;
```

---

## React Native Examples

### Basic Component Styling

```jsx
import { StyleSheet } from 'react-native';
import { tokens } from '@ode/tokens/dist/react-native/tokens';

const styles = StyleSheet.create({
  button: {
    backgroundColor: tokens.color.brand.primary[500], // #4F7F4E
    paddingVertical: parseInt(tokens.spacing[3]), // 12
    paddingHorizontal: parseInt(tokens.spacing[6]), // 24
    borderRadius: parseInt(tokens.border.radius.md), // 8
    minHeight: parseInt(tokens.touchTarget.min), // 44
  },
  buttonText: {
    color: tokens.color.neutral.white,
    fontSize: parseInt(tokens.font.size.base), // 16
    fontWeight: tokens.font.weight.medium,
  }
});

function Button({ title, onPress }) {
  return (
    <TouchableOpacity style={styles.button} onPress={onPress}>
      <Text style={styles.buttonText}>{title}</Text>
    </TouchableOpacity>
  );
}
```

### Input Field

```jsx
import { StyleSheet, TextInput } from 'react-native';
import { tokens } from '@ode/tokens/dist/react-native/tokens';

const styles = StyleSheet.create({
  input: {
    backgroundColor: tokens.color.neutral.white,
    color: tokens.color.neutral[900],
    paddingVertical: parseInt(tokens.spacing[3]),
    paddingHorizontal: parseInt(tokens.spacing[4]),
    borderWidth: parseInt(tokens.border.width.thin),
    borderColor: tokens.color.neutral[300],
    borderRadius: parseInt(tokens.border.radius.sm),
    fontSize: parseInt(tokens.font.size.base),
    minHeight: parseInt(tokens.touchTarget.min),
  }
});

function Input({ value, onChangeText, placeholder }) {
  return (
    <TextInput
      style={styles.input}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
    />
  );
}
```

### Card Component

```jsx
import { StyleSheet, View, Text } from 'react-native';
import { tokens } from '@ode/tokens/dist/react-native/tokens';

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.color.neutral.white,
    padding: parseInt(tokens.spacing[6]),
    borderRadius: parseInt(tokens.border.radius.md),
    borderWidth: parseInt(tokens.border.width.thin),
    borderColor: tokens.color.neutral[200],
    ...tokens.shadow.reactNative.sm, // Spread shadow properties
  },
  cardHeader: {
    fontSize: parseInt(tokens.font.size.xl),
    fontWeight: tokens.font.weight.semibold,
    color: tokens.color.neutral[900],
    marginBottom: parseInt(tokens.spacing[4]),
  },
  cardBody: {
    fontSize: parseInt(tokens.font.size.base),
    color: tokens.color.neutral[600],
    lineHeight: parseInt(tokens.font.lineHeight.relaxed) * parseInt(tokens.font.size.base),
  }
});

function Card({ title, children }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardHeader}>{title}</Text>
      <Text style={styles.cardBody}>{children}</Text>
    </View>
  );
}
```

### Responsive Design

```jsx
import { StyleSheet, Dimensions } from 'react-native';
import { tokens } from '@ode/tokens/dist/react-native/tokens';

const { width } = Dimensions.get('window');
const isTablet = width >= parseInt(tokens.breakpoint.md);

const styles = StyleSheet.create({
  container: {
    padding: isTablet 
      ? parseInt(tokens.spacing[8]) 
      : parseInt(tokens.spacing[4]),
    maxWidth: isTablet 
      ? parseInt(tokens.container.lg) 
      : '100%',
  }
});
```

---

## Material UI Theming

### Creating Custom MUI Theme

```jsx
import { createTheme } from '@mui/material/styles';
import tokens from '@ode/tokens/dist/js/tokens';

const odeTheme = createTheme({
  palette: {
    primary: {
      main: tokens.color.brand.primary[500],
      light: tokens.color.brand.primary[400],
      dark: tokens.color.brand.primary[600],
      contrastText: tokens.color.neutral.white,
    },
    secondary: {
      main: tokens.color.brand.secondary[500],
      light: tokens.color.brand.secondary[400],
      dark: tokens.color.brand.secondary[600],
    },
    success: {
      main: tokens.color.semantic.success[500],
      light: tokens.color.semantic.success[50],
      dark: tokens.color.semantic.success[600],
    },
    error: {
      main: tokens.color.semantic.error[500],
      light: tokens.color.semantic.error[50],
      dark: tokens.color.semantic.error[600],
    },
    warning: {
      main: tokens.color.semantic.warning[500],
      light: tokens.color.semantic.warning[50],
      dark: tokens.color.semantic.warning[600],
    },
    info: {
      main: tokens.color.semantic.info[500],
      light: tokens.color.semantic.info[50],
      dark: tokens.color.semantic.info[600],
    },
    grey: {
      50: tokens.color.neutral[50],
      100: tokens.color.neutral[100],
      200: tokens.color.neutral[200],
      300: tokens.color.neutral[300],
      400: tokens.color.neutral[400],
      500: tokens.color.neutral[500],
      600: tokens.color.neutral[600],
      700: tokens.color.neutral[700],
      800: tokens.color.neutral[800],
      900: tokens.color.neutral[900],
    },
  },
  typography: {
    fontFamily: tokens.font.family.sans,
    fontSize: parseInt(tokens.font.size.base),
    h1: {
      fontSize: parseInt(tokens.font.size[5]),
      fontWeight: tokens.font.weight.bold,
      lineHeight: tokens.font.lineHeight.tight,
    },
    h2: {
      fontSize: parseInt(tokens.font.size[4]),
      fontWeight: tokens.font.weight.bold,
    },
    body1: {
      fontSize: parseInt(tokens.font.size.base),
      lineHeight: tokens.font.lineHeight.normal,
    },
  },
  spacing: parseInt(tokens.spacing[1]), // Base spacing unit (4px)
  shape: {
    borderRadius: parseInt(tokens.border.radius.md),
  },
  shadows: [
    'none',
    tokens.shadow.xs,
    tokens.shadow.sm,
    tokens.shadow.md,
    tokens.shadow.lg,
    tokens.shadow.xl,
    tokens.shadow['2xl'],
  ],
});

export default odeTheme;
```

### Using the Theme

```jsx
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import odeTheme from './theme';

function App() {
  return (
    <ThemeProvider theme={odeTheme}>
      <CssBaseline />
      {/* Your app components */}
    </ThemeProvider>
  );
}
```

---

## Common Patterns

### Color Utilities

```css
/* Text colors */
.text-primary { color: var(--color-neutral-900); }
.text-secondary { color: var(--color-neutral-600); }
.text-muted { color: var(--color-neutral-500); }

/* Background colors */
.bg-primary { background-color: var(--color-brand-primary-500); }
.bg-secondary { background-color: var(--color-brand-secondary-500); }
.bg-white { background-color: var(--color-neutral-white); }
.bg-gray-50 { background-color: var(--color-neutral-50); }

/* Border colors */
.border-light { border-color: var(--color-neutral-200); }
.border-medium { border-color: var(--color-neutral-300); }
```

### Spacing Utilities

```css
/* Padding */
.p-0 { padding: var(--spacing-0); }
.p-1 { padding: var(--spacing-1); }
.p-2 { padding: var(--spacing-2); }
.p-4 { padding: var(--spacing-4); }
.p-6 { padding: var(--spacing-6); }

/* Margin */
.m-0 { margin: var(--spacing-0); }
.m-4 { margin: var(--spacing-4); }
.m-6 { margin: var(--spacing-6); }
.mb-4 { margin-bottom: var(--spacing-4); }
.mt-6 { margin-top: var(--spacing-6); }
```

### Typography Utilities

```css
.text-xs { font-size: var(--font-size-xs); }
.text-sm { font-size: var(--font-size-sm); }
.text-base { font-size: var(--font-size-base); }
.text-lg { font-size: var(--font-size-lg); }
.text-xl { font-size: var(--font-size-xl); }

.font-light { font-weight: var(--font-weight-light); }
.font-regular { font-weight: var(--font-weight-regular); }
.font-medium { font-weight: var(--font-weight-medium); }
.font-bold { font-weight: var(--font-weight-bold); }
```

---

**For more information:**
- [Quick Start Guide](./README.md#quick-start) - Getting started with tokens
- [Design Tokens Specification](./DESIGN_TOKENS_SPECIFICATION.md#1-color-tokens) - Complete token reference

