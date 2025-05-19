# PowerShell script to generate Go code from OpenAPI specification
Write-Host "Generating API code from OpenAPI specification..." -ForegroundColor Green

# Check if oapi-codegen is installed
if (-not (Get-Command "oapi-codegen" -ErrorAction SilentlyContinue)) {
    Write-Host "oapi-codegen is not installed. Installing now..." -ForegroundColor Yellow
    go install github.com/deepmap/oapi-codegen/cmd/oapi-codegen@latest
}

# Create the output directory if it doesn't exist
$outputDir = "$PSScriptRoot\..\internal\api\generated"
if (-not (Test-Path -Path $outputDir -PathType Container)) {
    New-Item -ItemType Directory -Path $outputDir -Force
}

# Set path variables - ensure correct paths using full paths
$configPath = "$PSScriptRoot\..\pkg\openapi\oapi-codegen.yaml"
$openapiPath = "$PSScriptRoot\..\openapi\synkronus.yaml"
$outputPath = "$outputDir\generated.go"

# Log the paths for debugging
Write-Host "Config path: $configPath" -ForegroundColor Cyan
Write-Host "OpenAPI spec path: $openapiPath" -ForegroundColor Cyan
Write-Host "Output path: $outputPath" -ForegroundColor Cyan

# Verify files exist
if (-not (Test-Path -Path $configPath)) {
    Write-Host "Error: Config file not found at: $configPath" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path -Path $openapiPath)) {
    Write-Host "Error: OpenAPI spec file not found at: $openapiPath" -ForegroundColor Red
    exit 1
}

# Generate models
Write-Host "Running oapi-codegen..." -ForegroundColor Yellow
oapi-codegen -config $configPath $openapiPath > $outputPath

# Check if generation was successful
if (Test-Path -Path $outputPath) {
    Write-Host "API code generation completed successfully!" -ForegroundColor Green
    Write-Host "Generated API code at: $outputPath" -ForegroundColor Cyan
} else {
    Write-Host "API code generation failed!" -ForegroundColor Red
}