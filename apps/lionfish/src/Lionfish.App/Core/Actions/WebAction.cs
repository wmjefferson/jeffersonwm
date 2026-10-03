using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Lionfish.Core.Web;

namespace Lionfish.Core.Actions;

public class WebStep
{
    public string Type { get; set; } = "click";
    public string Selector { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public int DelayMs { get; set; } = 100;
}

public class WebAction : IAction
{
    public string DisplayName => Steps.Count switch
    {
        0 => "Web: (Empty)",
        1 => $"Web: {Steps[0].Description}",
        _ => $"Web: {Steps[0].Description} (+{Steps.Count - 1} steps)"
    };

    public string Description => $"Executes {Steps.Count} web action(s) on '{UrlMatch}': {string.Join(" → ", Steps.Select(s => s.Description))}";
    public ActionType Type => ActionType.Web;

    public string UrlMatch { get; set; } = "*";
    public List<WebStep> Steps { get; set; } = new();

    public async Task ExecuteAsync(CancellationToken cancellationToken = default)
    {
        if (Steps.Count == 0) return;
        var bridge = BrowserBridgeService.Instance;
        if (bridge != null)
        {
            await bridge.ExecuteWebActionAsync(this, cancellationToken);
        }
    }
}
