using System.Threading;
using System.Threading.Tasks;

namespace Lionfish.Core.Actions;

public class KeystrokeAction : IAction
{
    public string DisplayName => Modifiers != ModifierKeys.None 
        ? $"Keystroke: {Modifiers} + {Key}" 
        : $"Keystroke: {Key}";
        
    public string Description => $"Simulates keystroke: {DisplayName}";
    public ActionType Type => ActionType.Keystroke;

    public VirtualKeyCode Key { get; set; }
    public ModifierKeys Modifiers { get; set; }

    public Task ExecuteAsync(CancellationToken cancellationToken = default)
    {
        InputSimulator.SendKeyCombination(Key, Modifiers);
        return Task.CompletedTask;
    }
}
