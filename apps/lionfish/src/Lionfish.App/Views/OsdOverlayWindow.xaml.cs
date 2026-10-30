using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Input;
using System.Windows.Interop;
using Lionfish.Core.Config;

namespace Lionfish.App.Views;

public partial class OsdOverlayWindow : Window
{
    private const int GWL_EXSTYLE = -20;
    private const int WS_EX_NOACTIVATE = 0x08000000;
    private const int WS_EX_TOOLWINDOW = 0x00000080;

    [DllImport("user32.dll", SetLastError = true)]
    private static extern int GetWindowLong(IntPtr hWnd, int nIndex);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);

    private bool _hasCustomPosition;

    public OsdOverlayWindow()
    {
        InitializeComponent();
        Loaded += OnLoaded;
    }

    protected override void OnSourceInitialized(EventArgs e)
    {
        base.OnSourceInitialized(e);

        // Apply WS_EX_NOACTIVATE so clicking or dragging the OSD never steals focus
        // from active apps (e.g. Google Docs, Excel, Word).
        // Apply WS_EX_TOOLWINDOW so it doesn't appear in Alt+Tab.
        var helper = new WindowInteropHelper(this);
        int exStyle = GetWindowLong(helper.Handle, GWL_EXSTYLE);
        SetWindowLong(helper.Handle, GWL_EXSTYLE, exStyle | WS_EX_NOACTIVATE | WS_EX_TOOLWINDOW);
    }

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        try
        {
            var configStore = new ConfigStore();
            var config = configStore.LoadConfig();
            if (config.OsdLeft >= 0 && config.OsdTop >= 0 &&
                config.OsdLeft < SystemParameters.VirtualScreenWidth - 40 &&
                config.OsdTop < SystemParameters.VirtualScreenHeight - 40)
            {
                Left = config.OsdLeft;
                Top = config.OsdTop;
                _hasCustomPosition = true;
                return;
            }
        }
        catch { }

        if (!_hasCustomPosition)
        {
            // Position neatly in the bottom-right corner of the work area
            var workArea = SystemParameters.WorkArea;
            Left = workArea.Right - ActualWidth - 24;
            Top = workArea.Bottom - ActualHeight - 24;
        }
    }

    private void Window_MouseLeftButtonDown(object sender, MouseButtonEventArgs e)
    {
        if (e.ChangedButton == MouseButton.Left)
        {
            _hasCustomPosition = true;
            try
            {
                DragMove();
                SavePosition();
            }
            catch { }
        }
    }

    private void CloseButton_Click(object sender, RoutedEventArgs e)
    {
        Hide();
        if (DataContext is ViewModels.MainViewModel mainVm)
        {
            mainVm.SettingsVM.ShowOsdOverlay = false;
        }
    }

    protected override void OnClosing(CancelEventArgs e)
    {
        // Cancel the actual window destruction so it can be re-shown anytime without error
        e.Cancel = true;
        Hide();
        if (DataContext is ViewModels.MainViewModel mainVm)
        {
            mainVm.SettingsVM.ShowOsdOverlay = false;
        }
    }

    private void SavePosition()
    {
        try
        {
            var configStore = new ConfigStore();
            var config = configStore.LoadConfig();
            config.OsdLeft = Left;
            config.OsdTop = Top;
            configStore.SaveConfig(config);
        }
        catch { }
    }
}
