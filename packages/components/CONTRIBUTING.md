# Contributing to ODE Components

Thank you for contributing to the ODE Component Library! This guide will help you add, modify, or update components.

## Structure

```
packages/components/
├── src/
│   ├── shared/           # Platform-agnostic types and utilities
│   ├── react-web/        # React Web implementations
│   └── react-native/     # React Native implementations
├── package.json
└── README.md
```

## Adding a New Component

1. **Define Types** (in `src/shared/types.ts`):
   ```typescript
   export interface MyComponentProps {
     children: React.ReactNode;
     // ... other props
   }
   ```

2. **Create React Web Implementation** (`src/react-web/MyComponent.tsx`):
   - Use CSS for styling
   - Import tokens from `@ode/tokens/dist/json/tokens.json`
   - Follow the existing component patterns

3. **Create React Native Implementation** (`src/react-native/MyComponent.tsx`):
   - Use StyleSheet for styling
   - Import tokens from `@ode/tokens/dist/react-native/tokens`
   - Match the API of the web version

4. **Export** from platform-specific index files:
   - `src/react-web/index.ts`
   - `src/react-native/index.ts`

## Design Principles

All components must follow:

1. **Minimalism** - Clean, uncluttered design
2. **Consistency** - Use ODE tokens for all values
3. **Accessibility** - WCAG compliant, proper ARIA attributes
4. **Responsiveness** - Works on all screen sizes
5. **Performance** - Lightweight and optimized

## Button Component Special Requirements

The Button component has unique requirements:

- **Fading Border**: Border fades on one end (left button fades right, right button fades left)
- **Hover States**: Background fills on hover, text changes to contrast color
- **Paired Buttons**: When two buttons are together, they have opposite styles
- **Smooth Transitions**: All state changes use smooth animations

## Testing

- Test on both platforms (web and native)
- Verify accessibility with screen readers
- Test with different screen sizes
- Ensure dark mode support

## Commit Guidelines

Follow conventional commits:
- `feat(components): add new Card component`
- `fix(components): fix Button hover state`
- `docs(components): update README`
