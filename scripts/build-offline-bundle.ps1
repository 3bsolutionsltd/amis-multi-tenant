<#
.SYNOPSIS
    Builds the AMIS offline deployment bundle for UTC Kyema on-premises server.

.DESCRIPTION
    1. Builds all Docker images (requires internet on the build machine)
    2. Saves images as .tar files in dist/offline-bundle/images/
    3. Packages deployment files (compose, migrations, env template, seed scripts)
    4. Output: dist/offline-bundle/ — copy to USB or transfer to UTC Kyema server

.PARAMETER ServerIp
    The LAN IP address of the UTC Kyema server. Default: 192.168.1.100
    This is baked into the web image at build time.
    If the server IP changes, re-run this script with the correct IP.

.EXAMPLE
    .\scripts\build-offline-bundle.ps1 -ServerIp 192.168.1.50

.NOTES
    Requires: Docker Desktop running, internet access (for pulling base images)
    Output size: ~600 MB (images compressed)
#>
param(
    [string]$ServerIp = "192.168.1.100"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$BundleDir = "dist\offline-bundle"
$ImagesDir = "$BundleDir\images"

Write-Host ""
Write-Host "=== AMIS Offline Bundle Builder ===" -ForegroundColor Cyan
Write-Host "  Server IP : $ServerIp"
Write-Host "  Output    : $BundleDir"
Write-Host ""

# ── Clean output dir ──────────────────────────────────────────────────────────
if (Test-Path $BundleDir) {
    Write-Host "Cleaning previous bundle..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force $BundleDir
}
New-Item -ItemType Directory -Force -Path $ImagesDir | Out-Null

# ── 1. Pull base images (ensures we have the latest before saving) ────────────
Write-Host "1. Pulling base images..." -ForegroundColor Cyan
docker pull postgres:16-alpine
if ($LASTEXITCODE -ne 0) { Write-Error "Failed to pull postgres image"; exit 1 }

docker pull ghcr.io/amacneil/dbmate:latest
if ($LASTEXITCODE -ne 0) { Write-Error "Failed to pull dbmate image"; exit 1 }

# ── 2. Build API image ────────────────────────────────────────────────────────
Write-Host ""
Write-Host "2. Building API image..." -ForegroundColor Cyan
docker build `
    -f apps/api/Dockerfile `
    -t amis-api:offline `
    .
if ($LASTEXITCODE -ne 0) { Write-Error "API image build failed"; exit 1 }
Write-Host "   amis-api:offline built" -ForegroundColor Green

# ── 3. Build Web image ────────────────────────────────────────────────────────
Write-Host ""
Write-Host "3. Building Web image (VITE_API_URL=http://${ServerIp}:3001)..." -ForegroundColor Cyan
docker build `
    -f apps/web/Dockerfile `
    --build-arg VITE_API_URL="http://${ServerIp}:3001" `
    --build-arg VITE_APP_ENV="offline" `
    -t amis-web:offline `
    .
if ($LASTEXITCODE -ne 0) { Write-Error "Web image build failed"; exit 1 }
Write-Host "   amis-web:offline built" -ForegroundColor Green

# ── 4. Re-tag dbmate for offline bundle ──────────────────────────────────────
docker tag ghcr.io/amacneil/dbmate:latest amis-dbmate:offline
docker tag postgres:16-alpine amis-postgres:offline

# ── 5. Save images as .tar files ─────────────────────────────────────────────
Write-Host ""
Write-Host "4. Saving images to $ImagesDir ..." -ForegroundColor Cyan

Write-Host "   Saving postgres..."
docker save amis-postgres:offline -o "$ImagesDir\postgres.tar"

Write-Host "   Saving API..."
docker save amis-api:offline -o "$ImagesDir\amis-api.tar"

Write-Host "   Saving Web..."
docker save amis-web:offline -o "$ImagesDir\amis-web.tar"

Write-Host "   Saving dbmate..."
docker save amis-dbmate:offline -o "$ImagesDir\dbmate.tar"

# ── 6. Copy deployment files ─────────────────────────────────────────────────
Write-Host ""
Write-Host "5. Copying deployment files..." -ForegroundColor Cyan

Copy-Item docker-compose.offline.yml $BundleDir\
Copy-Item .env.offline.example       $BundleDir\

# Migrations
New-Item -ItemType Directory -Force -Path "$BundleDir\db\migrations" | Out-Null
Copy-Item db\migrations\* "$BundleDir\db\migrations\" -Recurse

# UTC Kyema seed + migration scripts
if (Test-Path db\data-migration\utc-kyema) {
    New-Item -ItemType Directory -Force -Path "$BundleDir\db\data-migration\utc-kyema" | Out-Null
    Copy-Item db\data-migration\utc-kyema\* "$BundleDir\db\data-migration\utc-kyema\" -Recurse -Exclude "raw"
}

# Migration shared lib
New-Item -ItemType Directory -Force -Path "$BundleDir\db\data-migration\lib" | Out-Null
Copy-Item db\data-migration\lib\* "$BundleDir\db\data-migration\lib\"

# ── 7. Create load-images.ps1 helper for the server ──────────────────────────
$LoadScript = @"
# Run this script on the UTC Kyema server to load all Docker images.
# Requires Docker to be installed and running.
Write-Host 'Loading AMIS Docker images...'
docker load -i images\postgres.tar
docker load -i images\amis-api.tar
docker load -i images\amis-web.tar
docker load -i images\dbmate.tar
Write-Host 'All images loaded. Run: docker compose -f docker-compose.offline.yml --env-file .env.offline up -d'
"@
$LoadScript | Out-File -FilePath "$BundleDir\load-images.ps1" -Encoding utf8

# ── 8. Summary ────────────────────────────────────────────────────────────────
$TotalSize = (Get-ChildItem $BundleDir -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
Write-Host ""
Write-Host "=== Bundle complete ===" -ForegroundColor Green
Write-Host "  Location    : $BundleDir"
Write-Host "  Total size  : $([math]::Round($TotalSize)) MB"
Write-Host "  Server IP   : $ServerIp (baked into web image)"
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Copy $BundleDir to USB drive or transfer to UTC Kyema server"
Write-Host "  2. On the server: cd <bundle-dir> && .\load-images.ps1"
Write-Host "  3. Copy .env.offline.example → .env.offline and set passwords + JWT_SECRET"
Write-Host "  4. docker compose -f docker-compose.offline.yml --env-file .env.offline up -d"
Write-Host "  5. docker compose -f docker-compose.offline.yml --env-file .env.offline run --rm migrate"
Write-Host "  6. node db/data-migration/utc-kyema/phase1-seed.js"
Write-Host ""
