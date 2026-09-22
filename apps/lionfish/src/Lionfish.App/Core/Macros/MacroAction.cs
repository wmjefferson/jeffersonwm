using System.Threading;
using System.Threading.Tasks;
using Lionfish.Core.Actions;

namespace Lionfish.Core.Macros;

public class MacroAction : IAction
{
    private readonly MacroPlayer _player;
    
    public string DisplayName => $"Macro: {Macro.Name}";
    public string Description => $"Plays macro: {Macro.Name}";
    public ActionType Type => ActionType.Macro;

    public Macro Macro { get; init; }

    public MacroAction()
    {
        Macro = new Macro();
        _player = new MacroPlayer();
    }

    public async Task ExecuteAsync(CancellationToken cancellationToken = default)
    {
        await _player.PlayAsync(Macro, cancellationToken);
    }
}
