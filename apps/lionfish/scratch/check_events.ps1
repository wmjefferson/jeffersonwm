$events = Get-WinEvent -FilterHashtable @{LogName='System'; StartTime=(Get-Date).AddHours(-4)} -ErrorAction SilentlyContinue | Where-Object { $_.Message -match "30fa|1340|kbd|keyboard|hid|interception|usb" -or $_.LevelDisplayName -eq "Error" }
Write-Host "Found $($events.Count) events"
$events | Select-Object -First 20 | Format-Table TimeCreated, ProviderName, LevelDisplayName, Message -AutoSize
