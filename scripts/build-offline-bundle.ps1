<#
.SYNOPSIS
    Builds a versioned, institute-neutral AMIS offline installation kit.

.DESCRIPTION
    Builds the application images from a clean tagged release, packages the
    install-kit tree and database migrations, vendors the documentation assets,
    and emits a ZIP archive with a SHA-256 checksum.

.PARAMETER Version
    Release version. HEAD must have an exact matching v<Version> or <Version> tag.

.EXAMPLE
    .\scripts\build-offline-bundle.ps1 -Version 3.1.0
#>
param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^\d+\.\d+\.\d+([+-][0-9A-Za-z.-]+)?$')]
    [string]$Version
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Invoke-Docker {
    param([string[]]$Arguments)
    & docker @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "docker $($Arguments -join ' ') failed with exit code $LASTEXITCODE."
    }
}

$RepoRoot = Split-Path -Parent $PSScriptRoot
$KitSource = Join-Path $RepoRoot "install-kit"
$MigrationSource = Join-Path $RepoRoot "db\migrations"
$DistRoot = Join-Path $RepoRoot "dist"
$PackageName = "amis-offline-kit-$Version"
$PackageRoot = Join-Path $DistRoot $PackageName
$ArchivePath = Join-Path $DistRoot "$PackageName.zip"
$ChecksumPath = "$ArchivePath.sha256"

if (-not (Test-Path (Join-Path $RepoRoot ".git"))) {
    throw "Run this builder from a Git checkout."
}

$GitStatus = & git -C $RepoRoot status --porcelain --untracked-files=all
if ($LASTEXITCODE -ne 0) {
    throw "Unable to read Git worktree status."
}
if ($GitStatus) {
    throw "Refusing to build from a dirty worktree. Use a clean release-tag checkout."
}

$Commit = (& git -C $RepoRoot rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0) {
    throw "Unable to determine the source commit."
}
$Tags = @(& git -C $RepoRoot tag --points-at HEAD)
if ($LASTEXITCODE -ne 0) {
    throw "Unable to determine release tags."
}
if (($Tags -notcontains "v$Version") -and ($Tags -notcontains $Version)) {
    throw "HEAD must have an exact v$Version or $Version Git tag."
}

if (-not (Test-Path $KitSource -PathType Container)) {
    throw "Missing install-kit source directory."
}
if (-not (Test-Path $MigrationSource -PathType Container)) {
    throw "Missing database migrations directory."
}
if ((Test-Path $PackageRoot) -or (Test-Path $ArchivePath) -or (Test-Path $ChecksumPath)) {
    throw "The output for version $Version already exists. Move it before rebuilding."
}

$Migrations = @(Get-ChildItem -LiteralPath $MigrationSource -Filter "*.sql" -File | Sort-Object Name)
if ($Migrations.Count -eq 0) {
    throw "No database migrations were found."
}

New-Item -ItemType Directory -Force -Path $DistRoot, $PackageRoot | Out-Null
Get-ChildItem -LiteralPath $KitSource -Force |
    Copy-Item -Destination $PackageRoot -Recurse -Force

# The first supported VTI kit targets Ubuntu Server; do not ship unvalidated
# PowerShell entry points as supported installation instructions.
$PowerShellEntrypoints = @((Join-Path $PackageRoot "install.ps1"))
$PowerShellEntrypoints += @(
    Get-ChildItem -LiteralPath (Join-Path $PackageRoot "scripts") -Filter "*.ps1" -File |
        ForEach-Object { $_.FullName }
)
$PowerShellEntrypoints += @(
    Join-Path $PackageRoot "scripts\prepare-offline-docs.sh"
)
foreach ($Path in $PowerShellEntrypoints) {
    if (Test-Path $Path -PathType Leaf) {
        Remove-Item -LiteralPath $Path -Force
    }
}

$PackageMigrations = Join-Path $PackageRoot "db\migrations"
New-Item -ItemType Directory -Force -Path $PackageMigrations | Out-Null
Copy-Item -LiteralPath $Migrations.FullName -Destination $PackageMigrations

$ImageDirectory = Join-Path $PackageRoot "images"
New-Item -ItemType Directory -Force -Path $ImageDirectory | Out-Null

Write-Host "Pulling runtime base images..."
Invoke-Docker -Arguments @("pull", "postgres:16-alpine")
Invoke-Docker -Arguments @("pull", "ghcr.io/amacneil/dbmate:latest")

Write-Host "Building AMIS API image..."
Invoke-Docker -Arguments @(
    "build",
    "--file", (Join-Path $RepoRoot "apps\api\Dockerfile"),
    "--tag", "amis-api:offline",
    $RepoRoot
)

Write-Host "Building institute-neutral self-hosted Web image..."
Invoke-Docker -Arguments @(
    "build",
    "--file", (Join-Path $RepoRoot "apps\web\Dockerfile"),
    "--build-arg", "VITE_API_URL=",
    "--build-arg", "VITE_APP_ENV=offline",
    "--build-arg", "VITE_SELF_HOSTED_MODE=true",
    "--tag", "amis-web:offline",
    $RepoRoot
)

Invoke-Docker -Arguments @("tag", "postgres:16-alpine", "amis-postgres:offline")
Invoke-Docker -Arguments @("tag", "ghcr.io/amacneil/dbmate:latest", "amis-dbmate:offline")

$Images = @(
    @{ Name = "postgres"; Tag = "amis-postgres:offline"; File = "postgres.tar" },
    @{ Name = "amis-api"; Tag = "amis-api:offline"; File = "amis-api.tar" },
    @{ Name = "amis-web"; Tag = "amis-web:offline"; File = "amis-web.tar" },
    @{ Name = "dbmate"; Tag = "amis-dbmate:offline"; File = "dbmate.tar" }
)

foreach ($Image in $Images) {
    Write-Host "Saving $($Image.Tag)..."
    Invoke-Docker -Arguments @(
        "save", $Image.Tag, "--output",
        (Join-Path $ImageDirectory $Image.File)
    )
}

$DocsVendor = Join-Path $PackageRoot "docs\vendor"
New-Item -ItemType Directory -Force -Path $DocsVendor | Out-Null
$DocAssets = @(
    @{ Url = "https://cdn.jsdelivr.net/npm/docsify@4/lib/docsify.min.js"; File = "docsify.min.js" },
    @{ Url = "https://cdn.jsdelivr.net/npm/docsify@4/lib/themes/vue.css"; File = "vue.css" },
    @{ Url = "https://cdn.jsdelivr.net/npm/prismjs@1/components/prism-bash.min.js"; File = "prism-bash.min.js" },
    @{ Url = "https://cdn.jsdelivr.net/npm/prismjs@1/components/prism-powershell.min.js"; File = "prism-powershell.min.js" },
    @{ Url = "https://cdn.jsdelivr.net/npm/prismjs@1/components/prism-sql.min.js"; File = "prism-sql.min.js" },
    @{ Url = "https://cdn.jsdelivr.net/npm/docsify-copy-code@2/dist/docsify-copy-code.min.js"; File = "docsify-copy-code.min.js" }
)
foreach ($Asset in $DocAssets) {
    Invoke-WebRequest -Uri $Asset.Url -OutFile (Join-Path $DocsVendor $Asset.File) -UseBasicParsing
}

Set-Content -LiteralPath (Join-Path $PackageRoot "VERSION") -Value $Version -Encoding ASCII

$ImageManifest = foreach ($Image in $Images) {
    $FilePath = Join-Path $ImageDirectory $Image.File
    @{
        reference = $Image.Tag
        archive = $Image.File
        sha256 = (Get-FileHash -LiteralPath $FilePath -Algorithm SHA256).Hash.ToLowerInvariant()
    }
}

$Manifest = @{
    version = $Version
    sourceCommit = $Commit
    sourceTag = if ($Tags -contains "v$Version") { "v$Version" } else { $Version }
    builtAtUtc = [DateTime]::UtcNow.ToString("o")
    target = @{
        operatingSystem = "Ubuntu Server"
        architecture = "x86_64"
    }
    migrationCount = $Migrations.Count
    latestMigration = $Migrations[-1].BaseName
    images = @($ImageManifest)
}
$Manifest | ConvertTo-Json -Depth 5 |
    Set-Content -LiteralPath (Join-Path $PackageRoot "RELEASE-MANIFEST.json") -Encoding UTF8

Compress-Archive -Path (Join-Path $PackageRoot "*") -DestinationPath $ArchivePath -CompressionLevel Optimal
$ArchiveHash = (Get-FileHash -LiteralPath $ArchivePath -Algorithm SHA256).Hash.ToLowerInvariant()
Set-Content -LiteralPath $ChecksumPath -Value "$ArchiveHash  $([IO.Path]::GetFileName($ArchivePath))" -Encoding ASCII

Write-Host ""
Write-Host "Offline kit created:" -ForegroundColor Green
Write-Host "  Package : $PackageRoot"
Write-Host "  Archive : $ArchivePath"
Write-Host "  SHA-256 : $ChecksumPath"
Write-Host "  Commit  : $Commit"
