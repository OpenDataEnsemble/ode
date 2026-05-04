# Formulus — AI & developer guide

**When to use this doc:** You are changing the **React Native** mobile app: navigation, screens, WebViews, native modules, or the JavaScript bridge injected into custom apps and the formplayer.

**See also:** [../AGENTS.md](../AGENTS.md) (monorepo overview), [../formulus-formplayer/AGENTS.md](../formulus-formplayer/AGENTS.md) (form UI bundle and WebView constraints).

**User-facing docs:** [Formulus](https://opendataensemble.org/docs/reference/formulus) on [opendataensemble.org](https://opendataensemble.org/).

---

## What this package is

- **Formulus** is the **offline-first** mobile client for ODE: it renders **JSON Forms** via the embedded **formplayer** WebView, runs **custom application** bundles in separate WebViews, and synchronizes with **Synkronus**.
- It is **not** the admin console (that is **Portal**) and not the sync server (that is **Synkronus**).

---

## Layout (where to look)

| Area                                 | Purpose                                                                                                                                                                                                                                                                                                    |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/webview/`                       | **Bridge contract** — [`FormulusInterfaceDefinition.ts`](src/webview/FormulusInterfaceDefinition.ts) (source of truth for `window.formulus` / injected API). [`FormulusMessageHandlers.ts`](src/webview/FormulusMessageHandlers.ts), [`FormulusWebViewHandler.ts`](src/webview/FormulusWebViewHandler.ts). |
| `scripts/generateInjectionScript.ts` | Generates injection / loader script from the interface definition.                                                                                                                                                                                                                                         |
| `src/screens/`, `src/navigation/`    | App screens and routing.                                                                                                                                                                                                                                                                                   |
| Android / iOS                        | Native projects; **formplayer** static assets: `android/app/src/main/assets/formplayer_dist/`, `ios/formplayer_dist/` (see formplayer AGENTS for `build:copy`).                                                                                                                                              |

---

## Custom apps and formplayer

- **Custom apps** are HTML/JS/CSS bundles loaded from Synkronus; they receive the **Formulus** injected API (see interface definition). Authors do not need this monorepo — public docs and [custom_app](https://github.com/OpenDataEnsemble/custom_app) describe usage.
- **Formplayer** is a sibling package; after changing `FormulusInterfaceDefinition.ts`, run **`npm run sync-interface`** (or build) in **formulus-formplayer** so its copy stays aligned.

---

## Changing the bridge

1. Edit [`FormulusInterfaceDefinition.ts`](src/webview/FormulusInterfaceDefinition.ts).
2. Implement **native** handling in the WebView message pipeline.
3. **Sync** the formplayer copy and update any consumers (see [formulus-formplayer/AGENTS.md](../formulus-formplayer/AGENTS.md)).

---

## Build and run

See [README.md](README.md): Metro, `npm run android` / `ios`, Android **Notifee** vendor step, iOS **Pods**. For CI and formatting, see root [README.md](../README.md) and [.github/CICD.md](../.github/CICD.md).
