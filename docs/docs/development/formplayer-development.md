---
sidebar_position: 4
---

# Formplayer Development

Complete guide for developing the Formplayer form rendering component.

## Overview

Formplayer is a React web application that renders JSON Forms. It runs within WebViews in the Formulus mobile app.

## Prerequisites

- **Node.js** 20+ and **pnpm** 10.33.2
- **React** development experience
- **`@ode/tokens` built** — from `packages/tokens`: `pnpm install && pnpm run build` (see [Development Setup](/docs/development/setup#package-manager-pnpm))

## Local Development

### Setup

```bash
cd packages/tokens && pnpm install && pnpm run build && cd ../..
cd formulus-formplayer
pnpm install
```

### Development Server

```bash
pnpm start
```

Opens at http://localhost:3000 (or the port Vite prints).

### Development Features

- **Hot Reload**: Changes reflect immediately
- **Source Maps**: Debug in browser DevTools
- **Error Overlay**: Errors shown in browser

## Building

### Build and copy to Formulus (and ODE Desktop)

```bash
pnpm run build:copy
```

This:

1. Syncs the Formulus interface definition
2. Builds the React app (`build/`)
3. Copies assets into Formulus Android/iOS formplayer directories
4. Copies assets into `desktop/public/formplayer_dist/` when building the full pipeline

From **ODE Desktop** only (requires an existing `formulus-formplayer/build/`):

```bash
cd desktop
pnpm copy:formplayer
```

### Build for Web only

```bash
pnpm run build
```

Output in `build/` directory.

## Project Structure

- `src/`: React source code
- `public/`: Static assets
- `build/`: Production build output

## Adding Question Types

1. **Create Renderer Component:**
   ```typescript
   // src/NewQuestionRenderer.tsx
   export function NewQuestionRenderer(props) {
     return <input {...props} />
   }
   ```

2. **Register in Formplayer:**
   Add to Formplayer configuration when initialized by Formulus.

When you change `formulus/src/webview/FormulusInterfaceDefinition.ts`, run `pnpm run sync-interface` (or `pnpm run build`) in formulus-formplayer.

## Testing

```bash
pnpm run test run
```

## Related Documentation

- [Formplayer Reference](/reference/formplayer) - Component reference
- [Form Design Guide](/guides/form-design) - Creating forms
