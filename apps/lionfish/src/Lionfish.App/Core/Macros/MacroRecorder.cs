using System;
using System.Collections.Generic;
using Lionfish.Core.Interception;

namespace Lionfish.Core.Macros;

public class MacroRecorder
{
    private readonly InterceptionService _service;
    private Macro? _currentMacro;
    private DateTime _lastEventTime;
    
    public bool IsRecording { get; private set; }

    public MacroRecorder(InterceptionService service)
    {
        _service = service;
    }

    public void StartRecording()
    {
        _currentMacro = new Macro { Name = $"Recorded Macro {DateTime.Now:g}" };
        _lastEventTime = DateTime.Now;
        IsRecording = true;
        _service.KeyIntercepted += OnKeyIntercepted;
    }

    private void OnKeyIntercepted(DeviceInfo device, InterceptedKeyEventArgs e)
    {
        if (!IsRecording || _currentMacro == null) return;
        
        var now = DateTime.Now;
        var delay = (int)(now - _lastEventTime).TotalMilliseconds;
        _lastEventTime = now;

        _currentMacro.Steps.Add(new MacroStep
        {
            Type = e.IsKeyDown ? MacroStepType.KeyDown : MacroStepType.KeyUp,
            DelayMs = delay,
            // mapping ScanCode back to VirtualKeyCode is complex and skipped here for brevity
            Description = e.KeyName
        });
    }

    public Macro? StopRecording()
    {
        IsRecording = false;
        _service.KeyIntercepted -= OnKeyIntercepted;
        return _currentMacro;
    }
}
