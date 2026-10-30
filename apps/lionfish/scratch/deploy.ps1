$cert = Get-ChildItem "Cert:\CurrentUser\My" | Where-Object { $_.Subject -like "*Lionfish*" } | Select-Object -First 1

# Sign publish output
if (Test-Path "publish\Lionfish.exe") {
    Unblock-File -Path "publish\Lionfish.exe"
    if ($cert) {
        $sig1 = Set-AuthenticodeSignature -FilePath "publish\Lionfish.exe" -Certificate $cert
        Write-Host "publish\Lionfish.exe signature: $($sig1.Status)"
    }
}

# Deploy to %LOCALAPPDATA%\Programs\Lionfish\Lionfish.exe
$targetDir = "$env:LOCALAPPDATA\Programs\Lionfish"
if (!(Test-Path $targetDir)) {
    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
}
$targetExe = Join-Path $targetDir "Lionfish.exe"
Copy-Item -Path "publish\Lionfish.exe" -Destination $targetExe -Force
Unblock-File -Path $targetExe

if ($cert) {
    $sig2 = Set-AuthenticodeSignature -FilePath $targetExe -Certificate $cert
    Write-Host "Installed $targetExe signature: $($sig2.Status)"
}
Write-Host "Deployment completed successfully."
