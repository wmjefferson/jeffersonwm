using System.Text.Json.Serialization;
using Lionfish.Core.Actions;

namespace Lionfish.Core.Mapping;

public enum KeyTrigger
{
    OnKeyDown,
    OnKeyUp,
    OnHold
}

public class KeyMapping
{
    public ushort ScanCode { get; set; }
    public bool IsE0 { get; set; }
    public string KeyName { get; set; } = string.Empty;
    public KeyTrigger Trigger { get; set; } = KeyTrigger.OnKeyDown;
    public IAction? Action { get; set; }

    [JsonIgnore]
    public string ActionAssignment => Action?.DisplayName ?? "Not assigned";
}
