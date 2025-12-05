# Synkronus CLI

A command-line interface for interacting with the Synkronus API.

## Features

- Authentication with JWT tokens
- App bundle management (download, upload, version management)
- Data synchronization (push and pull)
- Data export as Parquet ZIP archives
- Configuration management

## Installation

```bash
go install github.com/OpenDataEnsemble/ode/synkronus-cli/cmd/synkronus@latest
```

Or build from source:

```bash
git clone https://github.com/OpenDataEnsemble/ode/synkronus-cli.git
cd synkronus-cli
go build -o bin/synk ./cmd/synkronus
```

## Configuration

The CLI uses a configuration file located at `$HOME/.synkronus.yaml`. You can specify a different configuration file using the `--config` flag.

Example configuration:

```yaml
api:
  url: http://localhost:8080
  version: 1.0.0
```

## Shell Completion

The Synkronus CLI includes built-in support for shell completion in bash, zsh, fish, and PowerShell.
Use `synk completion [bash|zsh|fish|powershell]` to generate the completion script. In powershell you can load it directly for the current session with:

```powershell
.\synk.exe completion powershell | Out-String | Invoke-Expression
```

### Enabling Shell Completion

#### Bash

```bash
# For the current session:
source <(synk completion bash)

# For persistent use (Linux):
sudo synk completion bash > /etc/bash_completion.d/synk

# For persistent use (macOS):
synk completion bash > /usr/local/etc/bash_completion.d/synk
```

#### Zsh

```bash
# For the current session:
source <(synk completion zsh)

# For persistent use:
echo "[[ $commands[synk] ]] && synk completion zsh > "${fpath[1]}/_synk"" >> ~/.zshrc
```

#### Fish

```bash
# For the current session:
synk completion fish | source

# For persistent use:
synk completion fish > ~/.config/fish/completions/synk.fish
```

#### PowerShell

```powershell
# For the current session:
synk completion powershell | Out-String | Invoke-Expression

# For persistent use (add to your PowerShell profile):
Add-Content -Path $PROFILE -Value "# Synkronus CLI Completion"
Add-Content -Path $PROFILE -Value "synk completion powershell | Out-String | Invoke-Expression"
```

## Usage

### Authentication

```bash
# Login to the API
synk login --username your-username

# Check authentication status
synk status

# Logout
synk logout
```

### App Bundle Management

```bash
# Get app bundle manifest
synk /app-bundle/download/manifest

# List available app bundle versions
synk app-bundle versions

# Download app bundle files
synk /app-bundle/download --output ./app-bundle

# Download a specific file
synk app-bundle download index.html

# Upload a new app bundle (admin only)
synk app-bundle upload bundle.zip

# Switch to a specific app bundle version (admin only)
synk app-bundle switch 20250507-123456
```

### Data Synchronization

```bash
# Pull data from the server
synk sync pull --client-id your-client-id

# Pull with filters
synk sync pull --client-id your-client-id --after-change-id 1234 --schema-types form,submission

# Push data to the server
synk sync push data.json
```

### Data Export

```bash
# Export all observations as a Parquet ZIP archive
synk data export exports.zip

# Export to a specific directory
synk data export ./backups/observations_parquet.zip
```

## License

MIT


## Dev. notes
Build with: `go build -o bin/synk.exe ./cmd/synkronus`
Run with: `bin/synk.exe`

Icon: configured in versioninfo.json and built with goversioninfo `goversioninfo -o cmd/synkronus/resource.syso` to create a syso file next to main go file.