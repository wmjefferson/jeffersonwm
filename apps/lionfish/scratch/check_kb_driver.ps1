$kb = Get-PnpDevice -PresentOnly | Where-Object { $_.InstanceId -like "*30FA*COL01*" }
$kb | Select-Object *
$prop = Get-PnpDeviceProperty -InstanceId $kb.InstanceId
$prop | Where-Object { $_.KeyName -match "Driver|Service|UpperFilter|LowerFilter" } | Select-Object KeyName, Type, Data
