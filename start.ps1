# Helper script to start Son of Anton
# Bypasses npm to avoid version configuration issues

Write-Host "Launching Son of Anton..." -ForegroundColor Cyan
.\node_modules\.bin\electron src --nointro
