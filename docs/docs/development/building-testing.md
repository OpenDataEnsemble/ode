---
sidebar_position: 4
---

# Building & Testing

Complete guide to building ODE components from source and running tests.

## Building from Source

### Formulus

Build the React Native mobile application:

<Tabs>
  <TabItem value="dev" label="Development Build">

```bash
cd formulus
cd ../packages/tokens && pnpm install && pnpm run build && cd ../formulus
pnpm install
pnpm run android  # For Android
pnpm run ios      # For iOS (macOS only)
```

  </TabItem>
  <TabItem value="android-prod" label="Android Production">

```bash
cd formulus/android
./gradlew assembleRelease
```

APK will be in `android/app/build/outputs/apk/release/`

  </TabItem>
  <TabItem value="ios-prod" label="iOS Production (macOS only)">

```bash
cd formulus/ios
xcodebuild -workspace Formulus.xcworkspace -scheme Formulus -configuration Release
```

Or build from Xcode:
1. Open `Formulus.xcworkspace` in Xcode
2. Select "Any iOS Device" or specific device
3. Product → Archive
4. Distribute App

  </TabItem>
</Tabs>

### Formplayer

Build the React web form renderer:

```bash
cd ../packages/tokens && pnpm install && pnpm run build && cd ../formulus-formplayer
pnpm install
pnpm run build
```

**Build and copy into Formulus (and Desktop):**

```bash
pnpm run build:copy
```

This builds and copies the output to the Formulus app (and ODE Desktop when using the full pipeline).

### Synkronus

Build the Go server:

```bash
cd synkronus
go build -o bin/synkronus cmd/synkronus/main.go
```

**Cross-platform builds:**

<Tabs>
  <TabItem value="linux" label="Linux">

```bash
GOOS=linux GOARCH=amd64 go build -o bin/synkronus-linux cmd/synkronus/main.go
```

  </TabItem>
  <TabItem value="windows" label="Windows">

```powershell
$env:GOOS="windows"; $env:GOARCH="amd64"; go build -o bin/synkronus.exe cmd/synkronus/main.go
```

Or using bash (Git Bash/WSL):

```bash
GOOS=windows GOARCH=amd64 go build -o bin/synkronus.exe cmd/synkronus/main.go
```

  </TabItem>
  <TabItem value="mac" label="macOS">

```bash
GOOS=darwin GOARCH=amd64 go build -o bin/synkronus-macos cmd/synkronus/main.go
```

  </TabItem>
</Tabs>

### Synkronus CLI

Build the CLI:

```bash
cd synkronus-cli
go build -o bin/synk ./cmd/synkronus
```

## Testing

### Frontend Testing

#### Formulus

```bash
cd formulus
pnpm run test --ci --coverage --watchAll=false
```

Runs Jest tests with React Native Testing Library.

#### Formplayer

```bash
cd formulus-formplayer
pnpm run test run
```

Runs Vitest for React components.

### Backend Testing

#### Synkronus

```bash
cd synkronus
go test ./...
```

Run all tests:

```bash
# With coverage
go test -cover ./...

# Verbose output
go test -v ./...

# Specific package
go test ./internal/handlers
```

#### Integration Tests

```bash
# Run integration tests (requires database)
go test -tags=integration ./...
```

### End-to-End Testing

End-to-end testing infrastructure is under development. Current testing focuses on:

- Unit tests for individual components
- Integration tests for API endpoints
- Component tests for React components

E2E testing will be added as the testing infrastructure evolves.

## Code Quality Checks

### Linting

**Frontend:**

```bash
# Formulus
cd formulus
pnpm run lint
pnpm run lint:fix

# Formplayer
cd formulus-formplayer
pnpm run lint
pnpm run lint:fix
```

**Backend:**

```bash
# Synkronus
cd synkronus
golangci-lint run  # If configured
```

### Formatting

**Frontend:**

```bash
# Format code
pnpm run format

# Check formatting
pnpm run format:check
```

**Backend:**

```bash
# Format Go code
go fmt ./...

# Check with goimports
goimports -w .
```

## CI/CD Pipeline

The project uses GitHub Actions for continuous integration:

### Workflows

**Synkronus Docker Build:**
- Builds on relevant pushes to `main` or `dev`, pull requests, published GitHub Releases, and manual dispatches
- Publishes multi-platform images to GitHub Container Registry (pull requests build without publishing)
- Stable releases publish `v{version}`, major/minor pointers, and `latest`
- Pre-releases publish `v{version}-{pre}` and `latest-pre-release`
- Branch pushes publish `main` or `dev` plus an immutable `sha-{short}` tag
- Manual dispatches publish only `sha-{short}`; feature-branch images are not published automatically

See the [Deployment guide](/docs/guides/deployment) for the image-tag channels and recommended uses.

**Frontend Quality Checks:**
- Runs on all PRs
- Checks linting and formatting
- Runs tests
- Builds components

### Local CI Simulation

Run CI checks locally:

```bash
# Frontend
cd formulus && pnpm run lint && pnpm run format:check && pnpm run test --ci --coverage --watchAll=false
cd formulus-formplayer && pnpm run lint && pnpm run format:check && pnpm run test run

# Backend
cd synkronus && go test ./... && go fmt ./...
```

## Docker Builds

### Synkronus Docker Image

Build locally:

```bash
cd synkronus
docker build -t synkronus:local .
```

**Multi-platform build:**

```bash
docker buildx create --name multiplatform --use
docker buildx build --platform linux/amd64,linux/arm64 -t synkronus:local .
```

## Release Process

### Versioning

ODE follows semantic versioning (MAJOR.MINOR.PATCH):

- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

### Creating a Release

1. Update version numbers in:
   - `package.json` (frontend projects)
   - `versioninfo.json` (Go projects)
   - Documentation

2. Create release branch:

```bash
git checkout -b release/v1.0.0
```

3. Update changelog

4. Create tag:

```bash
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0
```

5. CI/CD will automatically:
   - Build Docker images
   - Publish to container registry
   - Create GitHub release

## Troubleshooting Build Issues

### Node Modules Issues

```bash
# Clear and reinstall
rm -rf node_modules
pnpm install
```

### Go Module Issues

```bash
# Clean module cache
go clean -modcache
go mod download
go mod tidy
```

### Android Build Issues

```bash
# Clean Android build
cd android
./gradlew clean
cd ..
pnpm run android
```

### iOS Build Issues

```bash
# Clean pods
cd ios
rm -rf Pods Podfile.lock
bundle exec pod install
cd ..
pnpm run ios
```

## Related Documentation

- [Development Setup](/development/setup)
- [Contributing Guide](/development/contributing)
- [Architecture Overview](/development/architecture)
