try {
    Disable-PnpDevice -InstanceId 'USB\VID_30FA&PID_1340\5&BDB61BD&0&2' -Confirm:$false -ErrorAction Stop
    Start-Sleep -Seconds 1
    Enable-PnpDevice -InstanceId 'USB\VID_30FA&PID_1340\5&BDB61BD&0&2' -Confirm:$false -ErrorAction Stop
    Write-Host "Successfully reset PnP device"
} catch {
    Write-Host "Error: $($_.Exception.Message)"
}
