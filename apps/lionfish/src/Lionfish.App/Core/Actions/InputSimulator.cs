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
        public MOUSEINPUT mi;

        [FieldOffset(8)]
        public KEYBDINPUT ki;

        [FieldOffset(8)]
        public HARDWAREINPUT hi;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct MOUSEINPUT
    {
        public int dx;
        public int dy;
        public uint mouseData;
        public uint dwFlags;
        public uint time;
        public IntPtr dwExtraInfo;
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

    [StructLayout(LayoutKind.Sequential)]
    private struct HARDWAREINPUT
    {
        public uint uMsg;
        public ushort wParamL;
        public ushort wParamH;
    }

    [DllImport("user32.dll", SetLastError = true)]
    private static extern uint SendInput(uint nInputs, [In] INPUT[] pInputs, int cbSize);

    [DllImport("user32.dll")]
    private static extern uint MapVirtualKey(uint uCode, uint uMapType);

    public static void SendKeyCombination(VirtualKeyCode key, ModifierKeys modifiers)
    {
        // 1. Modifiers Down
        var modDown = new List<INPUT>();
        if (modifiers.HasFlag(ModifierKeys.Ctrl)) modDown.Add(CreateKeyInput(VirtualKeyCode.Control, false));
        if (modifiers.HasFlag(ModifierKeys.Shift)) modDown.Add(CreateKeyInput(VirtualKeyCode.Shift, false));
        if (modifiers.HasFlag(ModifierKeys.Alt)) modDown.Add(CreateKeyInput(VirtualKeyCode.Alt, false));
        if (modifiers.HasFlag(ModifierKeys.Win)) modDown.Add(CreateKeyInput(VirtualKeyCode.LWin, false));

        if (modDown.Count > 0)
        {
            SendInput((uint)modDown.Count, modDown.ToArray(), Marshal.SizeOf<INPUT>());
            Thread.Sleep(5);
        }

        // 2. Target Key Down & Up
        if (key != VirtualKeyCode.None)
        {
            var keyStroke = new[]
            {
                CreateKeyInput(key, false),
                CreateKeyInput(key, true)
            };
            SendInput((uint)keyStroke.Length, keyStroke, Marshal.SizeOf<INPUT>());
        }

        if (modDown.Count > 0)
        {
            Thread.Sleep(5);
            // 3. Modifiers Up (reverse order)
            var modUp = new List<INPUT>();
            if (modifiers.HasFlag(ModifierKeys.Win)) modUp.Add(CreateKeyInput(VirtualKeyCode.LWin, true));
            if (modifiers.HasFlag(ModifierKeys.Alt)) modUp.Add(CreateKeyInput(VirtualKeyCode.Alt, true));
            if (modifiers.HasFlag(ModifierKeys.Shift)) modUp.Add(CreateKeyInput(VirtualKeyCode.Shift, true));
            if (modifiers.HasFlag(ModifierKeys.Ctrl)) modUp.Add(CreateKeyInput(VirtualKeyCode.Control, true));

            SendInput((uint)modUp.Count, modUp.ToArray(), Marshal.SizeOf<INPUT>());
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

        ushort scanCode = (ushort)MapVirtualKey((uint)key, 0);

        return new INPUT
        {
            type = INPUT_KEYBOARD,
            ki = new KEYBDINPUT
            {
                wVk = (ushort)key,
                wScan = scanCode,
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
