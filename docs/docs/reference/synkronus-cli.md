---
sidebar_position: 7
---

# Synkronus CLI Reference

Complete reference for the Synkronus command-line interface tool (`synk`).

:::info
The Synkronus CLI is a Go-based command-line utility for administrative operations. It can export data to Parquet format, manage users, deploy app bundles, and perform server diagnostics.
:::

## Installation

### From Package Managers

**macOS (Homebrew):**
```bash
brew install opendataensemble/ode/synk
```

**Linux:**
```bash
curl -fsSL https://raw.githubusercontent.com/OpenDataEnsemble/ode/main/scripts/install-synkronus-cli.sh | bash
```

**Windows (PowerShell):**
```powershell
irm https://raw.githubusercontent.com/OpenDataEnsemble/ode/main/scripts/install-synkronus-cli.ps1 | iex
```

### From Source

**Install from GitHub:**
```bash
go install github.com/OpenDataEnsemble/ode/synkronus-cli/cmd/synkronus@latest
```

**Build from source:**
```bash
git clone https://github.com/OpenDataEnsemble/ode.git
cd ode/synkronus-cli
go build -o bin/synk ./cmd/synkronus
```

### Verify Installation

```bash
synk --version
```

Output:
```
synk version 1.0.0
```

## Configuration

### Quick Setup

Initialize configuration first:

```bash
synk config init
```

This creates a config file at `~/.config/synkronus/config.yaml` with default settings.

### Config File Location

The CLI looks for config in this order:

1. `$SYNK_CONFIG` environment variable (if set)
2. `./synk.yaml` (current directory)
3. `~/.config/synkronus/config.yaml` (Linux/macOS)
4. `%APPDATA%\synkronus\config.yaml` (Windows)

### Configuration File Format

```yaml
api:
  base_url: http://localhost:8080
  version: v1
  timeout: 30s
  
auth:
  username: admin
  password: your-password
  # OR
  token: eyJhbGciOiJIUzI1NiI...
```

### Environment Variables

Override config files with environment variables:

```bash
export SYNK_API_URL=http://synkronus.prod.com
export SYNK_USERNAME=admin
export SYNK_PASSWORD=your-password
synk observations export
```

### Multiple Environments

Manage different server endpoints:

```bash
# Create separate configs
synk config init -o ~/.synk-dev.yaml
synk config init -o ~/.synk-prod.yaml

# Use specific config
synk -c ~/.synk-prod.yaml observations list

# Or use environment variable
export SYNK_CONFIG=~/.synk-prod.yaml
synk observations list
```

## Authentication Commands

### Login

Authenticate with the Synkronus server:

```bash
synk login
```

Prompts for username and password interactively. Saves token for future commands.

**Non-interactive login:**
```bash
synk login --username admin --password <password>
```

### Logout

Invalidate stored credentials:

```bash
synk logout
```

### Check Auth Status

Verify current authentication:

```bash
synk auth status
```

Output:
```
Authenticated as: admin
Token expires: 2026-03-22T15:30:00Z
Roles: [admin]
```

## Server Commands

### Health Check

Check if server is running:

```bash
synk server health
```

Output:
```
✓ Server is healthy
Status: running
Version: 1.0.0
Database: connected
```

### Get Server Status

Get detailed server information:

```bash
synk server status
```

Output:
```
Server: synkronus.your-domain.com
Version: 1.0.0
Uptime: 72h 30m
Database: PostgreSQL
Observations: 15,234
Users: 42
```

## Observation Commands

### List Observations

List all observations:

```bash
synk observations list
```

**With filters:**
```bash
# List by form type
synk observations list --form-type household

# List by date range
synk observations list --since 2026-01-01 --until 2026-03-31

# Limit results
synk observations list --limit 100

# Sort by modification date
synk observations list --sort updated
```

Output:
```
ID                          Form Type      Creator    Updated
3e42f1b7-8c2d-4f9a-b3c4-1  household      john       2026-03-22
5a91d8e4-3f2c-1b7a-9c3d-2  hh_person      jane       2026-03-22
```

### Get Single Observation

View detailed observation:

```bash
synk observations get <observation-id>
```

Output:
```
ID: 3e42f1b7-8c2d-4f9a-b3c4-1
Form Type: household
Created: 2026-03-15T10:30:00Z
Updated: 2026-03-22T14:20:00Z
Creator: john

Data:
{
  "hh_id": "HH-001",
  "hh_village_name": "kopria",
  "hh_num_members": 5
}
```

### Delete Observation

(Soft) delete an observation:

```bash
synk observations delete <observation-id>
```

### Export Observations

Export observations to various formats.

**Export to Parquet (recommended for large datasets):**

```bash
synk observations export --format parquet --output observations.parquet
```

```bash
# Export specific form type
synk observations export household --format parquet --output households.parquet

# Export with filter
synk observations export --since 2026-03-01 --format parquet --output march.parquet
```

**Export to JSON:**

```bash
synk observations export --format json --output observations.json

# Pretty-print JSON
synk observations export --format json --output observations.json --pretty
```

**Export to CSV:**

```bash
synk observations export --format csv --output observations.csv
```

**Export to Excel:**

```bash
# Requires minio/excel package
synk observations export --format xlsx --output observations.xlsx
```

## User Management Commands

### List Users

```bash
synk users list
```

Output:
```
Username    Email              Roles      Created
admin       admin@example.com  [admin]    2026-01-01
john        john@example.com   [user]     2026-02-15
jane        jane@example.com   [user]     2026-03-01
```

### Create User

```bash
synk users create
```

Prompts for username, email, and password interactively.

**Non-interactive:**
```bash
synk users create \
  --username john \
  --email john@example.com \
  --password temporary-password \
  --roles user
```

### Delete User

```bash
synk users delete <username>
```

### Reset Password

```bash
synk users reset-password <username>
```

Generates temporary password:
```
New temporary password: TempPass123!
User should change password on next login.
```

### Change User Roles

```bash
synk users update-roles john --add admin
synk users update-roles john --remove user
```

## App Bundle Commands

### List App Bundles

Show deployed app bundle versions:

```bash
synk app-bundle list
```

Output:
```
Version   Uploaded   Forms   Size
1.0.0     2026-03-22  5      2.4 MB
0.9.0     2026-03-15  4      2.1 MB
0.8.0     2026-03-01  3      1.8 MB
```

### Get Active Bundle Version

Show currently active app bundle:

```bash
synk app-bundle active
```

Output:
```
Version: 1.0.0
Uploaded: 2026-03-22T10:30:00Z
Forms:
  - household (v1.0.0)
  - hh_person (v2.1.0)
  - hh_survey (v1.5.0)
```

### Set Active Bundle Version

Activate a specific bundle version:

```bash
synk app-bundle activate 0.9.0
```

### Upload App Bundle

Deploy new form definitions:

```bash
synk app-bundle upload path/to/bundle.zip
```

The bundle should be a ZIP file containing:
```
bundle.zip
├── forms/
│   ├── household.json
│   ├── hh_person.json
│   └── hh_survey.json
├── question_types/
│   ├── my_custom_type.js
│   └── ...
└── metadata.json
```

**Example metadata.json:**
```json
{
  "version": "1.0.0",
  "description": "Updated household forms",
  "forms": ["household", "hh_person", "hh_survey"],
  "compatible_apps": ["formulus >= 1.0.0"]
}
```

### Delete Bundle Version

Remove old bundle version:

```bash
synk app-bundle delete 0.8.0
```

## Sync Database Commands

### Migrate Database

Initialize or migrate database schema:

```bash
synk db migrate
```

### Reset Database

**WARNING: Destructive operation!**

```bash
synk db reset
```

Prompts for confirmation before deleting all data.

### Backup Database

Export database backup:

```bash
synk db backup --output synkronus-backup.sql
```

### Restore Database

Import database from backup:

```bash
synk db restore --input synkronus-backup.sql
```

## Diagnostics & Debugging

### Run Health Checks

Comprehensive system diagnostics:

```bash
synk diagnose
```

Output:
```
ODE Diagnostics
===============

Server Status:        ✓ Online
Database:            ✓ Connected
Authentication:      ✓ Working
API Health:          ✓ Responding
Attachment Storage:  ✓ Available

Summary: All systems operational
```

### Get Logs

View recent server logs:

```bash
# Last 50 lines
synk logs tail -n 50

# Filter by level
synk logs tail --level error

# Follow live logs
synk logs follow
```

### Test API Connection

```bash
synk test-connection
```

Output:
```
✓ Can reach server
✓ Authentication works
✓ Database accessible
✓ All systems responsive
```

## Global Options

Used with any command:

```bash
synk [GLOBAL OPTIONS] [COMMAND] [OPTIONS]
```

**Global options:**

| Option | Description |
|--------|-------------|
| `-c, --config <file>` | Custom config file path |
| `--api-url <url>` | Override API URL |
| `-u, --username <user>` | Override username |
| `-p, --password <pass>` | Override password (not recommended) |
| `--token <token>` | Use token instead of credentials |
| `-o, --output <file>` | Save output to file |
| `--format <format>` | Output format (json, yaml, table) |
| `-q, --quiet` | Suppress output |
| `-v, --verbose` | Verbose output |
| `--debug` | Debug mode |
| `--version` | Show version |
| `-h, --help` | Show help |

## Advanced Examples

### Automated Data Export

Export data weekly to Parquet:

```bash
#!/bin/bash
# export-weekly.sh

DATE=$(date +%Y-%m-%d)
synk observations export \
  --format parquet \
  --output "data/observations-${DATE}.parquet" \
  --since "$(date -d '7 days ago' +%Y-%m-%d)"
```

Schedule with cron:

```bash
# Every Monday at 2 AM
0 2 * * 1 /home/user/export-weekly.sh
```

### Bulk User Creation

```bash
cat users.csv | while IFS=, read username email password; do
  synk users create \
    --username "$username" \
    --email "$email" \
    --password "$password" \
    --roles user
done
```

### Database Backup & Restore

```bash
# Backup
synk db backup --output "backups/synkronus-$(date +%Y%m%d).sql"

# Restore
synk db restore --input "backups/synkronus-20260322.sql"
```

### Monitor Server Health

```bash
#!/bin/bash
# monitor.sh

while true; do
  synk server health
  sleep 60
done
```

## Troubleshooting

### "Connection refused" Error

```
Error: cannot connect to server at http://localhost:8080
```

**Solution:**
- Ensure server is running: `docker compose ps`
- Check server URL: `synk config show`
- Check firewall: `curl http://localhost:8080/health`

### "Authentication failed" Error

```
Error: invalid credentials
```

**Solution:**
- Verify credentials: `synk auth status`
- Re-login: `synk logout && synk login`
- Check token expiry: `synk auth status`

### "Permission denied" on config file

```
Error: permission denied: ~/.config/synkronus/config.yaml
```

**Solution:**
```bash
chmod 600 ~/.config/synkronus/config.yaml
```

### Command not found

```
synk: command not found
```

**Solution:**
- Check installation: `which synk`
- Add to PATH: `export PATH=$PATH:~/go/bin`
- Reinstall: `go install github.com/OpenDataEnsemble/ode/synkronus-cli@latest`

## License

The Synkronus CLI is currently **GPL-2.0-or-later** while it depends on GPL-classified QR code libraries. The plan is to swap in stdlib-only rendering and return to MIT license. See `synkronus-cli/FOLLOWUP-custom-qrcode-writer.md` and `THIRD_PARTY_NOTICES.md` for details.

## Related Content

- [Deployment Guide](/docs/guides/deployment) - Deploy Synkronus server
- [REST API](/docs/reference/rest-api/overview) - Programmatic API access
- [User Management](/docs/guides/configuration) - Manage access and permissions
- [Data Export](/docs/using/data-management) - Export observation data

```bash
synk status
```

**Output:**
```
Authenticated as: your-username
Server: http://localhost:8080
API Version: 1.0.0
Token expires: 2025-01-15 10:30:00
```

### Logout

Clear authentication:

```bash
synk logout
```

## App Bundle Management

### List Versions

List all available app bundle versions:

```bash
synk app-bundle versions
```

**Output:**
```
Available app bundle versions:
  20250114-123456 * (current)
  20250113-120000
  20250112-110000
```

### Get Manifest

Get the current app bundle manifest:

```bash
synk app-bundle manifest
```

### Download Bundle

Download the entire app bundle:

```bash
synk app-bundle download --output ./app-bundle
```

### Download Specific File

Download a specific file from the bundle:

```bash
synk app-bundle download index.html
synk app-bundle download assets/css/styles.css
```

### Upload Bundle

Upload a new app bundle (admin only):

```bash
synk app-bundle upload bundle.zip
```

**Options:**
- `--activate`: Automatically activate the uploaded bundle
- `--skip-validation`: Skip bundle validation (not recommended)
- `--verbose`: Show detailed output

**Example:**
```bash
synk app-bundle upload bundle.zip --activate --verbose
```

### Switch Version

Switch to a specific app bundle version (admin only):

```bash
synk app-bundle switch 20250114-123456
```

## Data Synchronization

### Pull Data

Pull data from the server:

```bash
synk sync pull output.json --client-id your-client-id
```

**Options:**
- `--client-id`: Client identifier (required)
- `--current-version`: Last known version number
- `--after-change-id`: Pull changes after specific change ID
- `--schema-types`: Filter by schema types (comma-separated)
- `--limit`: Maximum number of records to pull

**Examples:**
```bash
# Pull all data
synk sync pull data.json --client-id client-123

# Pull with filters
synk sync pull data.json --client-id client-123 \
  --after-change-id 1234 \
  --schema-types survey,visit \
  --limit 100
```

### Push Data

Push data to the server:

```bash
synk sync push data.json
```

The JSON file should contain observations in the sync format.

## Data Export

### Export Observations

Export all observations as a Parquet ZIP archive:

```bash
synk data export exports.zip
```

**Options:**
- `--output` or `-o`: Output file path
- `--format`: Export format (parquet, json, csv)

**Examples:**
```bash
# Export to Parquet ZIP
synk data export observations.zip

# Export to specific directory
synk data export ./backups/observations_20250114.zip

# Export to JSON
synk data export observations.json --format json
```

## User Management

### Create User

Create a new user (admin only):

```bash
synk user create --username newuser --password secret --role read-write
```

**Options:**
- `--username`: Username (required)
- `--password`: Password (required)
- `--role`: User role (read-only, read-write, admin)

### List Users

List all users:

```bash
synk user list
```

### Get User

Get user details:

```bash
synk user get username
```

### Update User

Update user information:

```bash
synk user update username --password newpassword --role read-write
```

### Delete User

Delete a user:

```bash
synk user delete username
```

## QR Code Generation

### Generate Login QR Code

Generate a QR code for Formulus app configuration:

```bash
synk qr login --output login-qr.png
```

**Options:**
- `--output` or `-o`: Output file path
- `--server-url`: Override server URL
- `--username`: Username to include
- `--password`: Password to include

### Generate Admin QR Code

Generate admin configuration QR code:

```bash
synk qr admin --output admin-qr.png
```

## Shell Completion

The CLI supports shell completion for bash, zsh, fish, and PowerShell.

<Tabs>
  <TabItem value="bash" label="Bash">

```bash
# Current session
source <(synk completion bash)

# Persistent (Linux)
sudo synk completion bash > /etc/bash_completion.d/synk

# Persistent (macOS)
synk completion bash > /usr/local/etc/bash_completion.d/synk
```

  </TabItem>
  <TabItem value="zsh" label="Zsh">

```bash
# Current session
source <(synk completion zsh)

# Persistent
echo "[[ \$commands[synk] ]] && synk completion zsh > \"\${fpath[1]}/_synk\"" >> ~/.zshrc
```

  </TabItem>
  <TabItem value="fish" label="Fish">

```bash
# Current session
synk completion fish | source

# Persistent
synk completion fish > ~/.config/fish/completions/synk.fish
```

  </TabItem>
  <TabItem value="powershell" label="PowerShell">

```powershell
# Current session
synk completion powershell | Out-String | Invoke-Expression

# Persistent (add to profile)
Add-Content -Path $PROFILE -Value "synk completion powershell | Out-String | Invoke-Expression"
```

  </TabItem>
</Tabs>

## Command Reference

### Global Flags

- `--config`: Specify configuration file
- `--verbose` or `-v`: Verbose output
- `--help` or `-h`: Show help
- `--version`: Show version

### Command Structure

```
synk [global-flags] <command> [command-flags] [arguments]
```

## Examples

### Complete Workflow

```bash
# 1. Configure CLI
synk config init -o ~/.synkronus.yaml

# 2. Login
synk login --username admin

# 3. Upload app bundle
synk app-bundle upload bundle.zip --activate

# 4. Create user
synk user create --username fieldworker --password secret --role read-write

# 5. Generate QR code for user
synk qr login --username fieldworker --password secret --output qr.png

# 6. Export data
synk data export observations.zip
```

### Development Workflow

```bash
# Switch to dev server
synk config use ~/.synkronus-dev.yaml

# Test sync
synk sync pull test.json --client-id test-client

# Upload test bundle
synk app-bundle upload test-bundle.zip --activate --verbose
```

## Error Handling

### Common Errors

**Authentication Failed:**
```
Error: authentication failed: invalid credentials
```
Solution: Verify username and password, check server is running

**Server Unreachable:**
```
Error: unable to connect to server
```
Solution: Check server URL, verify network connectivity

**Permission Denied:**
```
Error: permission denied: admin role required
```
Solution: Use admin account or request permissions

### Debug Mode

Enable verbose output for debugging:

```bash
synk --verbose <command>
```

## Best Practices

1. **Use Configuration Files**: Store server URLs and settings in config files
2. **Version Control**: Track app bundle versions carefully
3. **Backup Data**: Regularly export data using `synk data export`
4. **Test First**: Test commands on dev server before production
5. **Use Shell Completion**: Enable completion for better UX

## Related Documentation

- [Synkronus Server Reference](/docs/reference/synkronus-server) - Server API documentation
- [App Bundle Format](/docs/reference/app-bundle-format) - Bundle structure
- [API Reference](/docs/reference/rest-api/overview) - Complete API documentation
- [Deployment Guide](/docs/guides/deployment) - Server deployment

