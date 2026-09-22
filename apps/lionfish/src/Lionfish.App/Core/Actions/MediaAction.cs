using System.Threading;
using System.Threading.Tasks;

namespace Lionfish.Core.Actions;

public enum MediaCommand
{
    PlayPause,
    NextTrack,
    PrevTrack,
    VolumeUp,
    VolumeDown,
    Mute,
    Stop
}

public class MediaAction : IAction
{
    public string DisplayName => Command switch
    {
        MediaCommand.PlayPause => "Media: Play / Pause",
        MediaCommand.NextTrack => "Media: Next Track",
        MediaCommand.PrevTrack => "Media: Previous Track",
        MediaCommand.VolumeUp => "Media: Volume Up (+2%)",
        MediaCommand.VolumeDown => "Media: Volume Down (-2%)",
        MediaCommand.Mute => "Media: Mute / Unmute",
        MediaCommand.Stop => "Media: Stop",
        _ => $"Media: {Command}"
    };

    public string Description => $"Controls media: {DisplayName}";
    public ActionType Type => ActionType.Media;

    public MediaCommand Command { get; set; }

    public Task ExecuteAsync(CancellationToken cancellationToken = default)
    {
        var vk = Command switch
        {
            MediaCommand.PlayPause => VirtualKeyCode.MediaPlayPause,
            MediaCommand.NextTrack => VirtualKeyCode.MediaNextTrack,
            MediaCommand.PrevTrack => VirtualKeyCode.MediaPrevTrack,
            MediaCommand.VolumeUp => VirtualKeyCode.VolumeUp,
            MediaCommand.VolumeDown => VirtualKeyCode.VolumeDown,
            MediaCommand.Mute => VirtualKeyCode.VolumeMute,
            MediaCommand.Stop => VirtualKeyCode.MediaStop,
            _ => VirtualKeyCode.None
        };

        if (vk != VirtualKeyCode.None)
        {
            InputSimulator.SendVirtualKey(vk);
        }

        return Task.CompletedTask;
    }
}
