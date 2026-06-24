---
name: ode-synk-bundle-publish
description: >-
  Guides publishing and managing ODE app bundles with the Synkronus CLI (synk):
  config, auth, upload, versions. Use when deploying custom app zips or automating
  bundle uploads. Official reference is opendataensemble.org and OpenDataEnsemble/ode docs.
---

# Synkronus CLI — app bundle publish

## When to use

- Uploading a **custom app** ZIP to Synkronus.
- Managing **bundle versions** or scripting **CI** upload steps.
- Configuring **`synk`** (`~/.synkronus.yaml`, `synk config use`, etc.).

## What to do

1. Use **[Synkronus CLI](https://opendataensemble.org/docs/reference/synkronus-cli)** as the primary command reference.
2. Ensure the ZIP matches **[App bundle format](https://opendataensemble.org/docs/reference/app-bundle-format)** before upload.
3. Store **API URLs and tokens** in CI secrets; never embed production credentials in source.
4. For bundle structure reminders, see **[CONTEXT_BUNDLE_AND_CI.md](https://github.com/OpenDataEnsemble/custom_app/blob/main/CONTEXT_BUNDLE_AND_CI.md)** in **custom_app** (summary only).

## CI / GitHub Actions (recommended pattern)

Do **not** build synk from source in app repos. Pin an ODE release:

```yaml
env:
  SYNK_CLI_VERSION: v1.1.2   # bump intentionally

- name: Install synk
  run: |
    curl -fsSL "https://github.com/OpenDataEnsemble/ode/releases/download/${SYNK_CLI_VERSION}/synkronus-cli-linux-amd64.tar.gz" \
      | tar -xz -C /tmp
    install -m 0755 /tmp/synkronus-cli-linux-amd64 /usr/local/bin/synk
```

Deploy steps:

```bash
synk --config "$CONFIG_FILE" login -u "$USER" --password "$PASS"
synk --config "$CONFIG_FILE" app-bundle upload bundle-v1.0.0.zip
synk --config "$CONFIG_FILE" app-bundle switch "$VERSION"
```

Alternative: `ghcr.io/opendataensemble/synkronus-cli:vX.Y.Z` for Docker-based local tooling.

## Related

- [App bundles (using)](https://opendataensemble.org/docs/using/app-bundles)
- [Deployment](https://opendataensemble.org/docs/guides/deployment)
