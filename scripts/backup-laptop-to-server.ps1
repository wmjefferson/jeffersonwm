param(
  [ValidateSet("Preview", "Copy", "Mirror")]
  [string]$Mode = "Preview",

  [string]$Source = (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)),
  [string]$Destination = "\\JEFFERSHIZZLE-D\Dotcoms E\backuplaptop"
)

$ErrorActionPreference = "Stop"

if (!(Test-Path -LiteralPath $Source)) {
  throw "Source path does not exist: $Source"
}

$destinationParent = Split-Path -Parent $Destination
if (!(Test-Path -LiteralPath $destinationParent)) {
  New-Item -ItemType Directory -Path $destinationParent | Out-Null
}

if (!(Test-Path -LiteralPath $Destination)) {
  New-Item -ItemType Directory -Path $Destination | Out-Null
}

$logDir = Join-Path $Destination "_backup-logs"
if (!(Test-Path -LiteralPath $logDir)) {
  New-Item -ItemType Directory -Path $logDir | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"

$copyMode = if ($Mode -eq "Mirror") { "/MIR" } else { "/E" }
$modeFlags = @()
if ($Mode -eq "Preview") {
  $modeFlags += "/L"
}

$excludeDirs = @(
  "node_modules",
  ".vite",
  ".cache",
  ".turbo",
  ".next"
)

$excludeFiles = @(
  "*.log"
)

function Invoke-RobocopyBackup {
  param(
    [Parameter(Mandatory = $true)]
    [string]$SourcePath,

    [Parameter(Mandatory = $true)]
    [string]$DestinationPath
  )

  $siteName = Split-Path -Leaf $SourcePath
  $logPath = Join-Path $logDir "backup-$Mode-$siteName-$timestamp.log"

  if (!(Test-Path -LiteralPath $DestinationPath)) {
    New-Item -ItemType Directory -Path $DestinationPath | Out-Null
  }

  $args = @(
    $SourcePath,
    $DestinationPath,
    $copyMode,
    "/FFT",
    "/Z",
    "/XJ",
    "/R:2",
    "/W:2",
    "/TEE",
    "/LOG+:$logPath"
  ) + $modeFlags + @("/XD") + $excludeDirs + @("/XF") + $excludeFiles

  Write-Host "Site:        $siteName"
  Write-Host "  Source:     $SourcePath"
  Write-Host "  Destination: $DestinationPath"
  Write-Host "  Log:        $logPath"

  & robocopy @args | Out-Host
  return [int]$LASTEXITCODE
}

Write-Host "Backup mode: $Mode"
Write-Host "Source:      $Source"
Write-Host "Destination: $Destination"
Write-Host ""

if ((Split-Path -Leaf $Source) -eq "Dotcoms") {
  $siteRoots = Get-ChildItem -LiteralPath $Source -Directory | Sort-Object Name
} else {
  $siteRoots = @((Get-Item -LiteralPath $Source))
}

$overallExitCode = 0

foreach ($siteRoot in $siteRoots) {
  $exitCode = Invoke-RobocopyBackup -SourcePath $siteRoot.FullName -DestinationPath (Join-Path $Destination $siteRoot.Name)
  if ($exitCode -gt $overallExitCode) {
    $overallExitCode = $exitCode
  }
}

if ($overallExitCode -le 7) {
  Write-Host ""
  Write-Host "Robocopy completed successfully with code $overallExitCode."
  exit 0
}

throw "Robocopy failed with code $overallExitCode. See log files in $logDir"
