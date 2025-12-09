# @ode/tokens

**ODE Design System - Unified Design Tokens**

A comprehensive design token package for the Open Data Ensemble (ODE) ecosystem. This package provides a single source of truth for colors, typography, spacing, and all design values used across React Native, React Web, and all ODE applications.

## What Are Design Tokens?

Design tokens are the **smallest pieces of design information** - like colors, spacing, and font sizes. Instead of hardcoding values like `#4F7F4E` or `16px` throughout your code, you use tokens like `color-brand-primary-500` or `spacing-4`.

**Benefits:**
- **Consistency** - Same values everywhere
- **Easy Updates** - Change once, update everywhere
- **Type Safety** - TypeScript definitions included
- **Multi-Platform** - Works for web, mobile, and more

## Installation

```bash
npm install @ode/tokens
```

## Quick Start

### For React Web (CSS)

```css
/* Import the CSS variables */
@import '@ode/tokens/dist/css/tokens.css';

/* Use tokens in your CSS */
.button {
  background-color: var(--color-brand-primary-500);
  padding: var(--spacing-3) var(--spacing-6);
  border-radius: var(--border-radius-md);
  color: var(--color-neutral-white);
}
```

### For React Web (JavaScript/TypeScript)

```javascript
import { colorBrandPrimary500, spacing3, spacing6 } from '@ode/tokens/dist/js/tokens';

const buttonStyle = {
  backgroundColor: colorBrandPrimary500,
  padding: `${spacing3} ${spacing6}`,
  borderRadius: '8px'
};
```

### For React Native

```javascript
import { tokens } from '@ode/tokens/dist/react-native/tokens';

const styles = StyleSheet.create({
  button: {
    backgroundColor: tokens.color.brand.primary[500], // #4F7F4E
    paddingVertical: tokens.spacing[3], // 12
    paddingHorizontal: tokens.spacing[6], // 24
    borderRadius: 8
  }
});
```

## Package Structure

```
packages/tokens/
├── src/tokens/           # Source token files (JSON)
│   ├── base/            # Foundation tokens
│   │   ├── colors.json
│   │   ├── typography.json
│   │   ├── spacing.json
│   │   ├── borders.json
│   │   ├── shadows.json
│   │   ├── motion.json
│   │   ├── z-index.json
│   │   └── opacity.json
│   ├── semantic/        # Meaningful tokens
│   │   └── colors.json  # Success, error, warning, info
│   ├── components/      # Component-specific tokens
│   │   └── icons.json
│   ├── layout/          # Layout tokens
│   │   ├── breakpoints.json
│   │   ├── containers.json
│   │   └── grid.json
│   └── accessibility/   # Accessibility tokens
│       ├── contrast.json
│       ├── focus.json
│       └── touch-targets.json
├── dist/                # Generated outputs (auto-created)
│   ├── css/            # CSS variables
│   ├── js/             # JavaScript/TypeScript
│   ├── json/           # Raw JSON
│   └── react-native/   # React Native format
├── config.json         # Style Dictionary configuration
└── package.json
```

## Available Tokens

For a complete list of all available tokens with detailed specifications, see the [Design Tokens Specification](./DESIGN_TOKENS_SPECIFICATION.md). Key sections:
- [Color Tokens](./DESIGN_TOKENS_SPECIFICATION.md#1-color-tokens)
- [Typography Tokens](./DESIGN_TOKENS_SPECIFICATION.md#2-typography-tokens)
- [Spacing Tokens](./DESIGN_TOKENS_SPECIFICATION.md#3-spacing-tokens)
- [Layout Tokens](./DESIGN_TOKENS_SPECIFICATION.md#7-layout-tokens)
- [Accessibility Tokens](./DESIGN_TOKENS_SPECIFICATION.md#10-accessibility-tokens)

**Quick Reference:**
- **Colors**: Brand (primary green, secondary gold), neutral grays, semantic colors (success, error, warning, info)
- **Typography**: Font families, sizes (12px-60px), weights, line heights, letter spacing
- **Spacing**: 4px-based scale (0-96px)
- **Borders**: Radius and width tokens
- **Shadows**: Web CSS shadows + React Native shadow objects
- **Motion**: Duration and easing functions
- **Layout**: Breakpoints, containers, grid system
- **Accessibility**: Contrast ratios, focus states, touch targets

## Development

### Building Tokens

```bash
cd packages/tokens
npm install
npm run build
```

This generates all output formats in the `dist/` directory:
- CSS variables (`dist/css/tokens.css`)
- JavaScript/TypeScript (`dist/js/tokens.js` and `tokens.d.ts`)
- JSON (`dist/json/tokens.json`)
- React Native format (`dist/react-native/tokens.js`)

### Adding New Tokens

For detailed instructions on adding new tokens, naming conventions, and best practices, see the [Adding New Tokens section](./CONTRIBUTING.md#adding-new-tokens) in the Contributing Guide.

## Usage Examples

For comprehensive usage examples including CSS, React Web, React Native, and Material UI theming, see the [Examples Guide](./EXAMPLES.md). Key sections:
- [CSS Examples](./EXAMPLES.md#css-examples)
- [React Web Examples](./EXAMPLES.md#react-web-examples)
- [React Native Examples](./EXAMPLES.md#react-native-examples)
- [Material UI Theming](./EXAMPLES.md#material-ui-theming)

## Design Principles

Our design tokens follow these principles:

1. **Accessibility First** - All colors meet WCAG 2.1 AA contrast ratios
2. **Consistency** - Unified visual language across all platforms
3. **Simplicity** - Clear, predictable token names
4. **Scalability** - Easy to extend and maintain

## Token Categories Explained

### Base Tokens
Foundation values that rarely change: colors, typography, spacing, borders, shadows, motion, z-index, opacity.

### Semantic Tokens
Tokens with meaning: success (green), error (red), warning (orange), info (blue). These can change if the design system evolves.

### Component Tokens
Values specific to components: icon sizes, avatar sizes, logo sizes.

### Layout Tokens
Structure-related: breakpoints, container widths, grid system.

### Accessibility Tokens
Inclusion-focused: contrast ratios, focus states, minimum touch target sizes.

## Updating Tokens

For detailed instructions on updating tokens, see the [Modifying Existing Tokens section](./CONTRIBUTING.md#modifying-existing-tokens) in the Contributing Guide.

## Contributing

We welcome contributions! For guidelines on adding new tokens, modifying existing ones, and following our conventions, see the [Contributing Guide](./CONTRIBUTING.md). Key sections:
- [Adding New Tokens](./CONTRIBUTING.md#adding-new-tokens)
- [Modifying Existing Tokens](./CONTRIBUTING.md#modifying-existing-tokens)
- [Naming Conventions](./CONTRIBUTING.md#naming-conventions)
- [Testing Your Changes](./CONTRIBUTING.md#testing-your-changes)

## License

MIT

## Documentation

- **[Quick Start Guide](./QUICK_START.md)** - Get started in a few minutes
- **[Design Tokens Specification](./DESIGN_TOKENS_SPECIFICATION.md)** - Complete token reference with all values
- **[Examples Guide](./EXAMPLES.md)** - Real-world usage examples for CSS, React, React Native, and Material UI
- **[Contributing Guide](./CONTRIBUTING.md)** - How to add, modify, and update tokens
- **[Setup Complete](./SETUP_COMPLETE.md)** - Package structure and overview

## Related

- [ODE Design System Discussion](https://github.com/OpenDataEnsemble/ode/discussions/29)
- [Style Dictionary Documentation](https://amzn.github.io/style-dictionary/)

---

**Maintained by**: ODE Design System Team  
**Version**: 1.0.0

