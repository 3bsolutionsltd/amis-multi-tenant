# Serve the AMIS documentation on the LAN as a single source of truth.
# Default port 4001.  .\scripts\serve-docs.ps1 -Port 8080
param([int]$Port = 4001)

$ErrorActionPreference = 'Stop'
$KitDir  = Split-Path -Parent $PSScriptRoot
$DocsDir = Join-Path $KitDir 'docs'

Push-Location $DocsDir
try {
    $ip = (Get-NetIPAddress -AddressFamily IPv4 |
           Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.*' } |
           Select-Object -First 1).IPAddress
    Write-Host "Docs available at: http://$ip:$Port" -ForegroundColor Green
    Write-Host "Press Ctrl-C to stop." -ForegroundColor Yellow

    $py = Get-Command python -ErrorAction SilentlyContinue
    if ($py) {
        & $py -m http.server $Port --bind 0.0.0.0
    } else {
        Write-Host "Python not found — falling back to Docker." -ForegroundColor Yellow
        docker run --rm -p "${Port}:80" -v "${DocsDir}:/usr/share/nginx/html:ro" nginx:alpine
    }
} finally { Pop-Location }
