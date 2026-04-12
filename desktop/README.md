# Custodian (Tauri + React + Rust)

Custodian is the ODE desktop stewardship app prototype built with Tauri, React, and Rust.

**Custodian** is the desktop stewardship tool for ODE repositories. It lets you manage a local repository per profile, inspect and correct observations, import JSON data, and synchronize deliberate changes back to Synkronus.

## Quick start

```bash
pnpm install
pnpm dev
pnpm tauri dev
```

## Tests and build

```bash
pnpm test
pnpm build
```

Format code:

```bash
pnpm format
pnpm format:check
```

Rust tests:

```bash
cd src-tauri
cargo test
```

## OpenAPI client generation

This project includes a regeneration command for a Synkronus API client (TypeScript fetch client):

```bash
pnpm codegen:synk-client
```

### Where the source spec is configured

Default source and output paths are configured in:

- `openapi.client.config.json`

```json
{
  "sourceSpecRelativePath": "../ODE/synkronus/openapi/synkronus.yaml",
  "outputRelativePath": "src/generated/synkronus-client"
}
```

Both paths are **relative to the project root** so this can move into the monorepo without hardcoded absolute paths.

### Override the spec path/output path at runtime

You can override either path via environment variables:

- `OPENAPI_SPEC_RELATIVE_PATH`
- `OPENAPI_OUTPUT_RELATIVE_PATH`

PowerShell example:

```powershell
$env:OPENAPI_SPEC_RELATIVE_PATH="../ODE/synkronus/openapi/synkronus.yaml"
pnpm codegen:synk-client
```

### Notes

- Generated files are written to `src/generated/synkronus-client`.
- Generation uses `@openapitools/openapi-generator-cli` with `typescript-fetch`.
- If needed, ensure Java is available on your machine for the generator runtime.
- The app currently uses an in-process Rust sync implementation in `src-tauri/src/lib.rs`.
- The generated client is intended as a robust contract-aligned artifact and migration path as the integration evolves.

# Tauri + React + Typescript

This template should help get you started developing with Tauri, React and Typescript in Vite.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
