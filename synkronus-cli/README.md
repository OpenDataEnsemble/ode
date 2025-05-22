# Synkronus CLI

A command-line interface for interacting with the Synkronus API.

## Features

- Authentication with JWT tokens
- App bundle management (download, upload, version management)
- Data synchronization (push and pull)
- Configuration management

## Installation

```bash
go install github.com/HelloSapiens/collectivus/synkronus-cli/cmd/synkronus@latest
```

Or build from source:

```bash
git clone https://github.com/HelloSapiens/collectivus/synkronus-cli.git
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

## License

MIT


## Dev. notes
Build with: `go build -o bin/synk.exe ./cmd/synkronus`
Run with: `bin/synk.exe`

Icon: configured in versioninfo.json and built with goversioninfo `goversioninfo -o cmd/synkronus/resource.syso` to create a syso file next to main go file.