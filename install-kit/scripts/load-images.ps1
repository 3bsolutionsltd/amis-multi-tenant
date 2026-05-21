# Load all AMIS Docker images from images\*.tar
$ErrorActionPreference = 'Stop'
$KitDir = Split-Path -Parent $PSScriptRoot
Push-Location (Join-Path $KitDir 'images')
try {
    foreach ($t in 'postgres.tar','amis-api.tar','amis-web.tar','dbmate.tar') {
        if (-not (Test-Path $t)) { throw "Missing $t" }
        Write-Host "Loading $t..."
        docker load -i $t
    }
    Write-Host "Done. Next: ..\install.ps1"
} finally { Pop-Location }
