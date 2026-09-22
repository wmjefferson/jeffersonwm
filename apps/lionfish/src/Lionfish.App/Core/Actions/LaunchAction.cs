using System.Diagnostics;
using System.Threading;
using System.Threading.Tasks;

namespace Lionfish.Core.Actions;

public class LaunchAction : IAction
{
    public string DisplayName => "Launch App/URL";
    public string Description => $"Launches: {Target}";
    public ActionType Type => ActionType.Launch;

    public string Target { get; init; } = string.Empty;
    public string? Arguments { get; init; }
    public bool RunAsAdmin { get; init; }

    public Task ExecuteAsync(CancellationToken cancellationToken = default)
    {
        var psi = new ProcessStartInfo
        {
            FileName = Target,
            UseShellExecute = true
        };
        
        if (!string.IsNullOrEmpty(Arguments))
        {
            psi.Arguments = Arguments;
        }

        if (RunAsAdmin)
        {
            psi.Verb = "runas";
        }

        Process.Start(psi);
        return Task.CompletedTask;
    }
}
