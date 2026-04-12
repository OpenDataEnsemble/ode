[CmdletBinding()]
param(
    [string]$Version = "latest",
    [string]$Owner = "OpenDataEnsemble",
    [string]$Repo = "ode",
    [string]$AssetName = "synkronus-cli-windows-amd.zip",
    [string]$BinaryName = "synk.exe",
    [string]$CommandName = "synk",
    [string]$InstallDir = "$env:LOCALAPPDATA\Programs\synkronus-cli"
)

$ErrorActionPreference = "Stop"

function Write-Step($Message) {
    Write-Host "==> $Message"
}

function Ensure-CommandAvailable($CommandName) {
    if (-not (Get-Command $CommandName -ErrorAction SilentlyContinue)) {
        throw "Required command not found: $CommandName"
    }
}

function Get-DownloadUrl {
    param(
        [string]$Owner,
        [string]$Repo,
        [string]$Version,
        [string]$AssetName
    )

    if ($Version -eq "latest") {
        return "https://github.com/$Owner/$Repo/releases/latest/download/$AssetName"
    }

    return "https://github.com/$Owner/$Repo/releases/download/$Version/$AssetName"
}

function Add-ToUserPathIfMissing {
    param([string]$PathToAdd)

    $currentUserPath = [Environment]::GetEnvironmentVariable("Path", "User")
    $pathEntries = @()

    if ($currentUserPath) {
        $pathEntries = $currentUserPath.Split(";") | Where-Object { $_.Trim() -ne "" }
    }

    $alreadyPresent = $pathEntries | Where-Object {
        [System.StringComparer]::OrdinalIgnoreCase.Equals($_.TrimEnd("\"), $PathToAdd.TrimEnd("\"))
    }

    if (-not $alreadyPresent) {
        $newPath = if ($currentUserPath -and $currentUserPath.Trim() -ne "") {
            "$currentUserPath;$PathToAdd"
        } else {
            $PathToAdd
        }

        [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
        Write-Host "Added to user PATH: $PathToAdd"
        Write-Host "Open a new terminal for the PATH change to take effect."
    }
    else {
        Write-Host "Install directory already present in user PATH."
    }
}

function Add-SynkProfileBlock {
    param(
        [string]$ProfilePath,
        [string]$InstallDir,
        [string]$BinaryName,
        [string]$CommandName
    )

    $profileDir = Split-Path $ProfilePath -Parent
    if (-not (Test-Path $profileDir)) {
        New-Item -ItemType Directory -Path $profileDir -Force | Out-Null
    }

    if (-not (Test-Path $ProfilePath)) {
        New-Item -ItemType File -Path $ProfilePath -Force | Out-Null
    }

    $existing = Get-Content $ProfilePath -Raw -ErrorAction SilentlyContinue
    if ($null -eq $existing) {
        $existing = ""
    }

    $markerStart = "# >>> synkronus-cli >>>"
    $markerEnd = "# <<< synkronus-cli <<<"

    $block = @"

$markerStart
`$synkExe = Join-Path "$InstallDir" "$BinaryName"
if (Test-Path `$synkExe) {
    Set-Alias -Name $CommandName -Value `$synkExe -Scope Global
    try {
        $CommandName completion powershell | Out-String | Invoke-Expression
    } catch {
        Write-Verbose "Failed to load $CommandName PowerShell completion."
    }
}
$markerEnd
"@

    if ($existing -match [regex]::Escape($markerStart)) {
        $pattern = [regex]::Escape($markerStart) + '.*?' + [regex]::Escape($markerEnd)
        $updated = [regex]::Replace(
            $existing,
            $pattern,
            [System.Text.RegularExpressions.MatchEvaluator]{ param($m) $block },
            [System.Text.RegularExpressions.RegexOptions]::Singleline
        )
        Set-Content -Path $ProfilePath -Value $updated
        Write-Host "Updated existing synkronus-cli profile block in $ProfilePath"
    }
    else {
        if ($existing.Length -gt 0 -and -not $existing.EndsWith([Environment]::NewLine)) {
            Add-Content -Path $ProfilePath -Value ""
        }
        Add-Content -Path $ProfilePath -Value $block
        Write-Host "Added synkronus-cli alias and completion to $ProfilePath"
    }
}

Ensure-CommandAvailable "Invoke-WebRequest"
Ensure-CommandAvailable "Expand-Archive"

$downloadUrl = Get-DownloadUrl -Owner $Owner -Repo $Repo -Version $Version -AssetName $AssetName
$tempRoot = Join-Path $env:TEMP ("synkronus-cli-install-" + [guid]::NewGuid().ToString("N"))
$archivePath = Join-Path $tempRoot $AssetName
$extractDir = Join-Path $tempRoot "extract"
$binaryPath = Join-Path $InstallDir $BinaryName

try {
    Write-Step "Preparing temporary workspace"
    New-Item -ItemType Directory -Path $tempRoot -Force | Out-Null
    New-Item -ItemType Directory -Path $extractDir -Force | Out-Null

    Write-Step "Downloading $downloadUrl"
    Invoke-WebRequest -Uri $downloadUrl -OutFile $archivePath

    Write-Step "Extracting archive"
    Expand-Archive -Path $archivePath -DestinationPath $extractDir -Force

    Write-Step "Finding executable"
    $exe = Get-ChildItem -Path $extractDir -Recurse -File | Where-Object { $_.Name -eq $BinaryName } | Select-Object -First 1
    if (-not $exe) {
        throw "Could not find $BinaryName inside archive $AssetName"
    }

    Write-Step "Installing to $InstallDir"
    if (Test-Path $InstallDir) {
        Remove-Item -Path $InstallDir -Recurse -Force
    }
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    Copy-Item -Path $exe.FullName -Destination $binaryPath -Force

    Write-Step "Updating PATH"
    Add-ToUserPathIfMissing -PathToAdd $InstallDir

    Write-Step "Updating PowerShell profile"
    Add-SynkProfileBlock `
        -ProfilePath $PROFILE.CurrentUserAllHosts `
        -InstallDir $InstallDir `
        -BinaryName $BinaryName `
        -CommandName $CommandName

    Write-Step "Done"
    Write-Host ""
    Write-Host "Installed: $binaryPath"
    Write-Host "Open a new PowerShell window, then try:"
    Write-Host "  $CommandName --help"
}
finally {
    if (Test-Path $tempRoot) {
        Remove-Item -Path $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}
