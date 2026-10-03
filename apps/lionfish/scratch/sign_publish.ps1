param()
$cert = Get-ChildItem "Cert:\CurrentUser\My" | Where-Object { $_.Subject -like "*Lionfish*" } | Select-Object -First 1
if ($cert) {
    if (Test-Path "publish\Lionfish.exe") {
        Unblock-File -Path "publish\Lionfish.exe"
        $sig1 = Set-AuthenticodeSignature -FilePath "publish\Lionfish.exe" -Certificate $cert
        Write-Host "publish\Lionfish.exe: $($sig1.Status)"
    }
    if (Test-Path "dist\Lionfish-Setup-1.0.0.exe") {
        Unblock-File -Path "dist\Lionfish-Setup-1.0.0.exe"
        $sig2 = Set-AuthenticodeSignature -FilePath "dist\Lionfish-Setup-1.0.0.exe" -Certificate $cert
        Write-Host "dist\Lionfish-Setup-1.0.0.exe: $($sig2.Status)"
    }
} else {
    Write-Host "Certificate not found."
}
