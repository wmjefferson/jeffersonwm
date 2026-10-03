using System;
using System.Diagnostics;
using System.Security.Principal;
using System.Threading;
using System.Windows;
using Lionfish.App.Services;
using Lionfish.Core.Interception;

namespace Lionfish.App;

public partial class App : Application
{
    private const string MutexName = "Lionfish.App.SingleInstance";
    private Mutex? _mutex;
    private bool _hasMutex;
    public TrayService TrayService { get; } = new();

    private static void Log(string msg)
    {
        try
        {
            var logPath = System.IO.Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "Lionfish", "startup.log");
            System.IO.Directory.CreateDirectory(System.IO.Path.GetDirectoryName(logPath)!);
            System.IO.File.AppendAllText(logPath, $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss.fff}] {msg}{Environment.NewLine}");
        }
        catch { }
    }

    private void Application_Startup(object sender, StartupEventArgs e)
    {
        Log("Application_Startup enter");

        // 1. Process headless CLI commands for driver installation/uninstallation
        if (e.Args != null && e.Args.Length > 0)
        {
            if (Array.Exists(e.Args, a => string.Equals(a, "--install-driver", StringComparison.OrdinalIgnoreCase)))
            {
                try
                {
                    if (!IsRunningAsAdmin())
                    {
                        var psi = new ProcessStartInfo
                        {
                            FileName = Environment.ProcessPath ?? "Lionfish.exe",
                            Arguments = "--install-driver",
                            UseShellExecute = true,
                            Verb = "runas"
                        };
                        var p = Process.Start(psi);
                        p?.WaitForExit();
                        Environment.Exit(p?.ExitCode ?? 0);
                        return;
                    }

                    bool success = InterceptionService.InstallDriver();
                    Log($"--install-driver result: {success}");
                    Environment.Exit(success ? 0 : 1);
                }
                catch (Exception ex)
                {
                    Log($"--install-driver exception: {ex}");
                    Environment.Exit(1);
                }
                return;
            }

            if (Array.Exists(e.Args, a => string.Equals(a, "--uninstall-driver", StringComparison.OrdinalIgnoreCase)))
            {
                try
                {
                    if (!IsRunningAsAdmin())
                    {
                        var psi = new ProcessStartInfo
                        {
                            FileName = Environment.ProcessPath ?? "Lionfish.exe",
                            Arguments = "--uninstall-driver",
                            UseShellExecute = true,
                            Verb = "runas"
                        };
                        var p = Process.Start(psi);
                        p?.WaitForExit();
                        Environment.Exit(p?.ExitCode ?? 0);
                        return;
                    }

                    bool success = InterceptionService.UninstallDriver();
                    Log($"--uninstall-driver result: {success}");
                    Environment.Exit(success ? 0 : 1);
                }
                catch (Exception ex)
                {
                    Log($"--uninstall-driver exception: {ex}");
                    Environment.Exit(1);
                }
                return;
            }
        }

        AppDomain.CurrentDomain.UnhandledException += (s, args) =>
        {
            Log($"[FATAL] AppDomain UnhandledException: {args.ExceptionObject}");
        };

        bool createdNew;
        _mutex = new Mutex(true, MutexName, out createdNew);
        _hasMutex = createdNew;
        Log($"Mutex acquired: createdNew={createdNew}");

        if (!createdNew)
        {
            Log("Another instance is running, shutting down.");
            _mutex.Dispose();
            _mutex = null;
            Console.WriteLine("[INFO] Lionfish is already running. Check your system tray (bottom-right near the clock).");
            MessageBox.Show("Lionfish is already running in the background.\n\nLook for the Lionfish icon in your system tray (bottom-right near the clock) and click it to open the window.", "Lionfish", MessageBoxButton.OK, MessageBoxImage.Information);
            Current.Shutdown();
            return;
        }

        // Global exception handling
        DispatcherUnhandledException += (s, args) =>
        {
            Log($"[FATAL] DispatcherUnhandledException: {args.Exception}");
            MessageBox.Show($"An unhandled exception occurred:\n\n{args.Exception.Message}",
                "Lionfish — Error", MessageBoxButton.OK, MessageBoxImage.Error);
            args.Handled = true;
        };

        // Check if the Interception driver is installed
        Log("Checking driver...");
        if (!CheckAndInstallDriver())
        {
            Log("CheckAndInstallDriver returned false");
        }
        else
        {
            Log("Driver is installed or verified");
        }

        // Initialize tray icon
        Log("Initializing tray icon...");
        TrayService.Initialize();

        // Initialize theme (System, Light, or Dark)
        Log("Initializing theme...");
        ThemeManager.Initialize();

        // Create and show main window
        Log("Creating MainWindow...");
        var mainWindow = new MainWindow();
        Log("Showing MainWindow...");
        mainWindow.Show();
        Log("MainWindow shown successfully");
    }

    /// <summary>
    /// Checks if the Interception driver is installed. If not, prompts the user
    /// and optionally installs it (relaunching as admin if needed).
    /// </summary>
    /// <returns>True if driver is installed (or was just installed).</returns>
    private bool CheckAndInstallDriver()
    {
        try
        {
            if (InterceptionService.IsDriverInstalledStatic)
                return true;
        }
        catch
        {
            // InputInterceptor DLL might not load — that's OK, treat as not installed
        }

        var result = MessageBox.Show(
            "Lionfish needs the Interception driver to capture keypad input.\n\n" +
            "This is a one-time setup that requires:\n" +
            "  • Administrator privileges\n" +
            "  • A system reboot after installation\n\n" +
            "The driver can be cleanly uninstalled at any time from Lionfish Settings.\n\n" +
            "Install the Interception driver now?",
            "Lionfish — First-Time Setup",
            MessageBoxButton.YesNo,
            MessageBoxImage.Question);

        if (result != MessageBoxResult.Yes)
        {
            MessageBox.Show(
                "Lionfish will open without interception capabilities.\n" +
                "You can install the driver later from Settings → Driver.",
                "Lionfish", MessageBoxButton.OK, MessageBoxImage.Information);
            return false;
        }

        // Check if we already have admin rights
        if (IsRunningAsAdmin())
        {
            return DoInstallDriver();
        }
        else
        {
            // Relaunch ourselves as admin to install the driver
            return RelaunchAsAdminForInstall();
        }
    }

    /// <summary>
    /// Performs the actual driver installation. Must be running as admin.
    /// </summary>
    private bool DoInstallDriver()
    {
        try
        {
            bool success = InterceptionService.InstallDriver();
            if (success)
            {
                var reboot = MessageBox.Show(
                    "Interception driver installed successfully!\n\n" +
                    "A system reboot is required to activate the driver.\n\n" +
                    "Reboot now?",
                    "Lionfish — Driver Installed",
                    MessageBoxButton.YesNo,
                    MessageBoxImage.Information);

                if (reboot == MessageBoxResult.Yes)
                {
                    Process.Start("shutdown", "/r /t 5 /c \"Rebooting to activate Lionfish Interception driver\"");
                    Current.Shutdown();
                }
                return true;
            }
            else
            {
                MessageBox.Show(
                    "Driver installation failed.\n\n" +
                    "Please try running Lionfish as Administrator manually,\n" +
                    "or install the driver from Settings → Driver.",
                    "Lionfish — Installation Failed",
                    MessageBoxButton.OK, MessageBoxImage.Warning);
                return false;
            }
        }
        catch (Exception ex)
        {
            MessageBox.Show(
                $"Driver installation error:\n\n{ex.Message}",
                "Lionfish — Installation Error",
                MessageBoxButton.OK, MessageBoxImage.Error);
            return false;
        }
    }

    /// <summary>
    /// Relaunches this application with admin privileges to install the driver.
    /// </summary>
    private bool RelaunchAsAdminForInstall()
    {
        try
        {
            var exePath = Environment.ProcessPath;
            if (exePath == null) return false;

            var psi = new ProcessStartInfo
            {
                FileName = exePath,
                Arguments = "--install-driver",
                UseShellExecute = true,
                Verb = "runas" // Triggers UAC elevation prompt
            };

            Process.Start(psi);

            // This instance exits — the elevated instance will handle installation
            Current.Shutdown();
            return true;
        }
        catch (System.ComponentModel.Win32Exception)
        {
            // User cancelled the UAC prompt
            MessageBox.Show(
                "Driver installation was cancelled.\n" +
                "You can install the driver later from Settings → Driver.",
                "Lionfish", MessageBoxButton.OK, MessageBoxImage.Information);
            return false;
        }
    }

    private static bool IsRunningAsAdmin()
    {
        using var identity = WindowsIdentity.GetCurrent();
        var principal = new WindowsPrincipal(identity);
        return principal.IsInRole(WindowsBuiltInRole.Administrator);
    }

    private void Application_Exit(object sender, ExitEventArgs e)
    {
        Log($"Application_Exit with exit code {e.ApplicationExitCode}");
        TrayService.Dispose();
        if (_hasMutex && _mutex != null)
        {
            try
            {
                _mutex.ReleaseMutex();
            }
            catch { }
            _mutex.Dispose();
            _mutex = null;
        }
    }
}
