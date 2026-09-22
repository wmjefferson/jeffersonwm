using Lionfish.Core.Actions;

namespace Lionfish.Core.Macros;

public enum MacroStepType
{
    KeyDown,
    KeyUp,
    KeyPress,
    TextType,
    Delay
}

public class MacroStep
{
    public MacroStepType Type { get; set; }
    public int DelayMs { get; set; }
    public VirtualKeyCode? Key { get; set; }
    public ModifierKeys? Modifiers { get; set; }
    public bool? IsKeyDown { get; set; }
    public string? Text { get; set; }
    public string? Description { get; set; }
}
