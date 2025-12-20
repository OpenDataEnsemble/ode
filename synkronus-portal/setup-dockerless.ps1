# Synkronus Portal - Dockerless Development Setup Script
# This script helps set up the development environment without Docker

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Synkronus Portal - Dockerless Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check prerequisites
Write-Host "Checking prerequisites..." -ForegroundColor Yellow

# Check Node.js
try {
    $nodeVersion = node --version
    Write-Host "✓ Node.js found: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Node.js not found. Please install Node.js 20+ from https://nodejs.org/" -ForegroundColor Red
    exit 1
}

# Check Go
try {
    $goVersion = go version
    Write-Host "✓ Go found: $goVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Go not found. Please install Go 1.22+ from https://go.dev/doc/install" -ForegroundColor Red
    exit 1
}

# Check PostgreSQL
try {
    $pgVersion = psql --version
    Write-Host "✓ PostgreSQL found: $pgVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ PostgreSQL not found. Please install PostgreSQL 17+ from https://www.postgresql.org/download/" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "All prerequisites found!" -ForegroundColor Green
Write-Host ""

# Get PostgreSQL password
Write-Host "PostgreSQL Setup" -ForegroundColor Cyan
Write-Host "Enter PostgreSQL superuser password (default: postgres):" -ForegroundColor Yellow
$pgPassword = Read-Host
if ([string]::IsNullOrWhiteSpace($pgPassword)) {
    $pgPassword = "postgres"
}

# Set environment variable for psql
$env:PGPASSWORD = $pgPassword

# Create database and user
Write-Host ""
Write-Host "Creating database and user..." -ForegroundColor Yellow

try {
    # Create database
    psql -U postgres -c "CREATE DATABASE synkronus;" 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Database 'synkronus' created" -ForegroundColor Green
    } else {
        Write-Host "⚠ Database may already exist (this is OK)" -ForegroundColor Yellow
    }

    # Create user
    psql -U postgres -c "CREATE USER synkronus_user WITH PASSWORD 'dev_password_change_in_production';" 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ User 'synkronus_user' created" -ForegroundColor Green
    } else {
        Write-Host "⚠ User may already exist (this is OK)" -ForegroundColor Yellow
    }

    # Grant privileges
    psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE synkronus TO synkronus_user;" 2>&1 | Out-Null
    Write-Host "✓ Privileges granted" -ForegroundColor Green

    # Grant schema privileges
    psql -U postgres -d synkronus -c "GRANT ALL ON SCHEMA public TO synkronus_user;" 2>&1 | Out-Null
    psql -U postgres -d synkronus -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO synkronus_user;" 2>&1 | Out-Null
    psql -U postgres -d synkronus -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO synkronus_user;" 2>&1 | Out-Null
    Write-Host "✓ Schema privileges granted" -ForegroundColor Green

} catch {
    Write-Host "✗ Error setting up database: $_" -ForegroundColor Red
    exit 1
}

# Setup backend
Write-Host ""
Write-Host "Setting up backend (Synkronus API)..." -ForegroundColor Cyan

$synkronusPath = Join-Path $PSScriptRoot ".." "synkronus"
if (-not (Test-Path $synkronusPath)) {
    Write-Host "✗ Synkronus directory not found at: $synkronusPath" -ForegroundColor Red
    Write-Host "  Please ensure you're running this from the synkronus-portal directory" -ForegroundColor Yellow
    exit 1
}

Push-Location $synkronusPath

# Create .env file
$envContent = @"
PORT=8080
LOG_LEVEL=debug
DB_CONNECTION=postgres://synkronus_user:dev_password_change_in_production@localhost:5432/synkronus?sslmode=disable
JWT_SECRET=dev_jwt_secret_change_in_production_32chars
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin
APP_BUNDLE_PATH=./data/app-bundles
MAX_VERSIONS_KEPT=5
"@

$envFile = Join-Path $synkronusPath ".env"
if (Test-Path $envFile) {
    Write-Host "⚠ .env file already exists, skipping creation" -ForegroundColor Yellow
} else {
    $envContent | Out-File -FilePath $envFile -Encoding utf8
    Write-Host "✓ Created .env file" -ForegroundColor Green
}

# Create app bundles directory
$bundlesDir = Join-Path $synkronusPath "data" "app-bundles"
if (-not (Test-Path $bundlesDir)) {
    New-Item -ItemType Directory -Path $bundlesDir -Force | Out-Null
    Write-Host "✓ Created app bundles directory" -ForegroundColor Green
}

# Download Go dependencies
Write-Host "Downloading Go dependencies..." -ForegroundColor Yellow
go mod download
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Go dependencies downloaded" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to download Go dependencies" -ForegroundColor Red
    Pop-Location
    exit 1
}

Pop-Location

# Setup frontend
Write-Host ""
Write-Host "Setting up frontend (Portal)..." -ForegroundColor Cyan

Push-Location $PSScriptRoot

# Install npm dependencies
if (Test-Path "node_modules") {
    Write-Host "⚠ node_modules already exists, skipping npm install" -ForegroundColor Yellow
} else {
    Write-Host "Installing npm dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ npm dependencies installed" -ForegroundColor Green
    } else {
        Write-Host "✗ Failed to install npm dependencies" -ForegroundColor Red
        Pop-Location
        exit 1
    }
}

Pop-Location

# Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Start the backend API:" -ForegroundColor Cyan
Write-Host "   cd ../synkronus" -ForegroundColor White
Write-Host "   go run cmd/synkronus/main.go" -ForegroundColor White
Write-Host ""
Write-Host "2. In another terminal, start the frontend:" -ForegroundColor Cyan
Write-Host "   cd synkronus-portal" -ForegroundColor White
Write-Host "   npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "3. Open http://localhost:5174 in your browser" -ForegroundColor Cyan
Write-Host "   Login with: admin / admin" -ForegroundColor Cyan
Write-Host ""
Write-Host "For detailed instructions, see README.md" -ForegroundColor Yellow
Write-Host ""

