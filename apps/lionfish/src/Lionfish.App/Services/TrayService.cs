using System;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Controls;
using H.NotifyIcon;
using Lionfish.App.Models;
using Lionfish.App.ViewModels;

namespace Lionfish.App.Services;

public class TrayService : IDisposable
{
    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool DestroyIcon(IntPtr hIcon);

    private TaskbarIcon? _taskbarIcon;
    private MainViewModel? _mainVm;

    public void Initialize()
    {
        try
        {
            _taskbarIcon = new TaskbarIcon
            {
                Icon = CreateIcon(Color.FromArgb(52, 199, 89)), // Green
                ToolTipText = "🦁 Lionfish Keypad Interceptor — Active",
                Visibility = Visibility.Visible
            };

            _taskbarIcon.TrayLeftMouseUp += (s, e) => ToggleMainWindow();
            _taskbarIcon.TrayMouseDoubleClick += (s, e) => ShowMainWindow();

            UpdateContextMenu();
            _taskbarIcon.ForceCreate();
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[TrayService] Initialize error: {ex.Message}");
        }
    }

    public void Attach(MainViewModel vm)
    {
        _mainVm = vm;

        vm.PropertyChanged += (s, e) =>
        {
            if (e.PropertyName == nameof(MainViewModel.InterceptionStatus) ||
                e.PropertyName == nameof(MainViewModel.ActiveProfileName))
            {
                Application.Current?.Dispatcher?.Invoke(() =>
                {
                    UpdateStatus(vm.InterceptionStatus, vm.KeyMapVM.SelectedProfile?.Name ?? "Default");
                    UpdateContextMenu();
                });
            }
        };

        vm.SettingsVM.PropertyChanged += (s, e) =>
        {
            if (e.PropertyName == nameof(SettingsViewModel.ShowOsdOverlay))
            {
                Application.Current?.Dispatcher?.Invoke(UpdateContextMenu);
            }
        };

        UpdateStatus(vm.InterceptionStatus, vm.KeyMapVM.SelectedProfile?.Name ?? "Default");
        UpdateContextMenu();
    }

    public void ShowMainWindow()
    {
        Application.Current?.Dispatcher?.Invoke(() =>
        {
            var mainWindow = Application.Current.MainWindow;
            if (mainWindow != null)
            {
                mainWindow.Show();
                if (mainWindow.WindowState == WindowState.Minimized)
                {
                    mainWindow.WindowState = WindowState.Normal;
                }
                mainWindow.Activate();
                mainWindow.Focus();
                mainWindow.Topmost = true;
                mainWindow.Topmost = false;
            }
        });
    }

    public void ToggleMainWindow()
    {
        Application.Current?.Dispatcher?.Invoke(() =>
        {
            var mainWindow = Application.Current.MainWindow;
            if (mainWindow != null)
            {
                if (mainWindow.IsVisible && mainWindow.WindowState != WindowState.Minimized)
                {
                    mainWindow.Hide();
                }
                else
                {
                    ShowMainWindow();
                }
            }
        });
    }

    public void UpdateContextMenu()
    {
        if (_taskbarIcon == null) return;

        Application.Current?.Dispatcher?.Invoke(() =>
        {
            var contextMenu = new ContextMenu();

            // 1. Open Lionfish
            var openItem = new MenuItem
            {
                Header = "🦁 Open Lionfish",
                FontWeight = FontWeights.Bold
            };
            openItem.Click += (s, e) => ShowMainWindow();
            contextMenu.Items.Add(openItem);

            // 2. Pause / Resume Interception toggle
            if (_mainVm != null)
            {
                bool isCapturing = _mainVm.Interception.IsCapturing;
                var toggleItem = new MenuItem
                {
                    Header = isCapturing ? "⏸ Pause Interception" : "▶ Resume Interception"
                };
                toggleItem.Click += (s, e) =>
                {
                    if (isCapturing)
                    {
                        _mainVm.PauseInterceptionCommand.Execute(null);
                    }
                    else
                    {
                        _mainVm.ResumeInterceptionCommand.Execute(null);
                    }
                    UpdateContextMenu();
                };
                contextMenu.Items.Add(toggleItem);
            }

            contextMenu.Items.Add(new Separator());

            // 3. Profiles submenu
            if (_mainVm != null && _mainVm.KeyMapVM.Profiles.Count > 0)
            {
                var profilesMenu = new MenuItem { Header = "Profiles" };
                foreach (var profile in _mainVm.KeyMapVM.Profiles)
                {
                    var pItem = new MenuItem
                    {
                        Header = profile.Name,
                        IsCheckable = true,
                        IsChecked = _mainVm.KeyMapVM.SelectedProfile?.Id == profile.Id
                    };
                    var targetProfile = profile;
                    pItem.Click += (s, e) =>
                    {
                        _mainVm.KeyMapVM.SelectedProfile = targetProfile;
                        UpdateContextMenu();
                    };
                    profilesMenu.Items.Add(pItem);
                }
                contextMenu.Items.Add(profilesMenu);
            }

            // 3b. Show On-Screen Display (OSD) toggle
            if (_mainVm != null)
            {
                var osdItem = new MenuItem
                {
                    Header = "🖥 Show On-Screen Display (OSD)",
                    IsCheckable = true,
                    IsChecked = _mainVm.SettingsVM.ShowOsdOverlay
                };
                osdItem.Click += (s, e) =>
                {
                    _mainVm.SettingsVM.ShowOsdOverlay = !_mainVm.SettingsVM.ShowOsdOverlay;
                    UpdateContextMenu();
                };
                contextMenu.Items.Add(osdItem);
            }

            // 4. Settings...
            var settingsItem = new MenuItem { Header = "⚙ Settings..." };
            settingsItem.Click += (s, e) =>
            {
                if (_mainVm != null)
                {
                    _mainVm.SelectedTabIndex = 3; // Settings tab
                }
                ShowMainWindow();
            };
            contextMenu.Items.Add(settingsItem);

            contextMenu.Items.Add(new Separator());

            // 5. Exit
            var exitItem = new MenuItem { Header = "❌ Exit Lionfish" };
            exitItem.Click += (s, e) => Application.Current.Shutdown();
            contextMenu.Items.Add(exitItem);

            _taskbarIcon.ContextMenu = contextMenu;
        });
    }

    public void UpdateStatus(InterceptionStatus status, string profileName)
    {
        if (_taskbarIcon == null) return;

        Color iconColor = status switch
        {
            InterceptionStatus.Active => Color.FromArgb(52, 199, 89),       // Green
            InterceptionStatus.Paused => Color.FromArgb(255, 107, 53),      // Lionfish Orange
            InterceptionStatus.Error => Color.FromArgb(255, 69, 58),        // Red
            InterceptionStatus.DriverNotInstalled => Color.FromArgb(175, 40, 30),
            _ => Color.Gray
        };

        try
        {
            _taskbarIcon.Icon = CreateIcon(iconColor);
            _taskbarIcon.ToolTipText = $"🦁 Lionfish — {status} | Profile: {profileName}";
        }
        catch { }
    }

    private static System.Drawing.Icon CreateIcon(Color color)
    {
        using var bitmap = new Bitmap(32, 32);
        using (var g = Graphics.FromImage(bitmap))
        {
            g.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.AntiAlias;
            g.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
            g.Clear(Color.Transparent);

            bool drewLogo = false;
            try
            {
                var sri = System.Windows.Application.GetResourceStream(new Uri("pack://application:,,,/Assets/logo.png"));
                if (sri != null)
                {
                    using var s = sri.Stream;
                    using var logoImg = System.Drawing.Image.FromStream(s);
                    g.DrawImage(logoImg, new Rectangle(0, 0, 30, 30));
                    drewLogo = true;
                }
            }
            catch { }

            if (!drewLogo)
            {
                try
                {
                    var exeDir = AppDomain.CurrentDomain.BaseDirectory;
                    var logoPath = System.IO.Path.Combine(exeDir, "Assets", "logo.png");
                    if (System.IO.File.Exists(logoPath))
                    {
                        using var logoImg = System.Drawing.Image.FromFile(logoPath);
                        g.DrawImage(logoImg, new Rectangle(0, 0, 30, 30));
                        drewLogo = true;
                    }
                }
                catch { }
            }

            if (!drewLogo)
            {
                using var fallbackBrush = new SolidBrush(Color.FromArgb(255, 107, 53));
                g.FillEllipse(fallbackBrush, 2, 2, 26, 26);
            }

            // Status indicator dot in bottom-right corner
            using var bgDotBrush = new SolidBrush(Color.FromArgb(30, 30, 46));
            g.FillEllipse(bgDotBrush, 19, 19, 13, 13);
            using var dotBrush = new SolidBrush(color);
            g.FillEllipse(dotBrush, 21, 21, 9, 9);
        }

        IntPtr hIcon = bitmap.GetHicon();
        var tempIcon = System.Drawing.Icon.FromHandle(hIcon);
        using var ms = new MemoryStream();
        tempIcon.Save(ms);
        ms.Position = 0;
        DestroyIcon(hIcon);
        tempIcon.Dispose();
        return new System.Drawing.Icon(ms);
    }

    public void Dispose()
    {
        _taskbarIcon?.Dispose();
    }
}
