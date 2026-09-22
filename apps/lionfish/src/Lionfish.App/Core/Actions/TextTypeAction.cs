using System.Threading;
using System.Threading.Tasks;

namespace Lionfish.Core.Actions;

public class TextTypeAction : IAction
{
    public string DisplayName => $"Type: {(Text.Length > 20 ? Text[..17] + "..." : Text)}";
    public string Description => $"Types text: {Text}";
    public ActionType Type => ActionType.TextType;

    public string Text { get; set; } = string.Empty;
    public int DelayBetweenCharsMs { get; set; }

    public async Task ExecuteAsync(CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrEmpty(Text)) return;
        await InputSimulator.SendTextAsync(Text, DelayBetweenCharsMs, cancellationToken);
    }
}
