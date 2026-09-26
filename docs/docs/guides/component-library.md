---
sidebar_position: 3
---

# Component Library

ODE includes a shared component library that provides consistent UI components and design tokens across all applications.

## Overview

The ODE component library (`@ode/components` and `@ode/tokens`) ensures visual consistency and provides reusable components for both React Native and React Web applications.

## Package Structure

```
packages/
├── tokens/              # Design tokens and design system
│   ├── config.json      # Token definitions
│   ├── src/            # Source tokens
│   └── dist/           # Built outputs
└── components/          # React components
    ├── src/
    │   ├── react-native/  # React Native components
    │   ├── react-web/      # React web components
    │   └── shared/         # Shared utilities
    └── dist/           # Built outputs
```

## Design Tokens (`@ode/tokens`)

Design tokens are the single source of truth for design values across ODE applications.

### Token Categories

- **Colors**: Primary, secondary, surface, background colors
- **Typography**: Font families, sizes, weights, line heights
- **Spacing**: Margin and padding values
- **Borders**: Border radius, widths
- **Shadows**: Elevation shadows

### Using Tokens

```javascript
// Import tokens in React Native
import tokens from '@ode/tokens';

// Use color tokens
const primaryColor = tokens.colors.primary.main;

// Use spacing tokens
const spacing = tokens.spacing.md;
```

```css
/* Use tokens in CSS */
.button {
  background-color: var(--ode-colors-primary-main);
  padding: var(--ode-spacing-md);
  border-radius: var(--ode-border-radius-md);
}
```

### Token Outputs

The token system generates multiple outputs:

- **React Native**: JavaScript object for RN styling
- **CSS Variables**: For web applications
- **JSON**: For other platforms
- **TypeScript**: Type definitions for all tokens

## Components (`@ode/components`)

### Cross-Platform Components

Components are designed to work across React Native and React Web:

```javascript
// React Native usage
import { Button } from '@ode/components/react-native';

// React Web usage  
import { Button } from '@ode/components/react-web';
```

### Available Components

#### Core Components
- **Button**: Primary, secondary, outlined variants
- **Card**: Container with elevation and styling
- **Input**: Text input with validation states
- **Checkbox**: Boolean selection component
- **Radio**: Single selection component

#### Layout Components
- **Container**: Responsive container
- **Stack**: Flexible spacing (horizontal/vertical)
- **Grid**: CSS Grid layout system
- **Flex**: Flexbox layout utilities

#### Navigation Components
- **Header**: App header with navigation
- **Tabs**: Tab navigation system
- **Drawer**: Side navigation drawer
- **Breadcrumb**: Navigation breadcrumbs

#### Feedback Components
- **Alert**: Information messages
- **Toast**: Temporary notifications
- **Loading**: Loading indicators
- **Progress**: Progress bars and spinners

### Component Props

All components follow consistent prop patterns:

```javascript
<Button
  variant="primary"      // primary, secondary, outlined
  size="md"             // sm, md, lg
  disabled={false}
  onPress={handleClick}
  style={customStyle}
>
  Button Text
</Button>
```

### Theme Integration

Components automatically integrate with the design token system:

```javascript
// Components use tokens internally
const Button = ({ variant, size, ...props }) => {
  const theme = useTheme();
  
  const styles = StyleSheet.create({
    button: {
      backgroundColor: theme.colors[variant].main,
      padding: theme.spacing[size],
      borderRadius: theme.borderRadius.md,
    },
  });
  
  return <TouchableOpacity style={styles.button} {...props} />;
};
```

## Development

### Setting Up Local Development

1. **Install dependencies**:
```bash
cd packages/tokens && pnpm install
cd ../components && pnpm install
```

2. **Build tokens**:
```bash
cd packages/tokens && pnpm run build
```

3. **Use packages in an ODE app** (Formulus, formplayer, portal use `file:` dependencies in `package.json`):
```bash
# Example in package.json:
# "@ode/tokens": "file:../packages/tokens"
# "@ode/components": "file:../packages/components"
# Then from that app directory:
pnpm install
```

### Adding New Tokens

1. **Update token definition**:
```json
// packages/tokens/config.json
{
  "color": {
    "brand": {
      "primary": {
        "value": "{colors.blue.500}",
        "type": "color"
      }
    }
  }
}
```

2. **Build tokens**:
```bash
pnpm run build
```

3. **Use in components**:
```javascript
const styles = StyleSheet.create({
  container: {
    backgroundColor: tokens.colors.brand.primary.value,
  },
});
```

### Creating New Components

1. **Create component files**:
```javascript
// packages/components/src/shared/Button.js
export const Button = ({ children, ...props }) => {
  // Shared component logic
};

// packages/components/src/react-native/Button.native.js
export { Button } from '../shared/Button';

// packages/components/src/react-web/Button.web.js
export { Button } from '../shared/Button';
```

2. **Export from index**:
```javascript
// packages/components/src/react-native/index.js
export { Button } from './Button';
```

3. **Add TypeScript types**:
```typescript
// packages/components/src/shared/types.ts
export interface ButtonProps {
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  onPress?: () => void;
}
```

## Usage in Applications

### React Native (Formulus)

```javascript
// import components
import { Button, Card, Input } from '@ode/components/react-native';
import { useTheme } from '@ode/tokens';

function MyScreen() {
  const theme = useTheme();
  
  return (
    <Card style={{ padding: theme.spacing.md }}>
      <Input placeholder="Enter text" />
      <Button variant="primary" onPress={handleSubmit}>
        Submit
      </Button>
    </Card>
  );
}
```

### React Web (Portal, Custom Apps)

```javascript
// import components
import { Button, Card, Input } from '@ode/components/react-web';

function MyComponent() {
  return (
    <Card>
      <Input placeholder="Enter text" />
      <Button variant="primary" onClick={handleSubmit}>
        Submit
      </Button>
    </Card>
  );
}
```

### Custom App Integration

Custom applications can use the component library for consistent styling:

```javascript
// In custom app
import { Button, Card } from '@ode/components/react-web';
import { buildTheme } from './theme';

function App() {
  const theme = buildTheme('light');
  
  return (
    <ThemeProvider theme={theme}>
      <Card>
        <Button variant="primary">Click me</Button>
      </Card>
    </ThemeProvider>
  );
}
```

## Best Practices

### Token Usage
- **Use tokens, not hard-coded values**: Always reference design tokens
- **Semantic naming**: Use semantic token names (e.g., `primary` not `blue-500`)
- **Consistent spacing**: Use spacing tokens for all margins/padding

### Component Development
- **Cross-platform compatibility**: Ensure components work on both platforms
- **Accessibility**: Include proper accessibility attributes
- **Performance**: Optimize for mobile and web performance
- **TypeScript**: Use TypeScript for all components

### Theming
- **Theme agnostic**: Components should work with any theme
- **Dark mode support**: Ensure components work in dark mode
- **Custom themes**: Allow applications to override tokens

## Migration Guide

### From Hard-coded Styles

**Before:**
```javascript
const styles = StyleSheet.create({
  button: {
    backgroundColor: '#1976d2',
    padding: 16,
    borderRadius: 8,
  },
});
```

**After:**
```javascript
const styles = StyleSheet.create({
  button: {
    backgroundColor: tokens.colors.primary.main,
    padding: tokens.spacing.md,
    borderRadius: tokens.borderRadius.md,
  },
});
```

### From Custom Components

**Before:**
```javascript
// Custom button implementation
export const MyButton = ({ children, onPress }) => (
  <TouchableOpacity onPress={onPress}>
    <Text>{children}</Text>
  </TouchableOpacity>
);
```

**After:**
```javascript
// Use library component
import { Button } from '@ode/components/react-native';

export const MyButton = ({ children, onPress }) => (
  <Button onPress={onPress}>{children}</Button>
);
```

## Troubleshooting

### Common Issues

**Components not found:**
- Ensure proper import path: `@ode/components/react-native` or `@ode/components/react-web`
- Check that packages are installed and linked correctly

**Tokens not working:**
- Verify tokens are built: `pnpm run build` in tokens package
- Check import path: `@ode/tokens`

**Theme not applying:**
- Ensure ThemeProvider wrapper for web components
- Check that tokens are properly integrated

**Platform-specific issues:**
- Verify you're importing from the correct platform package
- Check platform-specific file extensions (.native.js, .web.js)

This component library provides a solid foundation for building consistent, maintainable applications across the ODE ecosystem.
