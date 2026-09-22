using System;
using System.Drawing;
using System.Windows;
using System.Windows.Controls;
using H.NotifyIcon;
using Lionfish.App.Models;

namespace Lionfish.App.Services;

public class TrayService : IDisposable
{
    private TaskbarIcon? _taskbarIcon;

    public void Initialize()
    {
        // Programmatic TaskbarIcon setup
        _taskbarIcon = new TaskbarIcon
        {
            Icon = CreateIcon(System.Drawing.Color.Green),
            ToolTipText = "Lionfish - Active | Profile: Default"
        };

        _taskbarIcon.TrayLeftMouseUp += (s, e) => ToggleMainWindow();

        UpdateContextMenu();
    }

    private void ToggleMainWindow()
    {
        var mainWindow = Application.Current.MainWindow;
        if (mainWindow != null)
        {
            if (mainWindow.IsVisible)
            {
                mainWindow.Hide();
            }
            else
            {
                mainWindow.Show();
                mainWindow.Activate();
            }
        }
    }

    private void UpdateContextMenu()
    {
        if (_taskbarIcon == null) return;

        var contextMenu = new ContextMenu();

        // Mock profile list
        var profileItem1 = new MenuItem { Header = "Profile 1", IsCheckable = true, IsChecked = true };
        var profileItem2 = new MenuItem { Header = "Profile 2", IsCheckable = true };
        
        contextMenu.Items.Add(profileItem1);
        contextMenu.Items.Add(profileItem2);
        contextMenu.Items.Add(new Separator());

        var pauseItem = new MenuItem { Header = "Pause Interception" };
        pauseItem.Click += (s, e) => { /* Mock toggle */ };
        contextMenu.Items.Add(pauseItem);

        var settingsItem = new MenuItem { Header = "Settings..." };
        settingsItem.Click += (s, e) => 
        {
            ToggleMainWindow(); // Show window
        };
        contextMenu.Items.Add(settingsItem);

        contextMenu.Items.Add(new Separator());

        var exitItem = new MenuItem { Header = "Exit" };
        exitItem.Click += (s, e) => Application.Current.Shutdown();
        contextMenu.Items.Add(exitItem);

        _taskbarIcon.ContextMenu = contextMenu;
    }

    public void UpdateStatus(InterceptionStatus status, string profileName)
    {
        if (_taskbarIcon == null) return;

        Color iconColor = status switch
        {
            InterceptionStatus.Active => Color.Green,
            InterceptionStatus.Paused => Color.Gold,
            InterceptionStatus.Error => Color.Red,
            InterceptionStatus.DriverNotInstalled => Color.DarkRed,
            _ => Color.Gray
        };

        _taskbarIcon.Icon = CreateIcon(iconColor);
        _taskbarIcon.ToolTipText = $"Lionfish - {status} | Profile: {profileName}";
    }

    private System.Drawing.Icon CreateIcon(Color color)
    {
        using var bitmap = new Bitmap(16, 16);
        using var graphics = Graphics.FromImage(bitmap);
        graphics.Clear(Color.Transparent);
        using var brush = new SolidBrush(color);
        graphics.FillEllipse(brush, 2, 2, 12, 12);
        
        // Simple "L" letter in the icon
        using var textBrush = new SolidBrush(Color.White);
        using var fontFamily = new System.Drawing.FontFamily("Arial");
        using var font = new Font(fontFamily, 8, System.Drawing.FontStyle.Bold);
        graphics.DrawString("L", font, textBrush, 3, 2);

        return System.Drawing.Icon.FromHandle(bitmap.GetHicon());
    }

    public void Dispose()
    {
        _taskbarIcon?.Dispose();
    }
}
