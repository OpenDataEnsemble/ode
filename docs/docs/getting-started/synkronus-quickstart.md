---
sidebar_position: 6
title: Synkronus Quickstart
---

# Synkronus Quickstart — Deploy in Minutes

Get a full **Synkronus server** running in minutes with Docker or Podman, including database, automated HTTPS, and portal UI.

> **TL;DR:** Clone, run installer, done. See [Easiest: Run the Installer](#easiest-run-the-installer).

---

## What you get

- ✅ **Synkronus server** — REST API for mobile app sync
- ✅ **PostgreSQL database** — Data persistence
- ✅ **Synkronus Portal** — Web UI for admin tasks
- ✅ **Caddy reverse proxy** — Auto TLS/HTTPS (Let's Encrypt)
- ✅ **Single Docker volume** — All data in one place
- ✅ **Works locally or in cloud** — GitHub Codespaces ready

---

## Prerequisites

**Docker or Podman**

```bash
# macOS (Homebrew)
brew install podman podman-compose

# Ubuntu/Debian
sudo apt update && sudo apt install -y podman podman-compose git
```

**Git** — Clone the repository

---

## Easiest: Run the Installer ⭐

The installer generates strong passwords, configures TLS, and handles everything.

```bash
# 1. Clone the repository
git clone --depth 1 https://github.com/OpenDataEnsemble/synkronus-quickstart.git server
cd server

# 2. Run the installer
chmod +x ./install.sh
./install.sh

# 3. Start the stack
podman compose up -d
```

The installer will ask:

**Do you have a domain name?**

- **Yes** → Enter your domain (e.g., `myserver.com`)
  - Caddy obtains a real TLS certificate from Let's Encrypt
  - Access: `https://myserver.com`

- **No, use public IP** → Enter your server's IP
  - Caddy uses `<ip>.sslip.io` (real certificate)
  - Access: `https://<ip>.sslip.io`

- **No, localhost** → Local testing only
  - HTTP on `localhost:80`
  - Access: `http://localhost`

**Output:**
```
Admin username: admin
Admin password: < strong password saved >
```

Save these credentials!

---

## After setup

### Access the portal

- **Domain:** `https://myserver.com`
- **Public IP:** `https://<your-ip>.sslip.io`
- **Localhost:** `http://localhost`

Login with the credentials from the installer.

### Create users

In Synkronus Portal:
1. **Settings** → **Users**
2. Click **+ Add User**
3. Enter username, password, and permissions

### Verify the server

```bash
# Check if server is running
curl https://myserver.com/health
# Response: "OK"
```

---

## Data storage

Data is stored in a single Docker volume at `/app/data`:

```
/app/data/
├── app-bundle/active/      # Currently deployed app bundle
├── app-bundle/versions/     # Version history
├── attachments/             # Photos, documents, etc.
└── database/                # PostgreSQL data (in named volume)
```

To find the volume path:

```bash
podman volume inspect <volume_name> --format '{{ .Mountpoint }}'
```

---

## Utilities

The repo includes helpful scripts:

| Script | Purpose |
|--------|---------|
| `backup-db.sh` | Backup PostgreSQL database to `.sql` file |
| `backup-attachments.sh` | Copy attachment blobs from container |
| `migrate-synkronus-data.sh` | Used when upgrading from older versions |

**Example: Backup the database**

```bash
chmod +x ./utilities/backup-db.sh
./utilities/backup-db.sh
# Creates: synkronus-db-backup-<timestamp>.sql
```

---

## Manual setup (advanced)

If you prefer to configure manually:

### 1. Clone and prepare

```bash
git clone https://github.com/OpenDataEnsemble/synkronus-quickstart.git
cd synkronus-quickstart
```

### 2. Edit docker-compose.yml

Set environment variables:

```yaml
postgres:
  environment:
    POSTGRES_PASSWORD: <generate strong password>

synkronus:
  environment:
    DB_CONNECTION: "user=synkronus password=<from postgres> host=db dbname=synkronus"
    JWT_SECRET: <openssl rand -base64 32>
    ADMIN_USERNAME: admin
    ADMIN_PASSWORD: <strong password>
```

### 3. Initialize the database

```bash
# Terminal 1: Start database only
podman compose up db

# Terminal 2: Create the Synkronus database
chmod +x ./create_sync_db.sh
./create_sync_db.sh
```

### 4. Start the full stack

```bash
podman compose up -d
```

### 5. Verify

```bash
curl http://localhost:8080/health
# Response: "OK"
```

---

## Using GitHub Codespaces

Perfect for trying out Synkronus in 30 seconds — no local setup needed.

1. Go to [synkronus-quickstart repo](https://github.com/OpenDataEnsemble/synkronus-quickstart)
2. Click **"Open in Codespaces"**
3. Wait for startup (containers will auto-start)
4. Check **Ports** tab to find the forwarded URL
5. Test:
   ```bash
   curl <forwarded-url>/health
   ```

---

## Upgrading from older versions

If you previously used older paths for app bundles:

1. **Stop the stack:**
   ```bash
   podman compose down
   ```

2. **Backup the data volume:**
   ```bash
   docker run --rm \
     -v <your_appdata_volume>:/data \
     -v "$(pwd)":/backup alpine \
     tar czf /backup/backup.tgz -C /data .
   ```

3. **Run the migration script:**
   ```bash
   chmod +x ./utilities/migrate-synkronus-data.sh
   podman run --rm \
     -v <volume_name>:/data:Z \
     -v "$PWD/utilities/migrate-synkronus-data.sh:/migrate.sh:ro,Z" \
     docker.io/library/alpine:3.21 \
     sh /migrate.sh /data
   ```

4. **Start the new version:**
   ```bash
   podman compose up -d
   ```

See [upgrade-path.md](https://github.com/OpenDataEnsemble/synkronus-quickstart/blob/main/upgrade-path.md) for full details.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Certificate error on first boot | Wait 1-2 minutes for Let's Encrypt validation. Restart Caddy: `podman restart synkronus_caddy` |
| Can't connect to server | Verify stack is running: `podman compose ps` |
| Database won't start | Check disk space and container logs: `podman logs db` |
| Lost attachments | Use `backup-attachments.sh` before recreating containers |

---

## Next steps

1. **[Build a custom app](../guides/building-custom-apps.md)** — Create your first data collection app
2. **[Install Formulus](./installation/installing-formulus.md)** — Get the mobile app
3. **Configure mobile nodes** — Set up offline sync
4. **Join the community** — [forum.opendataensemble.org](https://forum.opendataensemble.org)

---

## Reference

- **[Repository](https://github.com/OpenDataEnsemble/synkronus-quickstart)** — Source code and utilities
- **[Synkronus Server API](../reference/synkronus-server.md)** — Full API reference
- **[Configuration](../reference/configuration/server.md)** — Server settings
- **[Forum](https://forum.opendataensemble.org)** — Community support

---

**Ready to sync data?** 🚀
