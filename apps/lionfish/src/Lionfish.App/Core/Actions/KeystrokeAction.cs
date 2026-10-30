using System.Threading;
using System.Threading.Tasks;

namespace Lionfish.Core.Actions;

public class KeystrokeAction : IAction
{
    public string DisplayName
    {
        get
        {
            var parts = new System.Collections.Generic.List<string>();
            if (Modifiers.HasFlag(ModifierKeys.Ctrl)) parts.Add("Ctrl");
            if (Modifiers.HasFlag(ModifierKeys.Shift)) parts.Add("Shift");
            if (Modifiers.HasFlag(ModifierKeys.Alt)) parts.Add("Alt");
            if (Modifiers.HasFlag(ModifierKeys.Win)) parts.Add("Win");
            if (Key != VirtualKeyCode.None) parts.Add(Key.ToString());
            return parts.Count > 0 ? $"Keystroke: {string.Join(" + ", parts)}" : "Keystroke: (None)";
        }
    }
        
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
