$ErrorActionPreference = "Stop"

# Get version info
$version = git describe --tags --always --dirty
$commit = git rev-parse HEAD
$buildTime = Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ"

# Create bin directory if it doesn't exist
if (-not (Test-Path -Path "bin")) {
    New-Item -ItemType Directory -Path "bin" | Out-Null
}

# Build the application
$ldflags = "-X 'github.com/opendataensemble/synkronus/pkg/version.version=$version' " +
           "-X 'github.com/opendataensemble/synkronus/pkg/version.commit=$commit' " +
           "-X 'github.com/opendataensemble/synkronus/pkg/version.buildTime=$buildTime'"

go build -ldflags="$ldflags" -o bin/synkronus.exe cmd/synkronus/main.go

if ($LASTEXITCODE -eq 0) {
    Write-Host "Build successful! Output: bin/synkronus.exe" -ForegroundColor Green
}