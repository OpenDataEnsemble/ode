# Quick Start Guide

Get up and running with ODE Design Tokens in a few minutes!

## Installation

```bash
cd packages/tokens
npm install
npm run build
```

## Using Tokens

### Option 1: CSS Variables (Recommended for Web)

```css
/* Import in your CSS file */
@import '@ode/tokens/dist/css/tokens.css';

/* Use tokens */
.button {
  background-color: var(--color-brand-primary-500);
  padding: var(--spacing-3) var(--spacing-6);
  border-radius: var(--border-radius-md);
}
```

### Option 2: JavaScript/TypeScript

```javascript
// Import tokens
import { 
  colorBrandPrimary500, 
  spacing3, 
  spacing6 
} from '@ode/tokens/dist/js/tokens';

// Use in your code
const buttonStyle = {
  backgroundColor: colorBrandPrimary500,
  padding: `${spacing3} ${spacing6}`
};
```

### Option 3: React Native

```javascript
// Import tokens
import { tokens } from '@ode/tokens/dist/react-native/tokens';

// Use in StyleSheet
const styles = StyleSheet.create({
  button: {
    backgroundColor: tokens.color.brand.primary[500],
    paddingVertical: parseInt(tokens.spacing[3]),
    paddingHorizontal: parseInt(tokens.spacing[6])
  }
});
```

## Common Tokens

### Colors
- Primary: `--color-brand-primary-500` (#4F7F4E)
- Secondary: `--color-brand-secondary-500` (#E9B85B)
- Success: `--color-semantic-success-500` (#34C759)
- Error: `--color-semantic-error-500` (#F44336)

### Spacing
- Small: `--spacing-2` (8px)
- Default: `--spacing-4` (16px)
- Large: `--spacing-6` (24px)

### Typography
- Base: `--font-size-base` (16px)
- Large: `--font-size-lg` (18px)
- Heading: `--font-size-2xl` (24px)

## Next Steps

- Read the [README.md](./README.md#quick-start) for complete documentation
- Check [EXAMPLES.md](./EXAMPLES.md#css-examples) for usage patterns
- See [DESIGN_TOKENS_SPECIFICATION.md](./DESIGN_TOKENS_SPECIFICATION.md#1-color-tokens) for all available tokens

---

**Need help?** Check the main [README.md](./README.md#quick-start) or open an issue on GitHub.

