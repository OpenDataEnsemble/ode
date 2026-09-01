---
sidebar_position: 9
---

# Security

Security practices for deploying and operating ODE (Synkronus, Formulus, and related components).

:::info Compliance
ODE is **self-hosted research infrastructure**. Regulatory compliance (IRB, data classification, BAAs, audit programs) is the **host organization's** responsibility. This page describes technical controls ODE provides and what operators must add. ODE does **not** claim HIPAA, SOC 2, or similar certifications.
:::

For a one-page infrastructure overview aimed at IT departments, see [Server Architecture for IT](/docs/guides/server-architecture-for-it).

## Supported versions

Security updates are provided for the latest release and the immediately preceding major version. **Current ODE release: [v1.3.2](https://github.com/OpenDataEnsemble/ode/releases/tag/v1.3.2).**

| Component | Supported |
|-----------|-----------|
| Synkronus | Latest release and previous major version |
| Formulus | Latest release and previous major version |
| Synkronus CLI | Latest release and previous major version |

Keep server and mobile clients on compatible versions. See [Installing Formulus](/docs/getting-started/installation/installing-formulus).

## Reporting a vulnerability

**Do not report security vulnerabilities through public GitHub issues.**

- **Email:** `security@opendataensemble.org`
- **GitHub:** [Private vulnerability reporting](https://github.com/opendataensemble/ode/security/advisories/new)

Full disclosure policy and PGP key: [SECURITY.md on GitHub](https://github.com/OpenDataEnsemble/ode/blob/main/SECURITY.md).

## Encryption and data protection

### In transit

- All production API traffic must use **HTTPS** (TLS 1.2+).
- Terminate TLS at a **reverse proxy or load balancer** you control (Caddy in [synkronus-quickstart](https://github.com/OpenDataEnsemble/synkronus-quickstart); Nginx, Apache, or cloud LB are equally valid).
- Formulus on **iOS** enforces App Transport Security (HTTPS). On **Android**, HTTP is allowed with a warning—enforce HTTPS via server URL policy.

### At rest (server)

- Database and attachment encryption at rest depends on the **underlying storage layer** (volume encryption, managed database TDE). Synkronus does not add a separate at-rest encryption layer inside the container.
- Encrypt database and volume **backups** before off-site storage.

### On field devices

| Data | Storage |
|------|---------|
| Login credentials | iOS Keychain / Android Keystore |
| Observations | SQLite (WatermelonDB) in app private sandbox |
| Photos / attachments | App-private directory in the sandbox |
| Android backup | Disabled (`allowBackup="false"`) |

Recommend **device passcode or biometric lock** and **MDM remote wipe** for lost devices via institutional policy. Offline synced data remains on the device until wiped.

### What ODE does not provide

- Application-level database encryption on mobile devices
- Certificate pinning (institutional TLS inspection may work if your CA is on devices)
- Built-in rate limiting (configure at proxy/WAF)
- High availability or bundled monitoring (use `/health` and your log stack)
- Compliance certification

## Authentication and access control

- **JWT** access tokens (default **24 hours**); refresh tokens (**7 days**).
- Roles: `read-only`, `read-write`, `admin`.
- Passwords hashed with bcrypt on the server.
- Change default admin credentials immediately after deployment.
- Generate `JWT_SECRET` with `openssl rand -base64 32`.

## Deployment security

### Container images

- Production: pin `ghcr.io/opendataensemble/synkronus:v1.3.2` (not `:latest`).
- Scan images for vulnerabilities as part of your supply-chain process.

### Network

```bash
# Example: allow only web ports on the host
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

- Expose only the reverse proxy publicly. Keep Synkronus and PostgreSQL on internal networks.
- **Rate limiting:** not built into Synkronus—configure on the proxy, especially for login endpoints.

### Database

- **Container (quickstart):** `sslmode=disable` on internal Docker/Podman network is normal.
- **Managed PostgreSQL:** use `sslmode=require` in `DB_CONNECTION`.
- Limit database access to the Synkronus service only.

### Secrets

Never commit secrets to version control. Required secrets:

| Variable | Purpose |
|----------|---------|
| `JWT_SECRET` | JWT signing |
| `DB_CONNECTION` | PostgreSQL (includes password) |
| `ADMIN_PASSWORD` | Initial admin (change after first login) |

Use your platform's secret manager in production.

### File uploads

- Attachment limit: **32 MB** per file (configure proxy body size accordingly).
- Attachment IDs validated against path traversal.
- All attachment endpoints require authentication.

### Portal

The Synkronus Portal (admin UI) is embedded in the Synkronus binary at `/portal`. Protect it with TLS, strong passwords, and network ACLs where possible.

## Mobile app (Formulus)

- Signed release APKs; ProGuard/R8 on Android.
- Permissions: camera, storage, location as required by form features.
- Data syncs only to the server URL configured by the user—no third-party analytics pipeline in Formulus.

Install paths: [Obtainium](https://github.com/ImranR98/Obtainium) (recommended) or [F-Droid](https://f-droid.org/packages/org.opendataensemble.formulus/).

## Logging and monitoring

- Synkronus logs to stdout (structured). Ship logs to your SIEM or log stack.
- Health check: `GET /health` on Synkronus (via proxy in production).
- Do not log passwords, tokens, or other secrets.

## Deployment checklist

Before production:

- [ ] All default passwords changed
- [ ] Strong JWT secret generated
- [ ] HTTPS/TLS enabled (TLS 1.2+)
- [ ] Database connection uses SSL/TLS when not on a trusted internal network
- [ ] Firewall configured (proxy only public)
- [ ] Secrets stored securely (not in git)
- [ ] Postgres and `appdata` backups configured and restore tested
- [ ] Monitoring and log shipping configured
- [ ] OS and image dependencies patched
- [ ] Reverse proxy rate limiting configured
- [ ] Proxy upload limit ≥ 32 MB
- [ ] Synkronus image tag pinned (e.g. `v1.3.2`)
- [ ] Device passcode/MDM policy for field tablets

## Security updates

| Severity | Target response |
|----------|-----------------|
| Critical | Within 7 days when possible |
| High | Within 30 days |
| Medium | Within 90 days |

Subscribe to [GitHub Security Advisories](https://github.com/opendataensemble/ode/security/advisories) for the ODE repository.

## Related documentation

- [Server Architecture for IT](/docs/guides/server-architecture-for-it)
- [Deployment guide](/docs/guides/deployment)
- [Synkronus Server Reference](/docs/reference/synkronus-server)
- [REST API Authentication](/docs/reference/rest-api/authentication)
