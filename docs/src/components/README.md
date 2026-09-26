# ODE Design System Components

A collection of reusable React components built with ODE design tokens. All components support dark mode, are fully accessible, and follow the ODE design system specifications.

## Components

### Alert
Display contextual feedback messages with semantic variants.

```tsx
import { Alert } from '@site/src/components';

<Alert variant="info" title="Information">
  This is an informational message.
</Alert>

<Alert variant="success">Operation completed successfully!</Alert>
<Alert variant="warning" title="Warning">Please review your input.</Alert>
<Alert variant="error" title="Error">Something went wrong.</Alert>
```

**Props:**
- `variant`: `'info' | 'success' | 'warning' | 'error'` (default: `'info'`)
- `size`: `'sm' | 'md'` (default: `'md'`)
- `title`: Optional title text
- `icon`: Optional custom icon element
- `children`: Alert message content

---

### Badge
Small status indicators and labels.

```tsx
import { Badge } from '@site/src/components';

<Badge variant="primary">New</Badge>
<Badge variant="success" size="sm">Active</Badge>
<Badge variant="warning">Pending</Badge>
```

**Props:**
- `variant`: `'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info' | 'neutral'` (default: `'primary'`)
- `size`: `'sm' | 'md'` (default: `'md'`)

---

### Button
Interactive button component with multiple variants and sizes.

```tsx
import { Button, ButtonGroup } from '@site/src/components';

<Button variant="primary" size="md">Click me</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>

{/* Pill buttons with fading borders - perfect for pairs */}
<ButtonGroup>
  <Button variant="pill-light">DIVE IN NOW</Button>
  <Button variant="pill-dark">GET IN TOUCH</Button>
</ButtonGroup>

<Button href="/docs/guide">Link Button</Button>
```

**Props:**
- `variant`: `'primary' | 'secondary' | 'outline' | 'ghost' | 'pill-light' | 'pill-dark'` (default: `'primary'`)
  - `pill-light`: Light style with transparent background, dark border/text, fade on left side
  - `pill-dark`: Dark style with filled background, light text, fade on right side
- `size`: `'sm' | 'md' | 'lg'` (default: `'md'`)
- `disabled`: Boolean
- `href` or `to`: Renders as a link instead of button
- `onClick`: Click handler (when used as button)

**Pill Button Behavior:**
- `pill-light`: Default state has transparent background with dark border/text. On hover, fills with light background.
- `pill-dark`: Default state has dark filled background with light text. On hover, darkens further.
- When paired together, they create opposite visual states perfect for toggle or action pairs.

---

### CodeBlock
Enhanced code block with optional title and line numbers.

```tsx
import { CodeBlock } from '@site/src/components';

<CodeBlock language="typescript" title="example.ts">
{`function greet(name: string) {
  return \`Hello, \${name}!\`;
}`}
</CodeBlock>
```

**Props:**
- `language`: Code language for syntax highlighting
- `title`: Optional title shown in header
- `showLineNumbers`: Boolean (default: `false`)

---

### Container
Responsive container with max-width constraints.

```tsx
import { Container } from '@site/src/components';

<Container size="lg">
  <h1>Content</h1>
</Container>
```

**Props:**
- `size`: `'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full'` (default: `'lg'`)

---

### Divider
Visual separator with optional text.

```tsx
import { Divider } from '@site/src/components';

<Divider />
<Divider variant="dashed" spacing="lg" />
<Divider>Or</Divider>
<Divider orientation="vertical" />
```

**Props:**
- `variant`: `'solid' | 'dashed' | 'dotted'` (default: `'solid'`)
- `orientation`: `'horizontal' | 'vertical'` (default: `'horizontal'`)
- `spacing`: `'none' | 'sm' | 'md' | 'lg'` (default: `'md'`)
- `children`: Optional text to display in center

---

### Spacer
Consistent spacing utility component.

```tsx
import { Spacer } from '@site/src/components';

<Spacer size={4} axis="y" />
<Spacer size={8} axis="x" />
<Spacer size={12} />
```

**Props:**
- `size`: `0 | 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12 | 16 | 20 | 24`
- `axis`: `'x' | 'y' | 'both'` (default: `'both'`)

---

### Tag
Categorization tags with optional remove functionality.

```tsx
import { Tag } from '@site/src/components';

<Tag variant="primary">React</Tag>
<Tag variant="secondary" size="sm">TypeScript</Tag>
<Tag removable onRemove={() => console.log('removed')}>
  Removable
</Tag>
```

**Props:**
- `variant`: `'primary' | 'secondary' | 'neutral'` (default: `'neutral'`)
- `size`: `'sm' | 'md'` (default: `'md'`)
- `removable`: Boolean (default: `false`)
- `onRemove`: Callback when remove button is clicked

---

### Tooltip
Contextual information on hover/focus.

```tsx
import { Tooltip } from '@site/src/components';

<Tooltip content="This is helpful information" position="top">
  <button>Hover me</button>
</Tooltip>
```

**Props:**
- `content`: Tooltip content
- `position`: `'top' | 'bottom' | 'left' | 'right'` (default: `'top'`)
- `delay`: Delay in milliseconds before showing (default: `200`)

---

### ButtonGroup
Container for grouping buttons together, especially useful for pill button pairs.

```tsx
import { ButtonGroup, Button } from '@site/src/components';

<ButtonGroup>
  <Button variant="pill-light">Option 1</Button>
  <Button variant="pill-dark">Option 2</Button>
</ButtonGroup>
```

**Props:**
- `children`: Button elements to group together
- `className`: Optional additional CSS classes

---

## Design Tokens

All components use ODE design tokens defined in `src/css/ode-tokens.css`. These include:

- **Colors**: Brand (primary/secondary), semantic (success/error/warning/info), neutral
- **Spacing**: 4px base unit scale (0-24)
- **Typography**: Font families, sizes, weights, line heights
- **Borders**: Radius and width variants
- **Shadows**: Elevation levels
- **Motion**: Duration and easing functions
- **Layout**: Breakpoints and container max-widths

## Dark Mode

All components automatically support dark mode through the `[data-theme='dark']` selector. No additional configuration needed.

## Accessibility

Components follow accessibility best practices:
- Proper ARIA attributes
- Keyboard navigation support
- Focus management
- Semantic HTML elements
- Color contrast compliance

## Usage in MDX

Components can be imported and used directly in MDX files:

```mdx
import { Alert, Button, Badge } from '@site/src/components';

<Alert variant="info">
  This works in MDX!
</Alert>

<Button href="/docs">Get Started</Button>
```
