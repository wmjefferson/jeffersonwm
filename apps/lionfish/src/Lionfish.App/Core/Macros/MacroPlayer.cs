using System;
using System.Threading;
using System.Threading.Tasks;
using Lionfish.Core.Actions;

namespace Lionfish.Core.Macros;

public class MacroPlayer
{
    private CancellationTokenSource? _cts;

    public bool IsPlaying { get; private set; }

    public async Task PlayAsync(Macro macro, CancellationToken ct = default)
    {
        IsPlaying = true;
        _cts = CancellationTokenSource.CreateLinkedTokenSource(ct);

        try
        {
            for (int i = 0; i < macro.RepeatCount; i++)
            {
                foreach (var step in macro.Steps)
                {
                    if (_cts.Token.IsCancellationRequested) break;

                    var delay = (int)(step.DelayMs / macro.SpeedMultiplier);
                    if (delay > 0)
                    {
                        await Task.Delay(delay, _cts.Token);
                    }

                    if (step.Type == MacroStepType.TextType && step.Text != null)
                    {
                        var action = new TextTypeAction { Text = step.Text };
                        await action.ExecuteAsync(_cts.Token);
                    }
                    else if (step.Key.HasValue)
                    {
                        var action = new KeystrokeAction 
                        { 
                            Key = step.Key.Value, 
                            Modifiers = step.Modifiers ?? ModifierKeys.None 
                        };
                        await action.ExecuteAsync(_cts.Token);
                    }
                }
            }
        }
        finally
        {
            IsPlaying = false;
        }
    }

    public void Stop()
    {
        _cts?.Cancel();
    }
}
