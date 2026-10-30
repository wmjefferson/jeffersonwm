$present = Get-PnpDevice -PresentOnly | Where-Object { $_.InstanceId -like "*30FA*" }
Write-Host "Present 30FA devices count: $($present.Count)"
foreach ($p in $present) {
    Write-Host "[$($p.Class)] $($p.FriendlyName) - Status: $($p.Status) - ID: $($p.InstanceId)"
}
