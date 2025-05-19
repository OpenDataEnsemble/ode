
# RenderPack Reference Project

This is a reference project for creating RenderPacks—modular bundles containing custom JSONForms renderers and cells. RenderPacks can be dynamically injected into Formplayer, which runs within a React Native WebView as part of the Formulus ecosystem.

---

## Overview

A RenderPack is:

- **Customizable**: Contains React components (renderers and cells) for JSONForms.
- **Portable**: Bundled into a UMD JavaScript module for easy injection into a web context.
- **Maintainable**: Versioned and documented via a standardized JSON manifest.

This reference project demonstrates recommended structure, tooling, and best practices.

---

## Project Structure

```bash
renderpack/
├── src/
│   ├── index.ts               # Entry point exporting renderers and cells
│   ├── renderers.ts           # Renderer component definitions
│   └── cells.ts               # Cell component definitions
├── dist/                      # Output bundles and declarations
├── test/
│   ├── renderers.test.ts      # Unit tests for renderers
│   ├── cells.test.ts          # Unit tests for cells
│   └── manifest.test.ts       # Schema validation tests
├── renderpack.manifest.json   # Describes RenderPack metadata
├── renderpack.schema.json     # JSON schema for manifest validation
├── rollup.config.js           # Rollup build configuration
├── tsconfig.json              # TypeScript configuration
├── jest.config.js             # Jest testing configuration
├── .eslintrc.js               # ESLint configuration
├── .prettierrc                # Prettier configuration
└── package.json
```

---

## Getting Started

### Installation

```bash
git clone https://github.com/your-org/renderpack.git
cd renderpack
npm install
```

### Building

```bash
npm run build
```

This will generate `bundle-custom.umd.js` in the `dist` folder.

### Publishing (optional)

```bash
npm publish --access public
```

---

## Integration with Formulus

To use RenderPack within Formulus:

1. Download the UMD bundle (`bundle-custom.umd.js`) and `renderpack.manifest.json`.
2. Include the bundle in the Formplayer HTML file before the main Formplayer script:

```html
<script src="bundle-custom.umd.js"></script>
<script src="formplayer.bundle.js"></script>
```

3. Register the components in the Formplayer entry point:

```typescript
import { registerRenderers, registerCells } from '@jsonforms/react';
import { coreRenderers, coreCells } from './core';

const custom = window.FormulusCustom || { renderers: [], cells: [] };
registerRenderers([...coreRenderers, ...custom.renderers]);
registerCells([...coreCells, ...custom.cells]);
```

---

## Manifest Validation

A RenderPack manifest (`renderpack.manifest.json`) ensures compatibility and correctness. Validate it against the provided schema (`renderpack.schema.json`) using Jest and AJV:

```typescript
// test/manifest.test.ts
import Ajv from 'ajv';
import manifest from '../renderpack.manifest.json';
import schema from '../renderpack.schema.json';

test('RenderPack manifest validation', () => {
  const ajv = new Ajv();
  const validate = ajv.compile(schema);
  expect(validate(manifest)).toBe(true);
  if (!validate(manifest)) console.error(validate.errors);
});
```

Install AJV:

```bash
npm install --save-dev ajv
```

Run tests:

```bash
npm test
```

---

## Testing

Unit tests and schema validations ensure quality and compatibility:

```bash
npm test
```

Coverage reports will be available in the `coverage` directory.

---

## Contributing

- Fork this repository.
- Create or update renderer/cell components.
- Update the manifest accordingly.
- Add necessary unit tests.
- Submit a pull request. Automated checks will validate your contributions.

---

## License

MIT
