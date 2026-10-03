Add-Type -TypeDefinition @"
using System;
using System.IO;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;

public class DeviceTester
{
    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern SafeFileHandle CreateFile(
        string lpFileName,
        uint dwDesiredAccess,
        uint dwShareMode,
        IntPtr lpSecurityAttributes,
        uint dwCreationDisposition,
        uint dwFlagsAndAttributes,
        IntPtr hTemplateFile);

    public static void TestOpen(string path)
    {
        uint GENERIC_READ = 0x80000000;
        uint GENERIC_WRITE = 0x40000000;
        uint FILE_SHARE_READ = 1;
        uint FILE_SHARE_WRITE = 2;
        uint OPEN_EXISTING = 3;

        // Try with Read/Write share
        var handle = CreateFile(path, 0, FILE_SHARE_READ | FILE_SHARE_WRITE, IntPtr.Zero, OPEN_EXISTING, 0, IntPtr.Zero);
        if (handle.IsInvalid)
        {
            int err = Marshal.GetLastWin32Error();
            Console.WriteLine($"[Access 0] Failed to open: Error {err}");
        }
        else
        {
            Console.WriteLine($"[Access 0] Success opening {path}");
            handle.Close();
        }
    }
}
"@

$devs = Get-PnpDevice -PresentOnly | Where-Object { $_.InstanceId -like "*30FA*" }
foreach ($d in $devs) {
    Write-Host "Device: $($d.InstanceId) ($($d.Class))"
}

$paths = @(
    "\\?\hid#vid_30fa&pid_1340&mi_00#7&348bc95e&0&0000#{378de44c-56ef-11d1-bc8c-00a0c91405dd}",
    "\\?\hid#vid_30fa&pid_1340&mi_01&col01#7&306764d2&0&0000#{884b96c3-56ef-11d1-bc8c-00a0c91405dd}",
    "\\?\hid#vid_30fa&pid_1340&mi_01&col02#7&306764d2&0&0000#{4d1e55b2-f16f-11cf-88cb-001111000030}",
    "\\?\hid#vid_30fa&pid_1340&mi_01&col03#7&306764d2&0&0000#{4d1e55b2-f16f-11cf-88cb-001111000030}"
)

foreach ($p in $paths) {
    Write-Host "Testing path: $p"
    [DeviceTester]::TestOpen($p)
}
