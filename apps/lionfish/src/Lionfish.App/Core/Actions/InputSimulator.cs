using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;

namespace Lionfish.Core.Actions;

public static class InputSimulator
{
    private const int INPUT_KEYBOARD = 1;
    private const uint KEYEVENTF_EXTENDEDKEY = 0x0001;
    private const uint KEYEVENTF_KEYUP = 0x0002;
    private const uint KEYEVENTF_UNICODE = 0x0004;

    [StructLayout(LayoutKind.Explicit)]
    private struct INPUT
    {
        [FieldOffset(0)]
        public uint type;

        [FieldOffset(8)]
        public KEYBDINPUT ki;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct KEYBDINPUT
    {
        public ushort wVk;
        public ushort wScan;
        public uint dwFlags;
        public uint time;
        public IntPtr dwExtraInfo;
    }

    [DllImport("user32.dll", SetLastError = true)]
    private static extern uint SendInput(uint nInputs, [In] INPUT[] pInputs, int cbSize);

    public static void SendKeyCombination(VirtualKeyCode key, ModifierKeys modifiers)
    {
        var inputs = new List<INPUT>();

        // 1. Modifiers Down
        if (modifiers.HasFlag(ModifierKeys.Ctrl)) inputs.Add(CreateKeyInput(VirtualKeyCode.Control, false));
        if (modifiers.HasFlag(ModifierKeys.Shift)) inputs.Add(CreateKeyInput(VirtualKeyCode.Shift, false));
        if (modifiers.HasFlag(ModifierKeys.Alt)) inputs.Add(CreateKeyInput(VirtualKeyCode.Alt, false));
        if (modifiers.HasFlag(ModifierKeys.Win)) inputs.Add(CreateKeyInput(VirtualKeyCode.LWin, false));

        // 2. Target Key Down & Up
        if (key != VirtualKeyCode.None)
        {
            inputs.Add(CreateKeyInput(key, false));
            inputs.Add(CreateKeyInput(key, true));
        }

        // 3. Modifiers Up (reverse order)
        if (modifiers.HasFlag(ModifierKeys.Win)) inputs.Add(CreateKeyInput(VirtualKeyCode.LWin, true));
        if (modifiers.HasFlag(ModifierKeys.Alt)) inputs.Add(CreateKeyInput(VirtualKeyCode.Alt, true));
        if (modifiers.HasFlag(ModifierKeys.Shift)) inputs.Add(CreateKeyInput(VirtualKeyCode.Shift, true));
        if (modifiers.HasFlag(ModifierKeys.Ctrl)) inputs.Add(CreateKeyInput(VirtualKeyCode.Control, true));

        if (inputs.Count > 0)
        {
            SendInput((uint)inputs.Count, inputs.ToArray(), Marshal.SizeOf<INPUT>());
        }
    }

    public static void SendVirtualKey(VirtualKeyCode key)
    {
        var inputs = new[]
        {
            CreateKeyInput(key, false),
            CreateKeyInput(key, true)
        };
        SendInput((uint)inputs.Length, inputs, Marshal.SizeOf<INPUT>());
    }

    public static void SendKeyDown(VirtualKeyCode key)
    {
        var inputs = new[] { CreateKeyInput(key, false) };
        SendInput((uint)inputs.Length, inputs, Marshal.SizeOf<INPUT>());
    }

    public static void SendKeyUp(VirtualKeyCode key)
    {
        var inputs = new[] { CreateKeyInput(key, true) };
        SendInput((uint)inputs.Length, inputs, Marshal.SizeOf<INPUT>());
    }

    public static void SendCharacter(char c)
    {
        var inputs = new[]
        {
            new INPUT
            {
                type = INPUT_KEYBOARD,
                ki = new KEYBDINPUT
                {
                    wVk = 0,
                    wScan = c,
                    dwFlags = KEYEVENTF_UNICODE,
                    time = 0,
                    dwExtraInfo = IntPtr.Zero
                }
            },
            new INPUT
            {
                type = INPUT_KEYBOARD,
                ki = new KEYBDINPUT
                {
                    wVk = 0,
                    wScan = c,
                    dwFlags = KEYEVENTF_UNICODE | KEYEVENTF_KEYUP,
                    time = 0,
                    dwExtraInfo = IntPtr.Zero
                }
            }
        };
        SendInput((uint)inputs.Length, inputs, Marshal.SizeOf<INPUT>());
    }

    public static async Task SendTextAsync(string text, int delayBetweenCharsMs = 0, CancellationToken ct = default)
    {
        foreach (char c in text)
        {
            if (ct.IsCancellationRequested) break;
            SendCharacter(c);
            if (delayBetweenCharsMs > 0)
            {
                await Task.Delay(delayBetweenCharsMs, ct);
            }
        }
    }

    private static INPUT CreateKeyInput(VirtualKeyCode key, bool isKeyUp)
    {
        uint flags = 0;
        if (isKeyUp) flags |= KEYEVENTF_KEYUP;

        if (IsExtendedKey(key))
        {
            flags |= KEYEVENTF_EXTENDEDKEY;
        }

        return new INPUT
        {
            type = INPUT_KEYBOARD,
            ki = new KEYBDINPUT
            {
                wVk = (ushort)key,
                wScan = 0,
                dwFlags = flags,
                time = 0,
                dwExtraInfo = IntPtr.Zero
            }
        };
    }

    private static bool IsExtendedKey(VirtualKeyCode key) => key switch
    {
        VirtualKeyCode.LWin or VirtualKeyCode.RWin or VirtualKeyCode.Apps or
        VirtualKeyCode.Insert or VirtualKeyCode.Delete or
        VirtualKeyCode.Home or VirtualKeyCode.End or
        VirtualKeyCode.PageUp or VirtualKeyCode.PageDown or
        VirtualKeyCode.Left or VirtualKeyCode.Right or
        VirtualKeyCode.Up or VirtualKeyCode.Down or
        VirtualKeyCode.NumLock or VirtualKeyCode.PrintScreen or
        VirtualKeyCode.Divide or
        VirtualKeyCode.VolumeMute or VirtualKeyCode.VolumeDown or VirtualKeyCode.VolumeUp or
        VirtualKeyCode.MediaNextTrack or VirtualKeyCode.MediaPrevTrack or
        VirtualKeyCode.MediaStop or VirtualKeyCode.MediaPlayPause => true,
        _ => false
    };
}
