# Serve the AMIS documentation on the LAN as a single source of truth.
# Default port 4001. Use .\scripts\serve-docs.ps1 -Port 8080 to override it.
param([int]$Port = 4001)

$ErrorActionPreference = 'Stop'
$KitDir = Split-Path -Parent $PSScriptRoot
$DocsDir = Join-Path $KitDir 'docs'

Push-Location $DocsDir
try {
    $ip = (Get-NetIPAddress -AddressFamily IPv4 |
        Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.*' } |
        Select-Object -First 1).IPAddress
    $url = 'http://{0}:{1}' -f $ip, $Port
    Write-Host ('Docs available at: ' + $url) -ForegroundColor Green
    Write-Host 'Press Ctrl-C to stop.' -ForegroundColor Yellow

    $python = Get-Command python -ErrorAction SilentlyContinue
    if ($python) {
        & $python.Source -m http.server $Port --bind 0.0.0.0
    } else {
        Write-Host 'Python not found - falling back to Docker.' -ForegroundColor Yellow
        $portMapping = '{0}:80' -f $Port
        $volumeMapping = '{0}:/usr/share/nginx/html:ro' -f $DocsDir
        & docker run --rm -p $portMapping -v $volumeMapping nginx:alpine
    }
} finally {
    Pop-Location
}
