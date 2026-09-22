# Lionfish - Interception Driver Management
# Run this script as Administrator

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("install", "uninstall", "status")]
    [string]$Action
)

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Join-Path $scriptDir ".."
$appProject = Join-Path $projectRoot "src\Lionfish.App\Lionfish.App.csproj"

function Test-Admin {
    $isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    if (-not $isAdmin) {
        Write-Host "[ERROR] This script must be run as Administrator." -ForegroundColor Red
        Write-Host "Right-click PowerShell and select 'Run as Administrator', then try again." -ForegroundColor Yellow
        exit 1
    }
}

function Get-DriverStatus {
    Write-Host "Checking Interception driver status..." -ForegroundColor Cyan
    Write-Host ""
    
    # Use dotnet run to check via the InputInterceptor API
    $checkScript = @"
using InputInterceptorNS;
Console.WriteLine(InputInterceptor.CheckDriverInstalled() ? "INSTALLED" : "NOT_INSTALLED");
"@
    
    # Simpler check: look for the driver file
    $driverPaths = @(
        "$env:SystemRoot\System32\drivers\keyboard.sys",
        "$env:SystemRoot\System32\drivers\mouse.sys"
    )
    
    $interceptionKeyPath = "HKLM:\SYSTEM\CurrentControlSet\Services\keyboard"
    
    if (Test-Path $interceptionKeyPath) {
        Write-Host "[OK] Interception driver appears to be installed." -ForegroundColor Green
        Write-Host "     Registry key found at: $interceptionKeyPath" -ForegroundColor Gray
        return $true
    } else {
        Write-Host "[--] Interception driver does NOT appear to be installed." -ForegroundColor Yellow
        Write-Host ""
        Write-Host "To install, run:" -ForegroundColor White
        Write-Host "  .\manage-driver.ps1 -Action install" -ForegroundColor Cyan
        return $false
    }
}

function Install-Driver {
    Test-Admin
    
    Write-Host "Installing Interception driver via Lionfish..." -ForegroundColor Cyan
    Write-Host "This uses the InputInterceptor library's built-in installer." -ForegroundColor Gray
    Write-Host ""
    
    # Check if Lionfish is running
    $existing = Get-Process -Name "Lionfish" -ErrorAction SilentlyContinue
    if ($existing) {
        Write-Host "[NOTICE] Lionfish is currently running (PID: $($existing.Id))." -ForegroundColor Yellow
        Write-Host "         Stopping running instance so driver installation can proceed..." -ForegroundColor Gray
        Stop-Process -Id $existing.Id -Force
        Start-Sleep -Milliseconds 800
    }

    # Run Lionfish with the --install-driver flag
    # This triggers the driver install through the C# InputInterceptor API
    try {
        $result = dotnet run --project $appProject -- --install-driver 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "[OK] Driver installation initiated successfully!" -ForegroundColor Green
            Write-Host ""
            Write-Host "A system REBOOT is required to activate the driver." -ForegroundColor Yellow
            Write-Host ""
            $reboot = Read-Host "Reboot now? (y/n)"
            if ($reboot -eq 'y') {
                Restart-Computer -Force
            } else {
                Write-Host "Please reboot your computer before using Lionfish." -ForegroundColor Yellow
            }
        } else {
            Write-Host "[ERROR] Driver installation may have failed." -ForegroundColor Red
            Write-Host "Output: $result" -ForegroundColor Gray
            Write-Host ""
            Write-Host "Try running Lionfish directly as Administrator instead:" -ForegroundColor Yellow
            Write-Host "  dotnet run --project src\Lionfish.App" -ForegroundColor Cyan
            Write-Host "The app will detect the missing driver and offer to install it." -ForegroundColor Gray
        }
    }
    catch {
        Write-Host "[ERROR] Failed to run Lionfish for driver installation." -ForegroundColor Red
        Write-Host $_.Exception.Message -ForegroundColor Gray
        Write-Host ""
        Write-Host "Alternative: Launch Lionfish as Administrator — it will detect" -ForegroundColor Yellow
        Write-Host "the missing driver and offer to install it automatically." -ForegroundColor Yellow
    }
}

function Uninstall-Driver {
    Test-Admin
    
    Write-Host "Uninstalling Interception driver..." -ForegroundColor Cyan
    
    # Check if Lionfish is running
    $existing = Get-Process -Name "Lionfish" -ErrorAction SilentlyContinue
    if ($existing) {
        Write-Host "[NOTICE] Lionfish is currently running (PID: $($existing.Id))." -ForegroundColor Yellow
        Write-Host "         Stopping running instance so driver uninstallation can proceed..." -ForegroundColor Gray
        Stop-Process -Id $existing.Id -Force
        Start-Sleep -Milliseconds 800
    }

    try {
        $result = dotnet run --project $appProject -- --uninstall-driver 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[OK] Driver uninstalled. Please reboot to complete removal." -ForegroundColor Green
        } else {
            Write-Host "[ERROR] Driver uninstallation may have failed." -ForegroundColor Red
            Write-Host "Output: $result" -ForegroundColor Gray
        }
    }
    catch {
        Write-Host "[ERROR] Failed to uninstall driver." -ForegroundColor Red
        Write-Host $_.Exception.Message -ForegroundColor Gray
    }
}

# Main
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Lionfish - Interception Driver Setup  " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

switch ($Action) {
    "install"   { Install-Driver }
    "uninstall" { Uninstall-Driver }
    "status"    { Get-DriverStatus }
}
