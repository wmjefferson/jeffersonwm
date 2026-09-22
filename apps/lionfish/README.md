# 🦁 Lionfish

**USB Keypad Macro Interceptor for Windows**

Lionfish intercepts input from secondary USB keypads and lets you assign custom shortcuts, macros, and actions — without interfering with your main keyboard.

## Features

- 🎯 **Device-specific interception** — Only captures input from your registered macro pads
- 🛡️ **Master keyboard protection** — Your primary keyboard is always protected
- ⌨️ **Key mapping** — Assign shortcuts, text snippets, media controls, and app launchers
- 🔄 **Macros** — Record and playback keystroke sequences with timing
- 📋 **Profiles** — Switch between different key configurations
- 🔧 **System tray** — Runs quietly in the background with quick profile switching
- 🚨 **Safety kill switch** — Press Left Ctrl + Right Ctrl to instantly disable interception

## Requirements

- Windows 10 (1607+) or Windows 11
- .NET 10 Runtime
- [Interception driver](https://github.com/oblitum/Interception) (installed via included script)
- USB keypad(s)

## Quick Start

### 1. Build
```bash
cd apps/lionfish
dotnet build
```

### 2. Install the Interception Driver
```powershell
# Run as Administrator
.\tools\manage-driver.ps1 -Action install
# Reboot when prompted
```

### 3. Run Lionfish
```powershell
# Using the launcher script (checks if already running, offers restart):
.\run.ps1

# Or directly via dotnet:
dotnet run --project src/Lionfish.App
```

### 4. First-Time Setup
1. Plug in your USB keypads
2. Go to the **Devices** tab
3. Click **🎯 Identify Device** and press any key on your keypad or laptop keyboard to identify it!
4. Confirm your laptop keyboard is marked **Master Keyboard** (protected)
5. Set your USB keypad as **Macro Pad**
6. Go to the **Key Map** tab to assign macros and shortcuts!

## Project Structure

```
apps/lionfish/
├── run.ps1                     # Launcher script (checks active instances)
├── src/
│   └── Lionfish.App/           # Unified WPF desktop app & interception engine
└── tools/
    └── manage-driver.ps1       # Driver install/uninstall script
```

## Safety

- **Kill switch**: Left Ctrl + Right Ctrl simultaneously stops all interception
- **Master keyboard**: Your primary keyboard is never intercepted
- **Startup delay**: 3-second grace period before interception activates
- **Watchdog**: Auto-disables if the capture loop becomes unresponsive

## Driver Management

```powershell
# Check driver status
.\tools\manage-driver.ps1 -Action status

# Install driver (requires admin + reboot)
.\tools\manage-driver.ps1 -Action install

# Uninstall driver (requires admin + reboot)
.\tools\manage-driver.ps1 -Action uninstall
```

## Tech Stack

- C# 12 / .NET 10
- WPF (Windows Presentation Foundation)
- Interception driver via InputInterceptor
- CommunityToolkit.Mvvm
- H.NotifyIcon.Wpf

## License

Private — Part of the jeffersonwm monorepo.
