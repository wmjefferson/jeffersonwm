using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Input;
using System.Windows.Interop;
using Lionfish.App.Services;
using Lionfish.App.ViewModels;

namespace Lionfish.App;

public partial class MainWindow : Window
{
    private readonly RawInputReceiver _rawInputReceiver = new();
    private readonly System.Windows.Threading.DispatcherTimer _pnpDebounceTimer = new()
    {
        Interval = TimeSpan.FromMilliseconds(400)
    };
    private HwndSource? _hwndSource;

    public MainWindow()
    {
        InitializeComponent();
        var mainVm = new MainViewModel();
        DataContext = mainVm;

        if (Application.Current is App app)
        {
            app.TrayService.Attach(mainVm);
        }

        _pnpDebounceTimer.Tick += (s, e) =>
        {
            _pnpDebounceTimer.Stop();
            if (DataContext is MainViewModel vm)
            {
                _ = vm.DevicesVM.RefreshDevicesAsync();
            }
        };

        Loaded += MainWindow_Loaded;
        Closing += Window_Closing;
        Closed += MainWindow_Closed;
    }

    private void MainWindow_Loaded(object sender, RoutedEventArgs e)
    {
        try
        {
            var helper = new WindowInteropHelper(this);
            _hwndSource = HwndSource.FromHwnd(helper.Handle);
            _hwndSource?.AddHook(_rawInputReceiver.Hook);
            _hwndSource?.AddHook(SingleInstanceHook);

            _rawInputReceiver.KeyDetected += (devicePath, vKey, keyName) =>
            {
                if (DataContext is MainViewModel mainVm)
                {
                    mainVm.DevicesVM.OnKeyInput(devicePath, vKey, keyName);
                }
            };

            _rawInputReceiver.DeviceConnectionChanged += () =>
            {
                Dispatcher.InvokeAsync(() =>
                {
                    _pnpDebounceTimer.Stop();
                    _pnpDebounceTimer.Start();
                });
            };

            _rawInputReceiver.Register(helper.Handle);

            UpdateTitleBarTheme(ThemeManager.IsDark);
            ThemeManager.ThemeChanged += OnThemeChanged;
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Error initializing RawInputReceiver: {ex.Message}");
        }
    }

    [DllImport("dwmapi.dll", PreserveSig = true)]
    private static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int attrValue, int attrSize);

    private const int DWMWA_USE_IMMERSIVE_DARK_MODE_BEFORE_20H1 = 19;
    private const int DWMWA_USE_IMMERSIVE_DARK_MODE = 20;

    public void UpdateTitleBarTheme(bool isDark)
    {
        try
        {
            var helper = new WindowInteropHelper(this);
            var hwnd = helper.Handle;
            if (hwnd == IntPtr.Zero) return;

            int useDarkMode = isDark ? 1 : 0;
            int hr = DwmSetWindowAttribute(hwnd, DWMWA_USE_IMMERSIVE_DARK_MODE, ref useDarkMode, sizeof(int));
            if (hr != 0)
            {
                DwmSetWindowAttribute(hwnd, DWMWA_USE_IMMERSIVE_DARK_MODE_BEFORE_20H1, ref useDarkMode, sizeof(int));
            }
        }
        catch
        {
            // Ignore on older Windows or if DWM API is unavailable
        }
    }

    private void OnThemeChanged(bool isDark)
    {
        Dispatcher.InvokeAsync(() => UpdateTitleBarTheme(isDark));
    }

    private IntPtr SingleInstanceHook(IntPtr hwnd, int msg, IntPtr wParam, IntPtr lParam, ref bool handled)
    {
        if (msg == App.WmShowLionfish && App.WmShowLionfish != 0)
        {
            Dispatcher.InvokeAsync(() =>
            {
                Show();
                if (WindowState == WindowState.Minimized)
                {
                    WindowState = WindowState.Normal;
                }
                Activate();
                Focus();
                Topmost = true;
                Topmost = false;
            });
            handled = true;
        }
        return IntPtr.Zero;
    }

    private void MainWindow_Closed(object? sender, EventArgs e)
    {
        ThemeManager.ThemeChanged -= OnThemeChanged;
        _pnpDebounceTimer.Stop();
        _hwndSource?.RemoveHook(_rawInputReceiver.Hook);
        _hwndSource?.RemoveHook(SingleInstanceHook);
        _rawInputReceiver.Dispose();
        if (DataContext is MainViewModel mainVm)
        {
            mainVm.Shutdown();
        }
    }

    private void Window_Closing(object? sender, CancelEventArgs e)
    {
        var vm = (MainViewModel)DataContext;
        bool shiftPressed = Keyboard.IsKeyDown(Key.LeftShift) || Keyboard.IsKeyDown(Key.RightShift);

        if (vm.SettingsVM.MinimizeToTrayOnClose && !shiftPressed)
        {
            e.Cancel = true;
            Hide();
        }
    }
}