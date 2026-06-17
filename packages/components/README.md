# @ode/components

**ODE Design System - Unified UI Components**

A comprehensive component library for the Open Data Ensemble (ODE) ecosystem. This package provides platform-specific implementations of modern, minimalist UI components that use ODE design tokens for consistent styling across React Native and React Web applications.

## Features

- **Modern Minimalist Design** - Clean, simple, and aesthetically beautiful components
- **Platform-Specific** - Optimized implementations for React Native and React Web
- **Token-Based** - Built on `@ode/tokens` for consistent design
- **Accessible** - supports `accessibilityLabel` (web: `aria-label`, React Native: native accessibility props where supported)
- **Responsive** - Works seamlessly across all device sizes
- **Dark Mode Ready** - Supports light and dark themes

## Installation

```bash
pnpm install @ode/components @ode/tokens
```

## Quick Start

### React Web

```tsx
import { Button, ButtonGroup, Input, Card, Badge } from '@ode/components/react-web';

function App() {
  return (
    <div>
      <Button variant="primary" onPress={() => console.log('Clicked!')}>
        Click Me
      </Button>
      
      <ButtonGroup variant="primary">
        <Button onPress={() => console.log('First')}>First</Button>
        <Button onPress={() => console.log('Second')}>Second</Button>
      </ButtonGroup>
      
      <Input
        label="Email"
        placeholder="Enter your email"
        onChangeText={(text) => console.log(text)}
      />
      
      <Card title="Welcome" subtitle="Get started">
        <p>Card content goes here</p>
      </Card>
      
      <Badge variant="success">Active</Badge>
    </div>
  );
}
```

### React Native

```tsx
import { Button, ButtonGroup, Input, Card, Badge } from '@ode/components/react-native';

function App() {
  return (
    <View>
      <Button variant="primary" onPress={() => console.log('Clicked!')}>
        Click Me
      </Button>
      
      <ButtonGroup variant="primary">
        <Button onPress={() => console.log('First')}>First</Button>
        <Button onPress={() => console.log('Second')}>Second</Button>
      </ButtonGroup>
      
      <Input
        label="Email"
        placeholder="Enter your email"
        onChangeText={(text) => console.log(text)}
      />
      
      <Card title="Welcome" subtitle="Get started">
        <Text>Card content goes here</Text>
      </Card>
      
      <Badge variant="success">Active</Badge>
    </View>
  );
}
```

## Components

### Button

Modern minimalist button with transparent/default styling and token-based colors. When used inside a `ButtonGroup`, paired buttons automatically use contrasting variants for visual emphasis.

**Features:**
- Transparent background with border-colored text by default
- On hover/active: background fills with the border color, and text switches to a contrasting color
- Automatic contrasting styling when paired in a `ButtonGroup`

```tsx
// Single button
<Button variant="primary" onPress={handleClick}>
  Click Me
</Button>

// Paired buttons with opposite styles
<ButtonGroup variant="primary">
  <Button onPress={handleFirst}>First</Button>
  <Button onPress={handleSecond}>Second</Button>
</ButtonGroup>
```

**Props:**
- `variant`: `'primary' | 'secondary' | 'neutral' | 'danger'` (default: `'primary'`)
- `size`: `'small' | 'medium' | 'large'` (default: `'medium'`)
- `disabled`: `boolean` (default: `false`)
- `loading`: `boolean` (default: `false`)
- `onPress`: `() => void`

### Input

Clean, minimalist input field with focus states and error handling.

```tsx
<Input
  label="Email Address"
  placeholder="Enter your email"
  value={email}
  onChangeText={setEmail}
  error={errors.email}
  required
/>
```

**Props:**
- `label`: `string`
- `placeholder`: `string`
- `value`: `string`
- `onChangeText`: `(text: string) => void`
- `error`: `string`
- `disabled`: `boolean`
- `required`: `boolean`
- `type`: `'text' | 'email' | 'password' | 'number' | 'tel'` (web only)

### Card

Modern card component with subtle elevation and optional click handler.

```tsx
<Card
  title="Card Title"
  subtitle="Card subtitle"
  elevated
  onPress={handleCardClick}
>
  <p>Card content</p>
</Card>
```

**Props:**
- `title`: `string`
- `subtitle`: `string`
- `elevated`: `boolean` (default: `true`)
- `onPress`: `() => void` (makes card clickable)

### Badge

Minimalist badge for labels and status indicators.

```tsx
<Badge variant="success" size="medium">
  Active
</Badge>
```

**Props:**
- `variant`: `'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info' | 'neutral'` (default: `'neutral'`)
- `size`: `'small' | 'medium' | 'large'` (default: `'medium'`)

## Design Principles

All components follow these design principles:

1. **Minimalism** - Clean, uncluttered interfaces that enhance usability
2. **Consistency** - Unified design language using ODE tokens
3. **Accessibility** - supports `accessibilityLabel`/ARIA where applicable
4. **Responsiveness** - Adapts seamlessly to all screen sizes
5. **Performance** - Lightweight and optimized for fast rendering

## Button Design Details

The button component features a unique design inspired by modern minimalist aesthetics:

- **Default State**: Transparent background with colored border and matching text
- **Hover State**: Background fills with border color, text changes to a high-contrast color
- **Paired Buttons**: When two buttons are together, they use contrasting color variants
- **Smooth Transitions**: All state changes use smooth cubic-bezier animations

## Platform Differences

While components share the same API, platform-specific implementations optimize for:

- **React Web**: Uses CSS for styling, supports hover states, uses semantic HTML
- **React Native**: Uses StyleSheet, supports press states, uses native components

## Contributing

See the main [ODE README](../../README.md) for contribution guidelines.

## License

MIT
