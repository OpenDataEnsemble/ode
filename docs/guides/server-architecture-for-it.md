---
sidebar_position: 2
title: Server Architecture for IT
---

# Server Architecture for IT Departments

One-page overview for infrastructure teams evaluating or hosting ODE (Synkronus).

> **Current ODE release:** [v1.3.2](https://github.com/OpenDataEnsemble/ode/releases/tag/v1.3.2) · [Downloads](/downloads) · **Reference stack:** [synkronus-quickstart](https://github.com/OpenDataEnsemble/synkronus-quickstart)

## Summary

ODE field collection runs on **mobile devices (Formulus)**. The **only server component ODE delivers** is **Synkronus** (an OCI container image). Study-specific applications (for example AnthroCollect) are **app bundles**—forms plus a small web UI—stored on and served by Synkronus. IT hosts Synkronus, PostgreSQL, and a TLS reverse proxy.

Data classification and compliance (IRB, institutional policies, audit programs) are the **host organization's** responsibility. This page describes infrastructure only.

## What ODE provides vs what the project provides

| Deliverable | Provided by | Runs on |
|-------------|-------------|---------|
| Synkronus server image (`ghcr.io/opendataensemble/synkronus`) | ODE | Your server |
| Embedded admin Portal (`/portal`) | ODE (inside Synkronus) | Your server |
| Formulus mobile app | ODE | Field tablets/phones |
| PostgreSQL | Standard image (you operate) | Your server |
| TLS reverse proxy | **Your choice** (Caddy in quickstart; Nginx, Apache, cloud LB, etc.) | Your server |
| Custom app + forms (e.g. AnthroCollect) | Project team | Uploaded to Synkronus; synced to devices |

## Logical architecture (end-to-end)

![Logical architecture: field devices, Synkronus, and PostgreSQL](/img/it-architecture-logical.svg)

**Traffic:** Field devices sync over **HTTPS** to the Synkronus REST API. Devices do not connect directly to PostgreSQL. The custom app UI runs inside a Formulus WebView and uses the same API through the Formulus bridge.

## Installation view (server stack)

![Installation view: reverse proxy, Synkronus container, PostgreSQL, and volumes](/img/it-architecture-installation.svg)

Reference layout from [synkronus-quickstart](https://github.com/OpenDataEnsemble/synkronus-quickstart):

| Container / role | Image | Purpose |
|------------------|-------|---------|
| Reverse proxy | Caddy 2 (quickstart) or IT-standard proxy | TLS termination, forward to Synkronus |
| `synkronus` | `ghcr.io/opendataensemble/synkronus:v1.3.2` | API, sync, auth, app-bundle hosting, Portal |
| `db` | `postgres:17` (quickstart) | Observations, users, metadata |

### Common deployment variants

1. **Colocated proxy** — Caddy or Nginx on the same VM as Synkronus (quickstart / typical self-hosted pattern).
2. **Institutional edge** — Your load balancer or reverse proxy terminates TLS; Synkronus runs on a private network only.

### PostgreSQL: container vs managed

| Pattern | When to use | Connection notes |
|---------|-------------|------------------|
| **A — Container** (quickstart default) | Pilot, single VM | `sslmode=disable` on the internal Docker/Podman network is normal |
| **B — Managed DB** (RDS, Azure, institutional service) | Enterprise production | Use `sslmode=require` in `DB_CONNECTION`; Synkronus still stores attachments on `appdata` |

**Persistent data (operator responsibility):**

| Volume | Contents |
|--------|----------|
| `pgdata` | PostgreSQL database |
| `appdata` | Synkronus `/app/data`: app bundles, attachment blobs |

Backup scripts in the quickstart repo: `utilities/backup-db.sh`, `utilities/backup-attachments.sh`.

## Security model

| Concern | Responsibility |
|---------|----------------|
| TLS in transit | Reverse proxy (required in production); TLS 1.2+ |
| Encryption at rest | **Host platform** (disk/volume encryption, managed DB encryption)—ODE does not add a separate at-rest encryption layer inside containers |
| Authentication | JWT (Synkronus); roles `read-only`, `read-write`, `admin` |
| Secrets | `JWT_SECRET`, DB passwords, admin credentials — env vars or secret store |
| Network exposure | Public: proxy ports 443 (and 80 for ACME if used). Synkronus and Postgres not public |
| Rate limiting | **Not built into Synkronus** — configure at proxy/WAF |
| High availability | Single-node quickstart is typical; HA is an IT design choice |

See [Security reference](/docs/reference/security) for the full checklist.

## Field devices (brief)

| Layer | Formulus behavior | Operator responsibility |
|-------|-------------------|-------------------------|
| Credentials | Stored in iOS Keychain / Android Keystore | Per-user Synkronus accounts; revoke on offboarding |
| Observation data | SQLite (WatermelonDB) in app private sandbox | Classify per study policy |
| Photos / attachments | App-private storage under the app sandbox | Same |
| Device encryption | Relies on OS full-disk encryption when device is locked | Recommend device passcode/biometric via policy or MDM |
| Android backup | `allowBackup="false"` | MDM remote wipe for lost devices |
| Network (iOS) | App Transport Security requires HTTPS | Serve Synkronus over HTTPS |
| Network (Android) | HTTP allowed with a user-visible warning | Enforce HTTPS in server URL policy |

Synkronus does not provide certificate pinning. Institutional TLS inspection is possible if your CA is trusted on devices.

## Distributing Formulus to field tablets

| Method | Notes for IT |
|--------|----------------|
| **[Obtainium](https://github.com/ImranR98/Obtainium)** (recommended) | Installs/updates from GitHub Releases (`OpenDataEnsemble/ode`); may require allowing install from unknown sources for the installer |
| **[F-Droid](https://f-droid.org/packages/org.opendataensemble.formulus/)** | Direct install of Formulus |
| **MDM** | Institutions may sideload the APK via MDM — package `org.opendataensemble.formulus` |

Details: [Installing Formulus](/docs/getting-started/installation/installing-formulus).

## Sizing (starting point)

| Scale | Suggested starting point |
|-------|--------------------------|
| Pilot / small study | 2 vCPU, 4 GB RAM, 40+ GB disk (attachments grow with photos) |
| Production | Tested backups; monitor `appdata` growth; pin image tags |

Synkronus limits attachment uploads to **32 MB** per file. Configure your reverse proxy body size limit to at least 32 MB.

**Proxy timeouts:** field devices on slow radio can take minutes for a pull, push, photo, or app-bundle zip. Set reverse-proxy send/read timeouts to at least **600 seconds** (the bundled `nginx.conf` uses `proxy_send_timeout` / `proxy_read_timeout 600s`). Default nginx/Caddy idle values (~60s) will drop those transfers. Login and token refresh are bounded at **25 seconds** inside Synkronus; do not apply that short deadline to sync routes.

## Reference deployment pattern

Typical self-hosted pattern (e.g. research institutions running custom apps like AnthroCollect):

1. Linux VM or cloud instance running Podman/Docker Compose
2. [synkronus-quickstart](https://github.com/OpenDataEnsemble/synkronus-quickstart) installer → Caddy + Synkronus + Postgres
3. DNS points to server; TLS via Let's Encrypt or institutional certificates on your proxy
4. Project team uploads the app bundle via Portal or `synk` CLI
5. Field tablets install Formulus **v1.3.2** via F-Droid, Obtainium, the App Store, or direct APK; configure server URL in app settings

Coordinate **Formulus and Synkronus versions** on upgrade—the mobile app checks server compatibility and may refuse sync on mismatch.

## Operator checklist

- [ ] Hardened reverse proxy with TLS (TLS 1.2+)
- [ ] Pin Synkronus image tag (e.g. `v1.3.2`) rather than `:latest` in production
- [ ] Proxy upload limit ≥ 32 MB per attachment
- [ ] Proxy send/read timeouts ≥ 600s (sync, attachments, bundle zip)
- [ ] Automated Postgres backups + tested restore
- [ ] Backup `appdata` volume (attachments + bundles)
- [ ] Volume/disk encryption at platform level
- [ ] Firewall: public access only to proxy; database not public
- [ ] Rate limiting on auth endpoints (proxy/WAF)
- [ ] Device passcode/biometric policy for field tablets
- [ ] Document who operates exports and admin Portal access

## Further reading

- [Install Synkronus](/docs/getting-started/installation/installing-synkronus)
- [Synkronus Quickstart](/docs/getting-started/synkronus-quickstart)
- [Deployment guide](/docs/guides/deployment)
- [Security reference](/docs/reference/security)
- [Synkronus Server Reference](/docs/reference/synkronus-server)
