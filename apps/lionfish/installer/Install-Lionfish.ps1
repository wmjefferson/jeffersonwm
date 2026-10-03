<#
.SYNOPSIS
    Lionfish Scripted Installer
.DESCRIPTION
    Installs Lionfish into %LOCALAPPDATA%\Programs\Lionfish, creates Start Menu & Desktop shortcuts,
    and registers the app in Windows Settings -> Installed Apps (Add/Remove Programs).
#>
[CmdletBinding()]
param(
    [switch]$InstallDriver,
    [switch]$TrustCertificate
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Resolve-Path (Join-Path $scriptDir "..")
$publishExe = Join-Path $projectRoot "publish\Lionfish.exe"
$targetDir = "$env:LOCALAPPDATA\Programs\Lionfish"
$startMenuDir = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Lionfish"
$desktopLnk = "$env:USERPROFILE\Desktop\Lionfish.lnk"
$regUninstallKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\Lionfish"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Installing Lionfish for Windows      " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Verify build executable exists
if (-not (Test-Path $publishExe)) {
    Write-Host "[INFO] Published binary not found. Building now via dotnet publish..." -ForegroundColor Yellow
    dotnet publish (Join-Path $projectRoot "src\Lionfish.App\Lionfish.App.csproj") -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -o (Join-Path $projectRoot "publish")
}

# 2. Stop running instance if any
$running = Get-Process -Name "Lionfish" -ErrorAction SilentlyContinue
if ($running) {
    Write-Host "[INFO] Closing currently running Lionfish..." -ForegroundColor Yellow
    Stop-Process -Name "Lionfish" -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 800
}

# 3. Create target directory
Write-Host "--> Deploying application files to: $targetDir" -ForegroundColor Gray
New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $targetDir "tools") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $targetDir "extension") -Force | Out-Null

Copy-Item $publishExe -Destination (Join-Path $targetDir "Lionfish.exe") -Force
Copy-Item (Join-Path $projectRoot "LICENSE") -Destination $targetDir -Force -ErrorAction SilentlyContinue
Copy-Item (Join-Path $projectRoot "THIRD_PARTY_LICENSES.md") -Destination $targetDir -Force -ErrorAction SilentlyContinue
Copy-Item (Join-Path $projectRoot "README.md") -Destination $targetDir -Force -ErrorAction SilentlyContinue
Copy-Item (Join-Path $projectRoot "LionfishDevCert.cer") -Destination $targetDir -Force -ErrorAction SilentlyContinue
Copy-Item (Join-Path $scriptDir "Uninstall-Lionfish.ps1") -Destination $targetDir -Force
Copy-Item (Join-Path $scriptDir "Uninstall Lionfish.exe") -Destination $targetDir -Force -ErrorAction SilentlyContinue

Copy-Item (Join-Path $projectRoot "tools\*") -Destination (Join-Path $targetDir "tools") -Recurse -Force -ErrorAction SilentlyContinue
Copy-Item (Join-Path $projectRoot "extension\*") -Destination (Join-Path $targetDir "extension") -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "    [OK] Files copied successfully" -ForegroundColor Green

# 4. Create Shortcuts
Write-Host "--> Creating Start Menu and Desktop shortcuts..." -ForegroundColor Gray
New-Item -ItemType Directory -Path $startMenuDir -Force | Out-Null

$wsh = New-Object -ComObject WScript.Shell
$installedExe = Join-Path $targetDir "Lionfish.exe"
$uninstallerExe = Join-Path $targetDir "Uninstall Lionfish.exe"

# Start Menu Shortcut - App
$startLnk = $wsh.CreateShortcut((Join-Path $startMenuDir "Lionfish.lnk"))
$startLnk.TargetPath = $installedExe
$startLnk.WorkingDirectory = $targetDir
$startLnk.Description = "Lionfish - Keypad Macro Interceptor"
$startLnk.Save()

# Start Menu Shortcut - Uninstaller
$uninstLnk = $wsh.CreateShortcut((Join-Path $startMenuDir "Uninstall Lionfish.lnk"))
$uninstLnk.TargetPath = if (Test-Path $uninstallerExe) { $uninstallerExe } else { "powershell.exe" }
if (-not (Test-Path $uninstallerExe)) {
    $uninstLnk.Arguments = "-ExecutionPolicy Bypass -File `"$targetDir\Uninstall-Lionfish.ps1`""
}
$uninstLnk.WorkingDirectory = $targetDir
$uninstLnk.Description = "Uninstall Lionfish"
$uninstLnk.Save()

# Start Menu Shortcut for Companion Extension Folder
$extLnk = $wsh.CreateShortcut((Join-Path $startMenuDir "Lionfish Companion Extension.lnk"))
$extLnk.TargetPath = Join-Path $targetDir "extension"
$extLnk.Description = "Lionfish Companion Extension Folder"
$extLnk.Save()

# Desktop Shortcut
$desk = $wsh.CreateShortcut($desktopLnk)
$desk.TargetPath = $installedExe
$desk.WorkingDirectory = $targetDir
$desk.Description = "Lionfish - Keypad Macro Interceptor"
$desk.Save()

Write-Host "    [OK] Shortcuts created" -ForegroundColor Green

# 5. Register in Windows Settings (Add/Remove Programs)
Write-Host "--> Registering in Windows Add/Remove Programs..." -ForegroundColor Gray
New-Item -Path $regUninstallKey -Force | Out-Null
Set-ItemProperty -Path $regUninstallKey -Name "DisplayName" -Value "Lionfish"
Set-ItemProperty -Path $regUninstallKey -Name "DisplayVersion" -Value "1.0.0"
Set-ItemProperty -Path $regUninstallKey -Name "Publisher" -Value "jeffersonwm"
Set-ItemProperty -Path $regUninstallKey -Name "DisplayIcon" -Value "$installedExe,0"
Set-ItemProperty -Path $regUninstallKey -Name "InstallLocation" -Value $targetDir
Set-ItemProperty -Path $regUninstallKey -Name "UninstallString" -Value (if (Test-Path $uninstallerExe) { "`"$uninstallerExe`"" } else { "powershell.exe -ExecutionPolicy Bypass -File `"$targetDir\Uninstall-Lionfish.ps1`"" })
Set-ItemProperty -Path $regUninstallKey -Name "QuietUninstallString" -Value "powershell.exe -ExecutionPolicy Bypass -File `"$targetDir\Uninstall-Lionfish.ps1`" -Mode RetainData"
Set-ItemProperty -Path $regUninstallKey -Name "HelpLink" -Value "https://github.com/jeffersonwm/lionfish"
Set-ItemProperty -Path $regUninstallKey -Name "NoModify" -Value 1 -Type DWord
Set-ItemProperty -Path $regUninstallKey -Name "NoRepair" -Value 1 -Type DWord

Write-Host "    [OK] Windows registration completed" -ForegroundColor Green

# 6. Optional: Trust certificate
if ($TrustCertificate) {
    Write-Host "--> Trusting local certificate..." -ForegroundColor Gray
    certutil.exe -addstore -user Root (Join-Path $targetDir "LionfishDevCert.cer") 2>$null | Out-Null
    certutil.exe -addstore -user TrustedPublisher (Join-Path $targetDir "LionfishDevCert.cer") 2>$null | Out-Null
    Write-Host "    [OK] Local certificate trusted" -ForegroundColor Green
}

# 7. Optional: Install Interception driver
if ($InstallDriver) {
    Write-Host "--> Initiating driver installation..." -ForegroundColor Yellow
    try {
        Start-Process -FilePath $installedExe -ArgumentList "--install-driver" -Verb RunAs -Wait
        Write-Host "    [OK] Driver installed. (System reboot required)" -ForegroundColor Green
    } catch {
        Write-Host "    [WARN] Driver installation was skipped or cancelled." -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "   Lionfish Installed Successfully!     " -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "You can launch Lionfish from:" -ForegroundColor White
Write-Host "  • Desktop Shortcut" -ForegroundColor Cyan
Write-Host "  • Start Menu -> Lionfish" -ForegroundColor Cyan
Write-Host ""
