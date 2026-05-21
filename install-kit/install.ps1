<#
.SYNOPSIS  AMIS one-command installer (Windows Server / Docker Desktop)
.EXAMPLE   .\install.ps1
#>
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$KitDir       = $PSScriptRoot
$ComposeFile  = Join-Path $KitDir 'config\docker-compose.offline.yml'
$EnvFile      = Join-Path $KitDir 'config\.env.offline'
$EnvTemplate  = Join-Path $KitDir 'config\.env.offline.example'

function Cyan ($m) { Write-Host $m -ForegroundColor Cyan }
function Green($m) { Write-Host $m -ForegroundColor Green }
function Warn ($m) { Write-Host $m -ForegroundColor Yellow }
function Red  ($m) { Write-Host $m -ForegroundColor Red }

Cyan "============================================="
Cyan "  AMIS Offline Installer (Windows)"
Cyan "============================================="
""

# ── 1. Pre-flight ──────────────────────────────────────────────
Cyan "[1/6] Checking prerequisites..."
try { docker --version | Out-Null } catch { Red "Docker not installed."; exit 1 }
try { docker compose version | Out-Null } catch { Red "Docker Compose plugin missing."; exit 1 }
try { docker info | Out-Null } catch { Red "Docker daemon not reachable."; exit 1 }
Green ("  Docker OK ({0})" -f (docker --version))

# ── 2. Load images ─────────────────────────────────────────────
Cyan "[2/6] Loading Docker images from images\..."
$tars = 'postgres.tar','amis-api.tar','amis-web.tar','dbmate.tar'
foreach ($t in $tars) {
    $p = Join-Path $KitDir "images\$t"
    if (-not (Test-Path $p)) { Red "Missing $p — bundle incomplete. See MANIFEST.md."; exit 1 }
    Write-Host "  loading $t..."
    docker load -i $p | Out-Null
}
Green "  All images loaded."

# ── 3. Configure .env.offline ──────────────────────────────────
Cyan "[3/6] Configuring environment..."
if (Test-Path $EnvFile) {
    Warn "  $EnvFile already exists — keeping it."
} else {
    $serverIp = Read-Host "  Server LAN IP (e.g. 192.168.1.100)"
    if ([string]::IsNullOrWhiteSpace($serverIp)) { Red "IP is required"; exit 1 }

    $pg  = [Convert]::ToBase64String((1..24 | ForEach-Object { Get-Random -Max 256 } | ForEach-Object { [byte]$_ })) -replace '[/+=]',''
    $jwt = -join ((1..128) | ForEach-Object { '{0:x}' -f (Get-Random -Max 16) })

    (Get-Content $EnvTemplate) `
        -replace '^POSTGRES_PASSWORD=.*', "POSTGRES_PASSWORD=$pg" `
        -replace '^JWT_SECRET=.*',        "JWT_SECRET=$jwt" `
        -replace '^CORS_ORIGIN=.*',       "CORS_ORIGIN=http://$serverIp" `
        -replace '^VITE_API_URL=.*',      "VITE_API_URL=http://${serverIp}:3001" |
        Set-Content $EnvFile -Encoding ASCII

    Green "  Generated $EnvFile. KEEP IT SAFE."
    Warn  "  Postgres password (record this!): $pg"
}

# ── 4. DB + migrations ─────────────────────────────────────────
Cyan "[4/6] Starting database and applying migrations..."
docker compose -f $ComposeFile --env-file $EnvFile up -d db
Start-Sleep -Seconds 8
docker compose -f $ComposeFile --env-file $EnvFile run --rm migrate

# ── 5. Start stack ─────────────────────────────────────────────
Cyan "[5/6] Starting API and Web..."
docker compose -f $ComposeFile --env-file $EnvFile up -d
Start-Sleep -Seconds 5

# ── 6. Health check ────────────────────────────────────────────
Cyan "[6/6] Health check..."
try {
    $r = Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:3001/health' -TimeoutSec 5
    if ($r.StatusCode -eq 200) { Green "  API healthy." } else { Warn "  API returned $($r.StatusCode)" }
} catch { Warn "  API not healthy yet — check 'docker compose logs api'" }

$ip = ((Get-Content $EnvFile) -match '^CORS_ORIGIN=') -replace 'CORS_ORIGIN=http://',''
""
Green "============================================="
Green "  AMIS is installed!"
Green "  Open this URL in any LAN browser:"
Green ("      http://{0}" -f $ip)
Green "============================================="
""
Write-Host "Next steps:"
Write-Host "  - Log in with the platform-admin credentials supplied by 3B Solutions."
Write-Host "  - Read docs\07-first-login.md."
Write-Host "  - Schedule daily backups: see docs\10-backup.md."
