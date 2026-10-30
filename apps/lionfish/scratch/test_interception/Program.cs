using System;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;

class Program
{
    [StructLayout(LayoutKind.Sequential)]
    struct HIDD_ATTRIBUTES
    {
        public int Size;
        public ushort VendorID;
        public ushort ProductID;
        public ushort VersionNumber;
    }

    [DllImport("hid.dll", SetLastError = true)]
    static extern bool HidD_GetAttributes(SafeFileHandle HidDeviceObject, ref HIDD_ATTRIBUTES Attributes);

    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    static extern SafeFileHandle CreateFile(
        string lpFileName,
        uint dwDesiredAccess,
        uint dwShareMode,
        IntPtr lpSecurityAttributes,
        uint dwCreationDisposition,
        uint dwFlagsAndAttributes,
        IntPtr hTemplateFile);

    static void Main()
    {
        string path = @"\\?\hid#vid_30fa&pid_1340&mi_01&col01#7&306764d2&0&0000#{884b96c3-56ef-11d1-bc8c-00a0c91405dd}";
        Console.WriteLine($"Testing: {path}");

        // Try different access flags
        uint[] accesses = new uint[] { 0, 0x80000000 /*GENERIC_READ*/, 0x10000000 /*GENERIC_ALL*/ };
        string[] names = new[] { "0 (Query)", "GENERIC_READ", "GENERIC_ALL" };

        for (int i = 0; i < accesses.Length; i++)
        {
            var h = CreateFile(path, accesses[i], 1 | 2 /*FILE_SHARE_READ|WRITE*/, IntPtr.Zero, 3 /*OPEN_EXISTING*/, 0, IntPtr.Zero);
            if (h.IsInvalid)
            {
                int err = Marshal.GetLastWin32Error();
                Console.WriteLine($"Access {names[i]}: Failed with error {err}");
            }
            else
            {
                Console.WriteLine($"Access {names[i]}: SUCCESS!");
                var attr = new HIDD_ATTRIBUTES();
                attr.Size = Marshal.SizeOf(attr);
                if (HidD_GetAttributes(h, ref attr))
                {
                    Console.WriteLine($"  VID: 0x{attr.VendorID:X4}, PID: 0x{attr.ProductID:X4}, Ver: 0x{attr.VersionNumber:X4}");
                }
                h.Close();
            }
        }
    }
}
