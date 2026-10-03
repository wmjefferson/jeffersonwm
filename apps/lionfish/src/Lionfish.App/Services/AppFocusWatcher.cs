using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Windows;

namespace Lionfish.App.Services;

/// <summary>
/// Monitors Windows foreground window changes with sub-millisecond latency (0-2ms)
/// using Win32 SetWinEventHook(EVENT_SYSTEM_FOREGROUND). Consumes 0% CPU with zero polling.
/// </summary>
public class AppFocusWatcher : IDisposable
{
    private const uint EVENT_SYSTEM_FOREGROUND = 0x0003;
    private const uint WINEVENT_OUTOFCONTEXT = 0x0000;
    private const uint WINEVENT_SKIPOWNPROCESS = 0x0002;

    private delegate void WinEventDelegate(
        IntPtr hWinEventHook,
        uint eventType,
        IntPtr hWnd,
        int idObject,
        int idChild,
        uint dwEventThread,
        uint dwmsEventTime);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern IntPtr SetWinEventHook(
        uint eventMin,
        uint eventMax,
        IntPtr hmodWinEventProc,
        WinEventDelegate lpfnWinEventProc,
        uint idProcess,
        uint idThread,
        uint dwFlags);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool UnhookWinEvent(IntPtr hWinEventHook);

    [DllImport("user32.dll")]
    private static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll", SetLastError = true)]
    private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    private IntPtr _hook = IntPtr.Zero;
    // Must keep reference alive to prevent garbage collection of delegate
    private WinEventDelegate? _procDelegate;
    private bool _disposed;
    private string _lastProcessName = string.Empty;

    public bool IsRunning => _hook != IntPtr.Zero;

    /// <summary>
    /// Event fired when the active foreground application changes.
    /// Parameters: processName (e.g. "opera", "chrome", "excel"), windowTitle
    /// </summary>
    public event Action<string, string>? ForegroundAppChanged;

    public void Start()
    {
        if (IsRunning || _disposed) return;

        // SetWinEventHook needs a message loop, so run on the WPF Dispatcher thread
        if (Application.Current?.Dispatcher?.CheckAccess() == false)
        {
            Application.Current.Dispatcher.Invoke(Start);
            return;
        }

        _procDelegate = WinEventCallback;
        _hook = SetWinEventHook(
            EVENT_SYSTEM_FOREGROUND,
            EVENT_SYSTEM_FOREGROUND,
            IntPtr.Zero,
            _procDelegate,
            0,
            0,
            WINEVENT_OUTOFCONTEXT | WINEVENT_SKIPOWNPROCESS);

        // Immediately check current foreground window on start
        CheckCurrentForeground();
    }

    public void Stop()
    {
        if (_hook != IntPtr.Zero)
        {
            UnhookWinEvent(_hook);
            _hook = IntPtr.Zero;
            _procDelegate = null;
        }
    }

    private void WinEventCallback(
        IntPtr hWinEventHook,
        uint eventType,
        IntPtr hWnd,
        int idObject,
        int idChild,
        uint dwEventThread,
        uint dwmsEventTime)
    {
        if (hWnd == IntPtr.Zero)
            hWnd = GetForegroundWindow();

        ProcessWindow(hWnd);
    }

    public void CheckCurrentForeground()
    {
        IntPtr hWnd = GetForegroundWindow();
        if (hWnd != IntPtr.Zero)
        {
            ProcessWindow(hWnd);
        }
    }

    private void ProcessWindow(IntPtr hWnd)
    {
        if (hWnd == IntPtr.Zero) return;

        GetWindowThreadProcessId(hWnd, out uint pid);
        if (pid == 0) return;

        // Don't switch for Lionfish itself
        if (pid == (uint)Environment.ProcessId) return;

        try
        {
            using var proc = Process.GetProcessById((int)pid);
            string procName = proc.ProcessName;

            var sb = new StringBuilder(256);
            GetWindowText(hWnd, sb, sb.Capacity);
            string windowTitle = sb.ToString();

            if (!string.Equals(procName, _lastProcessName, StringComparison.OrdinalIgnoreCase))
            {
                _lastProcessName = procName;
                ForegroundAppChanged?.Invoke(procName, windowTitle);
            }
        }
        catch
        {
            // Process may have exited or access denied
        }
    }

    public void Dispose()
    {
        if (!_disposed)
        {
            Stop();
            _disposed = true;
        }
    }
}
