Get-PnpDevice | Where-Object { $_.InstanceId -like "*30FA*" } | Format-Table Status, Class, FriendlyName, InstanceId, Problem, ConfigManagerErrorCode -AutoSize
