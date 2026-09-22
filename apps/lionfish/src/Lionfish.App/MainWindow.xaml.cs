using System;
using System.ComponentModel;
using System.Windows;
using System.Windows.Input;
using System.Windows.Interop;
using Lionfish.App.Services;
using Lionfish.App.ViewModels;

namespace Lionfish.App;

public partial class MainWindow : Window
{
    private readonly RawInputReceiver _rawInputReceiver = new();
    private HwndSource? _hwndSource;

    public MainWindow()
    {
        InitializeComponent();
        DataContext = new MainViewModel();

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

            _rawInputReceiver.KeyDetected += (devicePath, vKey, keyName) =>
            {
                if (DataContext is MainViewModel mainVm)
                {
                    mainVm.DevicesVM.OnKeyInput(devicePath, vKey, keyName);
                }
            };

            _rawInputReceiver.Register(helper.Handle);
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Error initializing RawInputReceiver: {ex.Message}");
        }
    }

    private void MainWindow_Closed(object? sender, EventArgs e)
    {
        _hwndSource?.RemoveHook(_rawInputReceiver.Hook);
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