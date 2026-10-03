using System;
using System.Windows;
using System.Windows.Media;
using Microsoft.Win32;
using Lionfish.Core.Config;

namespace Lionfish.App.Services;

public static class ThemeManager
{
    private static string _currentMode = "System";
    private static bool _isRegistered = false;

    public static string CurrentMode => _currentMode;
    public static bool IsDark { get; private set; } = false;

    public static event Action<bool>? ThemeChanged;

    public static void Initialize()
    {
        try
        {
            var configStore = new ConfigStore();
            var config = configStore.LoadConfig();
            _currentMode = string.IsNullOrWhiteSpace(config.ThemeMode) ? "System" : config.ThemeMode;
        }
        catch
        {
            _currentMode = "System";
        }

        if (!_isRegistered)
        {
            SystemEvents.UserPreferenceChanged += OnUserPreferenceChanged;
            _isRegistered = true;
        }

        ApplyTheme(_currentMode);
    }

    public static void ApplyTheme(string mode)
    {
        _currentMode = mode;
        bool isDark;

        if (string.Equals(mode, "Light", StringComparison.OrdinalIgnoreCase))
        {
            isDark = false;
        }
        else if (string.Equals(mode, "Dark", StringComparison.OrdinalIgnoreCase))
        {
            isDark = true;
        }
        else // System default
        {
            isDark = IsWindowsDarkTheme();
        }

        IsDark = isDark;
        SetThemeBrushes(isDark);
        ThemeChanged?.Invoke(isDark);
    }

    public static bool IsWindowsDarkTheme()
    {
        try
        {
            using var key = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize");
            var val = key?.GetValue("AppsUseLightTheme");
            if (val is int intVal)
            {
                return intVal == 0;
            }
        }
        catch { }
        return false; // Default to Light if unable to read
    }

    private static void OnUserPreferenceChanged(object sender, UserPreferenceChangedEventArgs e)
    {
        if (e.Category == UserPreferenceCategory.General && string.Equals(_currentMode, "System", StringComparison.OrdinalIgnoreCase))
        {
            Application.Current?.Dispatcher?.Invoke(() =>
            {
                ApplyTheme("System");
            });
        }
    }

    private static void SetThemeBrushes(bool isDark)
    {
        var app = Application.Current;
        if (app == null) return;

        void UpdateBrush(string key, Color color)
        {
            var brush = new SolidColorBrush(color);
            brush.Freeze();
            app.Resources[key] = brush;
        }

        if (isDark)
        {
            // Fluent Dark Theme (Neutral Dark Slate / Mica Dark)
            UpdateBrush("BgBrush", Color.FromRgb(0x20, 0x20, 0x20));
            UpdateBrush("SurfaceBrush", Color.FromRgb(0x28, 0x28, 0x28));
            UpdateBrush("CardBrush", Color.FromRgb(0x2D, 0x2D, 0x2D));
            UpdateBrush("CardBorderBrush", Color.FromRgb(0x3E, 0x3E, 0x3E));
            UpdateBrush("BorderBrush", Color.FromRgb(0x38, 0x38, 0x38));
            UpdateBrush("TextPrimaryBrush", Color.FromRgb(0xFF, 0xFF, 0xFF));
            UpdateBrush("TextSecondaryBrush", Color.FromRgb(0xA0, 0xA0, 0xA0));
            UpdateBrush("HighlightCardBrush", Color.FromRgb(0x3D, 0x27, 0x20));
            UpdateBrush("ActiveHighlightCardBrush", Color.FromRgb(0x18, 0x2A, 0x3E));
            UpdateBrush("ActiveHighlightBorderBrush", Color.FromRgb(0x38, 0x8A, 0xDE));
            UpdateBrush("InfoBrush", Color.FromRgb(0x38, 0x8A, 0xDE));
            UpdateBrush("SecondaryAccentBrush", Color.FromRgb(0x4E, 0xCD, 0xC4));
            UpdateBrush("SuccessBrush", Color.FromRgb(0x4C, 0xAF, 0x50));
            UpdateBrush("WarningBrush", Color.FromRgb(0xFF, 0xC1, 0x07));
            UpdateBrush("ErrorBrush", Color.FromRgb(0xF4, 0x43, 0x36));
            UpdateBrush("TabContainerBrush", Color.FromRgb(0x28, 0x28, 0x28));
            UpdateBrush("TabHoverBrush", Color.FromRgb(0x3D, 0x3D, 0x5C));
            UpdateBrush("InputBgBrush", Color.FromRgb(0x20, 0x20, 0x20));
        }
        else
        {
            // Fluent Light Theme (Clean Off-White Mica-Alt / Light Gray Cards)
            UpdateBrush("BgBrush", Color.FromRgb(0xF3, 0xF3, 0xF3));
            UpdateBrush("SurfaceBrush", Color.FromRgb(0xFA, 0xFA, 0xFA));
            UpdateBrush("CardBrush", Color.FromRgb(0xFF, 0xFF, 0xFF));
            UpdateBrush("CardBorderBrush", Color.FromRgb(0xE2, 0xE4, 0xE8));
            UpdateBrush("BorderBrush", Color.FromRgb(0xD8, 0xD8, 0xDC));
            UpdateBrush("TextPrimaryBrush", Color.FromRgb(0x1A, 0x1A, 0x1A));
            UpdateBrush("TextSecondaryBrush", Color.FromRgb(0x5C, 0x5C, 0x5C));
            UpdateBrush("HighlightCardBrush", Color.FromRgb(0xFF, 0xF2, 0xEC));
            UpdateBrush("ActiveHighlightCardBrush", Color.FromRgb(0xEE, 0xF6, 0xFF));
            UpdateBrush("ActiveHighlightBorderBrush", Color.FromRgb(0x00, 0x78, 0xD4));
            UpdateBrush("InfoBrush", Color.FromRgb(0x00, 0x78, 0xD4));
            UpdateBrush("SecondaryAccentBrush", Color.FromRgb(0x00, 0x82, 0x72));
            UpdateBrush("SuccessBrush", Color.FromRgb(0x10, 0x7C, 0x41));
            UpdateBrush("WarningBrush", Color.FromRgb(0xCA, 0x50, 0x10));
            UpdateBrush("ErrorBrush", Color.FromRgb(0xC4, 0x2B, 0x1C));
            UpdateBrush("TabContainerBrush", Color.FromRgb(0xEA, 0xEA, 0xEA));
            UpdateBrush("TabHoverBrush", Color.FromRgb(0xDC, 0xDC, 0xDC));
            UpdateBrush("InputBgBrush", Color.FromRgb(0xFF, 0xFF, 0xFF));
        }

        // Shared Accent Colors (Brand Orange preserved across Light & Dark)
        UpdateBrush("PrimaryAccentBrush", Color.FromRgb(0xFF, 0x6B, 0x35));
        UpdateBrush("PrimaryAccentHoverBrush", Color.FromRgb(0xFF, 0x8B, 0x5E));
    }
}
