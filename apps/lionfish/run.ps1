param (
    [switch]$Rebuild
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$appProject = Join-Path $scriptDir "src\Lionfish.App\Lionfish.App.csproj"
$publishDir = Join-Path $scriptDir "publish"
$publishExe = Join-Path $publishDir "Lionfish.exe"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  🦁 Lionfish Keypad Interceptor        " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Check if Lionfish is already running (either as Lionfish.exe or hosted by dotnet)
$existing = Get-Process -ErrorAction SilentlyContinue | Where-Object { 
    $_.Name -eq "Lionfish" -or ($_.Name -eq "dotnet" -and $_.CommandLine -like "*Lionfish*")
} | Select-Object -First 1
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

# If rebuild requested or publish output does not exist, build single-file
if ($Rebuild -or (-not (Test-Path $publishExe))) {
    Write-Host ""
    Write-Host "Building single-file executable (bypasses Windows Smart App Control)..." -ForegroundColor Yellow
    dotnet publish $appProject -c Release -r win-x64 --self-contained false -p:PublishSingleFile=true -o $publishDir
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Build failed! Please check errors above." -ForegroundColor Red
        exit $LASTEXITCODE
    }
}

# Unblock file from SmartScreen Mark of the Web
Unblock-File -Path $publishExe -ErrorAction SilentlyContinue

# Ensure executable is signed with development certificate for Smart App Control
$cert = Get-Item "Cert:\CurrentUser\My\91C279159B6E929F9091C71F5CF91FC0D11C6B0B" -ErrorAction SilentlyContinue
if ($cert) {
    Set-AuthenticodeSignature -FilePath $publishExe -Certificate $cert -ErrorAction SilentlyContinue | Out-Null
}

Write-Host ""
Write-Host "Launching Lionfish..." -ForegroundColor Green

Start-Process -FilePath $publishExe -WorkingDirectory $publishDir

Write-Host "Lionfish started! Look for the window or the tray icon in your taskbar." -ForegroundColor Cyan
