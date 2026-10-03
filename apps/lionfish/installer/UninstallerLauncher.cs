using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;

static class Program
{
    [STAThread]
    static void Main(string[] args)
    {
        try
        {
            string dir = AppDomain.CurrentDomain.BaseDirectory;
            string innoUninstaller = Path.Combine(dir, "unins000.exe");
            string psUninstaller = Path.Combine(dir, "Uninstall-Lionfish.ps1");

            string fileName;
            string arguments;

            if (File.Exists(innoUninstaller))
            {
                fileName = innoUninstaller;
                arguments = string.Join(" ", args);
            }
            else if (File.Exists(psUninstaller))
            {
                fileName = "powershell.exe";
                arguments = "-ExecutionPolicy Bypass -File \"" + psUninstaller + "\" " + string.Join(" ", args);
            }
            else
            {
                MessageBox.Show("Could not locate Lionfish uninstaller components.", "Lionfish", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }

            var psi = new ProcessStartInfo
            {
                FileName = fileName,
                Arguments = arguments,
                UseShellExecute = true
            };

            Process.Start(psi);
        }
        catch (Exception ex)
        {
            MessageBox.Show("Failed to launch Lionfish uninstaller:\n\n" + ex.Message, "Lionfish", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }
}
