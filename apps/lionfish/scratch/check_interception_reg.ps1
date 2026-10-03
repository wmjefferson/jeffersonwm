$reg = Get-ItemProperty "HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e96b-e325-11ce-bfc1-08002be10318}"
Write-Host "UpperFilters: $($reg.UpperFilters)"
$svc = Get-Service -Name "keyboard" -ErrorAction SilentlyContinue
Write-Host "Service keyboard: $($svc.Status)"
