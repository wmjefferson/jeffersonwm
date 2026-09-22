using System;
using System.Collections.Generic;

namespace Lionfish.Core.Macros;

public class Macro
{
    public string Id { get; init; } = Guid.NewGuid().ToString();
    public string Name { get; set; } = "New Macro";
    public List<MacroStep> Steps { get; set; } = new();
    public int RepeatCount { get; set; } = 1;
    public double SpeedMultiplier { get; set; } = 1.0;
}
