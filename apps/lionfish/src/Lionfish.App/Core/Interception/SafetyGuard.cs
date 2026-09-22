using System;
using System.Threading;
using System.Threading.Tasks;

namespace Lionfish.Core.Interception;

public class SafetyGuard : IDisposable
{
    private readonly InterceptionService _service;
    private bool _lCtrlDown;
    private bool _rCtrlDown;
    private DateTime _lastHeartbeat = DateTime.Now;
    private CancellationTokenSource? _watchdogCts;

    public event Action? KillSwitchActivated;

    public SafetyGuard(InterceptionService service)
    {
        _service = service;
        _service.KeyIntercepted += OnKeyIntercepted;
    }

    private void OnKeyIntercepted(DeviceInfo device, InterceptedKeyEventArgs e)
    {
        if (device.IsMasterKeyboard) return;

        if (e.ScanCode == 0x1D && !e.IsE0) _lCtrlDown = e.IsKeyDown;
        if (e.ScanCode == 0x1D && e.IsE0) _rCtrlDown = e.IsKeyDown;

        if (_lCtrlDown && _rCtrlDown)
        {
            EmergencyStop();
        }
    }

    public void Heartbeat()
    {
        _lastHeartbeat = DateTime.Now;
    }

    public void StartWatchdog()
    {
        _watchdogCts = new CancellationTokenSource();
        Task.Run(async () =>
        {
            while (!_watchdogCts.Token.IsCancellationRequested)
            {
                await Task.Delay(1000);
                if ((DateTime.Now - _lastHeartbeat).TotalSeconds > 5)
                {
                    EmergencyStop();
                }
            }
        }, _watchdogCts.Token);
    }

    public async Task StartWithDelayAsync(TimeSpan delay)
    {
        await Task.Delay(delay);
        _service.StartCapture();
    }

    public void EmergencyStop()
    {
        _service.StopCapture();
        KillSwitchActivated?.Invoke();
    }

    public void Dispose()
    {
        _watchdogCts?.Cancel();
        _watchdogCts?.Dispose();
        _service.KeyIntercepted -= OnKeyIntercepted;
    }
}
