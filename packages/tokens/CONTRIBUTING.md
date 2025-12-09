# Contributing to ODE Design Tokens

Thank you for contributing to the ODE Design System! This guide will help you add, modify, or update design tokens.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Token Structure](#token-structure)
3. [Adding New Tokens](#adding-new-tokens)
4. [Modifying Existing Tokens](#modifying-existing-tokens)
5. [Naming Conventions](#naming-conventions)
6. [Testing Your Changes](#testing-your-changes)
7. [Commit Guidelines](#commit-guidelines)

---

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

### Setup

```bash
# Navigate to the tokens package
cd packages/tokens

# Install dependencies
npm install

# Build tokens to see current output
npm run build
```

---

## Token Structure

Tokens are organized into categories:

```
src/tokens/
├── base/              # Foundation tokens (colors, typography, spacing, etc.)
├── semantic/          # Meaningful tokens (success, error, warning, info)
├── components/        # Component-specific tokens (icons, avatars, logos)
├── layout/           # Layout tokens (breakpoints, containers, grid)
└── accessibility/    # Accessibility tokens (contrast, focus, touch targets)
```

### When to Use Each Category

- **Base**: Core design values that rarely change (colors, spacing, typography)
- **Semantic**: Tokens with meaning (success = green, error = red)
- **Components**: Values specific to UI components
- **Layout**: Structure-related values (breakpoints, containers)
- **Accessibility**: Inclusion-focused values (contrast, touch targets)

---

## Adding New Tokens

### Step 1: Choose the Right File

Determine which category your token belongs to and edit the appropriate JSON file.

**Example**: Adding a new color shade
- File: `src/tokens/base/colors.json`
- Category: Base (foundation)

**Example**: Adding a new icon size
- File: `src/tokens/components/icons.json`
- Category: Components

### Step 2: Add the Token

Follow the existing structure in the JSON file.

**Example**: Adding a new spacing value

```json
{
  "spacing": {
    "0": { "value": "0px" },
    "1": { "value": "4px" },
    // ... existing values ...
    "28": { "value": "112px" }  // ← New token
  }
}
```

### Step 3: Follow Naming Conventions

See [Naming Conventions](#naming-conventions) below.

### Step 4: Build and Test

```bash
npm run build
```

Check the generated files in `dist/` to ensure your token appears correctly.

---

## Modifying Existing Tokens

### Changing a Value

1. Open the appropriate JSON file
2. Update the `value` field
3. Build: `npm run build`
4. Test in your application

**Example**: Changing the primary brand color

```json
// Before
"500": { "value": "#4F7F4E" }

// After
"500": { "value": "#5A8F59" }
```

### Removing a Token

1. Remove the token from the JSON file
2. Build: `npm run build`
3. Check for any breaking changes in dependent projects

**⚠️ Warning**: Removing tokens can break existing code. Consider deprecating instead.

---

## Naming Conventions

### Pattern

```
{category}-{property}-{variant}-{scale}
```

### Examples

| Token | Breakdown |
|-------|-----------|
| `color-brand-primary-500` | category: color, property: brand, variant: primary, scale: 500 |
| `spacing-4` | category: spacing, scale: 4 |
| `font-size-base` | category: font, property: size, variant: base |
| `border-radius-md` | category: border, property: radius, variant: md |

### Rules

1. **Use kebab-case** (lowercase with hyphens)
2. **Be descriptive** but concise
3. **Follow existing patterns** in the file
4. **Use semantic names** when possible (e.g., `base` instead of `16`)

### Common Patterns

- **Colors**: `color-{category}-{name}-{shade}`
  - `color-brand-primary-500`
  - `color-neutral-900`
  - `color-semantic-success-500`

- **Spacing**: `spacing-{number}`
  - `spacing-0`, `spacing-1`, `spacing-4`, `spacing-24`

- **Typography**: `font-{property}-{variant}`
  - `font-size-base`
  - `font-weight-bold`
  - `line-height-normal`

- **Borders**: `border-{property}-{variant}`
  - `border-radius-md`
  - `border-width-thin`

---

## Testing Your Changes

### 1. Build Tokens

```bash
npm run build
```

This generates all output formats:
- `dist/css/tokens.css` - CSS variables
- `dist/js/tokens.js` - JavaScript
- `dist/js/tokens.d.ts` - TypeScript definitions
- `dist/json/tokens.json` - Raw JSON
- `dist/react-native/tokens.js` - React Native format

### 2. Verify Output

Check that your token appears in all output formats:

```bash
# Check CSS output
grep "your-token-name" dist/css/tokens.css

# Check JS output
grep "yourTokenName" dist/js/tokens.js
```

### 3. Test in Application

Use your token in a test component:

**CSS:**
```css
.test {
  color: var(--color-your-new-token);
}
```

**React Native:**
```javascript
import { tokens } from '@ode/tokens/dist/react-native/tokens';

const style = {
  color: tokens.color.your.new.token
};
```

### 4. Check TypeScript (if applicable)

If using TypeScript, verify autocomplete works:

```typescript
import { colorYourNewToken } from '@ode/tokens/dist/js/tokens';
```

---

## Commit Guidelines

### Commit Message Format

```
type(scope): description

[optional body]

[optional footer]
```

### Types

- `feat`: New token or token category
- `fix`: Bug fix in token values
- `docs`: Documentation updates
- `style`: Formatting changes (no token changes)
- `refactor`: Restructuring token files
- `chore`: Build process or tooling changes

### Examples

```
feat(tokens): add spacing-28 token for large margins

fix(tokens): correct primary brand color hex value

docs(tokens): update README with new token examples
```

### What to Commit

✅ **Do commit:**
- Source JSON files (`src/tokens/**/*.json`)
- Generated files (`dist/**/*`)
- Documentation updates
- Configuration changes

❌ **Don't commit:**
- `node_modules/`
- Build artifacts (unless part of release)
- Personal IDE settings

---

## Common Scenarios

### Adding a New Color Scale

1. Edit `src/tokens/base/colors.json`
2. Add the new color scale following existing pattern
3. Build and test

```json
{
  "color": {
    "brand": {
      "tertiary": {
        "50": { "value": "#..." },
        "500": { "value": "#..." },
        "900": { "value": "#..." }
      }
    }
  }
}
```

### Adding a New Breakpoint

1. Edit `src/tokens/layout/breakpoints.json`
2. Add the new breakpoint
3. Update container sizes if needed
4. Build and test

### Adding Component-Specific Tokens

1. Create or edit a file in `src/tokens/components/`
2. Add component-specific tokens
3. Document usage in EXAMPLES.md
4. Build and test

---

## Questions?

- Check the [Usage Examples section](./README.md#usage-examples) in README.md for usage examples
- See [Design Tokens Specification](./DESIGN_TOKENS_SPECIFICATION.md#1-color-tokens) for complete token reference
- Review [Examples Guide](./EXAMPLES.md#css-examples) for implementation patterns
- Open an issue or discussion on GitHub

---

**Thank you for contributing to the ODE Design System!** 

