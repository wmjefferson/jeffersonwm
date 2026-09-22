# Lionfish Launcher Script
# Usage: .\apps\lionfish\run.ps1

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$appProject = Join-Path $scriptDir "src\Lionfish.App\Lionfish.App.csproj"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  🦁 Lionfish Keypad Interceptor        " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Check if Lionfish is already running
$existing = Get-Process -Name "Lionfish" -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host ""
    Write-Host "[NOTICE] Lionfish is ALREADY RUNNING!" -ForegroundColor Yellow
    Write-Host "  Process ID : $($existing.Id)" -ForegroundColor Gray
    Write-Host "  Status     : Active in background / System Tray" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Lionfish is minimized to your Windows System Tray (near the clock)." -ForegroundColor White
    Write-Host "Left-click the Lionfish tray icon to open the configuration window." -ForegroundColor Cyan
    Write-Host ""
    $choice = Read-Host "Would you like to STOP and RESTART Lionfish? (y/N)"
    if ($choice -eq 'y' -or $choice -eq 'Y') {
        Write-Host "Stopping existing instance (PID $($existing.Id))..." -ForegroundColor Yellow
        Stop-Process -Id $existing.Id -Force
        Start-Sleep -Milliseconds 800
        Write-Host "Existing instance stopped." -ForegroundColor Green
    } else {
        Write-Host "Leaving current instance running. Launcher finished." -ForegroundColor Gray
        exit 0
    }
}

Write-Host ""
Write-Host "Launching Lionfish..." -ForegroundColor Green
dotnet run --project $appProject
