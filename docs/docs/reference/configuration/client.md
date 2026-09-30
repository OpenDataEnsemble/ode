---
sidebar_position: 2
---

# Client Configuration

Configuration options for ODE clients (Formulus, Formplayer, ODE Desktop).

## UI language (Formulus)

**Settings → Language** controls ODE-owned UI strings (shell, Formplayer chrome, validation messages).

| Option | Behavior |
|--------|----------|
| **Auto (device)** | Use device language when an ODE catalog exists (`en`, `pt`, `fr` in v1) |
| **English / Português / Français** | Fixed UI locale |

**Precedence** when resolving the active locale for Formplayer:

1. Formulus Settings (or ODE Desktop Form Preview language control)
2. If Auto → device language
3. Custom app `app.config.json` → `defaultLocale` (optional)
4. Fallback `en`

The resolved locale is passed to Formplayer as `params.locale`. It is **not** stored on observation JSON.

Advanced: `openFormplayer(formType, observationId, { locale: 'pt', ... })` may override for a single session.

## Custom application configuration

Optional `defaultLocale` in [`app.config.json`](/guides/configuration):

```json
{
  "name": "My Study",
  "version": "1.0.0",
  "defaultLocale": "pt",
  "theme": { ... }
}
```

Used when the user selects **Auto** and the device language is not in ODE catalogs.

## Form-level translations

Form field labels are **not** configured here. Authors embed optional `translations` objects in each form's `ui.json`. See [Form translations](/guides/form-translations).

## Related content

- [Form translations](/guides/form-translations)
- [Configuration](/guides/configuration)
- [Custom applications](/guides/custom-applications)
