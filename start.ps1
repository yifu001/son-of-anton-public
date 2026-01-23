# Cleanup previous instances
Write-Host "Killing stale processes..." -ForegroundColor Yellow
Get-Process electron -ErrorAction SilentlyContinue | Stop-Process -Force
Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }

# Launch
Write-Host "Launching Son of Anton..." -ForegroundColor Cyan
.\node_modules\.bin\electron src
