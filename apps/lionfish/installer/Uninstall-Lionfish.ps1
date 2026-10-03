<#
.SYNOPSIS
    Lionfish Uninstaller Script
.DESCRIPTION
    Uninstalls Lionfish with support for retaining user data or performing a complete clean wipe.
.PARAMETER Mode
    'Prompt' (default): Shows an interactive confirmation dialog.
    'RetainData': Removes application binaries and shortcuts, but preserves %APPDATA%\Lionfish.
    'FullClean': Removes application binaries, shortcuts, %APPDATA%\Lionfish profiles, and prompts to remove driver.
.PARAMETER UninstallDriver
    If specified, uninstalls the Interception driver (requires Administrator & reboot).
#>
[CmdletBinding()]
param(
    [ValidateSet("Prompt", "RetainData", "FullClean")]
    [string]$Mode = "Prompt",
    
    [switch]$UninstallDriver
)

$ErrorActionPreference = "Stop"

# Paths
$installDir = "$env:LOCALAPPDATA\Programs\Lionfish"
$dataDir = "$env:APPDATA\Lionfish"
$startMenuDir = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Lionfish"
$desktopLnk = "$env:USERPROFILE\Desktop\Lionfish.lnk"
$regUninstallKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\Lionfish"
$regRunKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"

# Stop any running instances of Lionfish
$running = Get-Process -Name "Lionfish" -ErrorAction SilentlyContinue
if ($running) {
    Write-Host "[INFO] Closing running Lionfish instance..." -ForegroundColor Yellow
    Stop-Process -Name "Lionfish" -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 800
}

# Interactive Prompt if Mode is 'Prompt'
if ($Mode -eq "Prompt") {
    Add-Type -AssemblyName System.Windows.Forms

    # 1. Dialog 1: Do you wish to uninstall Lionfish?
    $ans1 = [System.Windows.Forms.MessageBox]::Show(
        "Are you sure you want to uninstall Lionfish from your computer?",
        "Lionfish — Uninstall",
        [System.Windows.Forms.MessageBoxButtons]::YesNo,
        [System.Windows.Forms.MessageBoxIcon]::Question
    )
    if ($ans1 -ne [System.Windows.Forms.DialogResult]::Yes) {
        Write-Host "[INFO] Uninstallation cancelled." -ForegroundColor Yellow
        exit 0
    }

    # 2. Dialog 2: Would you like to keep your data?
    $ans2 = [System.Windows.Forms.MessageBox]::Show(
        "Would you like to keep your saved data?`n`n" +
        "• Click [Yes] to keep your macro profiles, keypad maps, and settings in %APPDATA%\Lionfish (Recommended).`n" +
        "• Click [No] to delete all profiles and settings.",
        "Lionfish — Keep User Data?",
        [System.Windows.Forms.MessageBoxButtons]::YesNo,
        [System.Windows.Forms.MessageBoxIcon]::Question
    )

    if ($ans2 -eq [System.Windows.Forms.DialogResult]::Yes) {
        $Mode = "RetainData"

        # 3A. Dialog 3: Confirmation keeping preferences
        $ans3 = [System.Windows.Forms.MessageBox]::Show(
            "Lionfish application files and shortcuts will be removed, but your custom profiles and settings in %APPDATA%\Lionfish will be preserved.`n`nProceed with uninstallation?",
            "Lionfish — Confirm Uninstall",
            [System.Windows.Forms.MessageBoxButtons]::YesNo,
            [System.Windows.Forms.MessageBoxIcon]::Information
        )
        if ($ans3 -ne [System.Windows.Forms.DialogResult]::Yes) {
            Write-Host "[INFO] Uninstallation cancelled." -ForegroundColor Yellow
            exit 0
        }
    } else {
        $Mode = "FullClean"

        # 3B. Dialog 3: Confirmation of total clean uninstall
        $ans3 = [System.Windows.Forms.MessageBox]::Show(
            "WARNING: Complete Clean Uninstall`n`n" +
            "This will remove Lionfish AND permanently delete all your saved profiles, keypad configurations, and settings.`n`n" +
            "Are you sure you want to proceed with a complete uninstall?",
            "Lionfish — Confirm Total Uninstall",
            [System.Windows.Forms.MessageBoxButtons]::YesNo,
            [System.Windows.Forms.MessageBoxIcon]::Warning
        )
        if ($ans3 -ne [System.Windows.Forms.DialogResult]::Yes) {
            Write-Host "[INFO] Uninstallation cancelled." -ForegroundColor Yellow
            exit 0
        }
    }
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Lionfish Uninstaller — Mode: $Mode" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Remove Shortcuts
Write-Host "--> Removing shortcuts..." -ForegroundColor Gray
if (Test-Path $desktopLnk) {
    Remove-Item $desktopLnk -Force -ErrorAction SilentlyContinue
    Write-Host "    [Removed] Desktop shortcut" -ForegroundColor Green
}
if (Test-Path $startMenuDir) {
    Remove-Item $startMenuDir -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "    [Removed] Start Menu shortcuts" -ForegroundColor Green
}

# 2. Remove Registry entries
Write-Host "--> Removing registry entries..." -ForegroundColor Gray
if (Test-Path $regUninstallKey) {
    Remove-Item $regUninstallKey -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "    [Removed] Add/Remove Programs entry" -ForegroundColor Green
}
try {
    $runEntry = Get-ItemProperty -Path $regRunKey -Name "Lionfish" -ErrorAction SilentlyContinue
    if ($runEntry) {
        Remove-ItemProperty -Path $regRunKey -Name "Lionfish" -Force -ErrorAction SilentlyContinue
        Write-Host "    [Removed] Startup autostart entry" -ForegroundColor Green
    }
} catch { }

# 3. Handle Driver Uninstall
if ($UninstallDriver -or ($Mode -eq "FullClean")) {
    $exe = Join-Path $installDir "Lionfish.exe"
    if (Test-Path $exe) {
        $ans = "y"
        if ($Mode -ne "FullClean") {
            $ans = Read-Host "Uninstall the Interception keyboard driver as well? (Requires Admin & Reboot) [y/N]"
        }
        if ($ans -eq "y" -or $ans -eq "Y") {
            Write-Host "--> Triggering driver uninstallation..." -ForegroundColor Yellow
            try {
                Start-Process -FilePath $exe -ArgumentList "--uninstall-driver" -Verb RunAs -Wait
                Write-Host "    [OK] Driver uninstaller completed." -ForegroundColor Green
            } catch {
                Write-Host "    [WARN] Driver uninstall skipped or cancelled." -ForegroundColor Yellow
            }
        }
    }
}

# 4. Remove Program Directory
Write-Host "--> Removing application binaries ($installDir)..." -ForegroundColor Gray
if (Test-Path $installDir) {
    Remove-Item $installDir -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "    [Removed] Application directory" -ForegroundColor Green
}

# 5. Handle Data Directory (%APPDATA%\Lionfish)
if ($Mode -eq "FullClean") {
    Write-Host "--> [FullClean] Deleting user data and profiles ($dataDir)..." -ForegroundColor Yellow
    if (Test-Path $dataDir) {
        Remove-Item $dataDir -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "    [Removed] User data and custom profiles" -ForegroundColor Green
    }

    # Clean certificate if installed
    try {
        certutil.exe -delstore -user Root "Lionfish Development" 2>$null | Out-Null
        certutil.exe -delstore -user TrustedPublisher "Lionfish Development" 2>$null | Out-Null
        Write-Host "    [Removed] Development certificate" -ForegroundColor Green
    } catch { }
} else {
    Write-Host "--> [RetainData] User profiles and key bindings preserved at:" -ForegroundColor Cyan
    Write-Host "    $dataDir" -ForegroundColor White
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host " Lionfish uninstallation complete! " -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
