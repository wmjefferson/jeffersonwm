using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace Lionfish.Core.Actions;

/// <summary>
/// One step in a sequence — either a keystroke or typed text.
/// All go through Win32 SendInput → isTrusted in Chrome → works in Google Docs.
/// </summary>
public class SequenceStep
{
    public VirtualKeyCode Key { get; set; }
    public ModifierKeys Modifiers { get; set; } = ModifierKeys.None;
    public int DelayAfterMs { get; set; } = 80;

    /// <summary>
    /// If non-null, type this text instead of sending a key.
    /// Uses KEYEVENTF_UNICODE so every character is trusted by Chrome.
    /// </summary>
    public string? Text { get; set; }
}

public class SequenceAction : IAction
{
    public string DisplayName => $"Sequence: {string.Join(" → ", Steps.ConvertAll(s =>
        s.Text != null ? $"\"{s.Text}\"" : s.Key.ToString()))}";
    public string Description => DisplayName;
    public ActionType Type => ActionType.Sequence;

    public List<SequenceStep> Steps { get; set; } = new();

    /// <summary>
    /// If non-null, indicates this action is targeting a Google Docs highlight color.
    /// When the Lionfish Companion Extension is connected, this color is applied via browser automation.
    /// </summary>
    public string? DocsHighlightColor { get; set; }

    public async Task ExecuteAsync(CancellationToken cancellationToken = default)
    {
        // 1. If this is a Google Docs highlight and the browser extension is connected, use it!
        if (!string.IsNullOrEmpty(DocsHighlightColor) && Lionfish.Core.Web.BrowserBridgeService.Instance?.IsConnected == true)
        {
            bool handled = await Lionfish.Core.Web.BrowserBridgeService.Instance.ExecuteDocsHighlightAsync(DocsHighlightColor, cancellationToken).ConfigureAwait(false);
            if (handled) return;
        }

        // 2. Otherwise execute standard keystroke sequence (fallback)
        foreach (var step in Steps)
        {
            if (cancellationToken.IsCancellationRequested) break;

            if (step.Text != null)
            {
                // Type each character as a Unicode keystroke (trusted by Chrome)
                await InputSimulator.SendTextAsync(step.Text, 30, cancellationToken).ConfigureAwait(false);
            }
            else
            {
                InputSimulator.SendKeyCombination(step.Key, step.Modifiers);
            }

            if (step.DelayAfterMs > 0)
                await Task.Delay(step.DelayAfterMs, cancellationToken).ConfigureAwait(false);
        }
    }

    // ── Factory helpers ─────────────────────────────────────────────────────

    /// <summary>
    /// Google Docs: highlight selected text with the specified color.
    /// Routes through Lionfish Companion Extension if connected; otherwise uses Alt+/ menu search.
    /// </summary>
    public static SequenceAction GoogleDocsHighlightColor(string colorName, int delayMs = 150)
    {
        var seq = new SequenceAction
        {
            DocsHighlightColor = colorName
        };

        // 1. Alt+/ -> opens "Search the menus" search box
        //    VirtualKeyCode.OemQuestion = 0xBF = the / key on US keyboards
        seq.Steps.Add(new SequenceStep
        {
            Key = VirtualKeyCode.OemQuestion,
            Modifiers = ModifierKeys.Alt,
            DelayAfterMs = delayMs
        });

        // 2. Type "highlight" to filter menu search results
        seq.Steps.Add(new SequenceStep
        {
            Text = "highlight",
            DelayAfterMs = delayMs + 100   // extra wait for results to appear
        });

        // 3. Down -> select the first result ("Text highlighting" or "Highlight color")
        seq.Steps.Add(new SequenceStep { Key = VirtualKeyCode.Down, DelayAfterMs = delayMs });

        // 4. Enter -> applies the active highlight color cleanly without moving cursor or creating line breaks
        seq.Steps.Add(new SequenceStep { Key = VirtualKeyCode.Enter, DelayAfterMs = 0 });

        return seq;
    }

    public static SequenceAction GoogleDocsHighlightColor(int colorIndex = 1, int delayMs = 150)
    {
        return GoogleDocsHighlightColor(GoogleDocsColorFromIndex(colorIndex), delayMs);
    }

    private static string GoogleDocsColorFromIndex(int index) => index switch
    {
        0 => "None",
        1 => "Red",
        3 => "Orange",
        4 => "Yellow",
        5 => "Green",
        6 => "Cyan",
        8 => "Blue",
        9 => "Purple",
        10 => "Magenta",
        _ => "Yellow"
    };
}

