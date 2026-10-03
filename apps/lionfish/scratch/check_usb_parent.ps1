$parent = Get-PnpDevice -PresentOnly | Where-Object { $_.InstanceId -like "USB\VID_30FA*" }
$parent | Select-Object *
$props = Get-PnpDeviceProperty -InstanceId $parent.InstanceId
$props | Where-Object { $_.KeyName -match "Status|Power|Error|State|Location" } | Select-Object KeyName, Type, Data
