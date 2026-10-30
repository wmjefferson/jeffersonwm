$sh = New-Object -ComObject WScript.Shell
$sc = $sh.CreateShortcut("$env:USERPROFILE\Desktop\Lionfish.lnk")
Write-Host "Desktop shortcut TargetPath: $($sc.TargetPath)"
Write-Host "Desktop shortcut IconLocation: $($sc.IconLocation)"
