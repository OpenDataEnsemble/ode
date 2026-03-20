# Third-party notices

Open Data Ensemble (ODE) ships with **your own code** under the [MIT License](./LICENSE). This file summarizes **separately licensed open-source components** that may be included when you build and distribute ODE software, and points to where to find a **machine-readable** full list.

> **This is not legal advice.** For distribution (especially mobile apps and CLI binaries), have your process reviewed against your policies.

## Full dependency listing (SBOM)

For each GitHub **Release**, SBOMs in **CycloneDX** JSON are attached (see CI workflow `.github/workflows/sbom-release.yml`). Regenerate locally:

```bash
node scripts/sbom/generate-sboms.mjs --out sbom-dist
```

## High-level summary (npm / JS)

Production JavaScript dependency licenses are **overwhelmingly permissive** (e.g. MIT, ISC, BSD, Apache-2.0). Typical stacks include:

| Area | Examples | Notes |
|------|----------|--------|
| **Formulus** (React Native) | React Native, React Navigation, WatermelonDB, Vision Camera, Metro/Babel toolchain | Large transitive tree; see SBOM `formulus.cdx.json`. |
| **Formulus Formplayer** | React, MUI, JSON Forms, Emotion | See `formulus-formplayer.cdx.json`. |
| **Synkronus Portal** | React, Vite, react-icons | Small tree; see `synkronus-portal.cdx.json`. |
| **Shared UI** | `@ode/components`, `@ode/tokens` | MIT (this repo). |

### Items worth reading the license text for

- **`caniuse-lite`** (used under Browserslist / tooling): license data is often tagged **CC-BY-4.0**. If you redistribute that **data** separately, respect attribution; in normal app bundles it is usually consumed as build metadata.
- **`argparse`** (npm): may report **Python-2.0** in license scanners; verify the copy in `node_modules` if your policy flags non-SPDX “Python” licenses.
- **`@nozbe/sqlite`** (WatermelonDB / native SQLite packaging): the npm package may not declare `license` in `package.json` (shows as “UNKNOWN” in some tools). Upstream is the Nozbe SQLite packaging; verify terms in the [Nozbe/sqlite](https://github.com/Nozbe/sqlite) repository if required by your compliance process.

## Go backend and CLI

`synkronus` and `synkronus-cli` SBOMs (`synkronus.cdx.json`, `synkronus-cli.cdx.json`) list modules and detected licenses.

### Copyleft in `synkronus-cli` (important)

The QR code stack pulls in **`github.com/golang/freetype`** (detector-reported **GPL-2.0-or-later**) via `github.com/fogleman/gg` → `github.com/yeqown/go-qrcode`.

- **Effect:** Distributing **compiled `synkronus-cli` binaries** may trigger **GPL v2 obligations** (e.g. source offer / license pass-through), depending on how you ship and link. This does **not** automatically “infect” your MIT application code, but it **does** affect what you must do for **that binary** under GPL.
- **Mitigations (product choices):** replace the QR rendering path with a library under permissive licenses only, or ship the CLI under terms compatible with GPLv2, or distribute source alongside the binary per GPL. **Discuss with counsel** before changing distribution model.

`synkronus` server SBOMs checked in this audit did **not** show GPL/AGPL/LGPL identifiers in CycloneDX output; still rely on the SBOM for each release.

## Vendored native sources (Formulus / Android)

When you run `npm run vendor:notifee`, Android builds may include **Notifee** sources per `formulus/third_party/README.md`. Attribute **Notifee** per its license (see upstream [invertase/notifee](https://github.com/invertase/notifee)).

## Suggested attribution (short)

You may use wording such as:

> This software includes open-source components. See **THIRD_PARTY_NOTICES.md** and the **CycloneDX SBOM** files attached to each release for more information.

The Formulus **About** screen links to this document in the repository for convenience.
