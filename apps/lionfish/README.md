# 🦁 Lionfish

**USB Keypad Macro Interceptor & Browser Automator for Windows**

Lionfish intercepts input from secondary USB keypads and lets you assign custom shortcuts, macros, browser automations, and Google Docs highlighters — without interfering with your main keyboard.

---

## Features

- 🎯 **Device-specific interception** — Only captures input from your registered macro pads
- 🛡️ **Master keyboard protection** — Your primary keyboard is always protected
- ⌨️ **Key mapping** — Assign shortcuts, text snippets, media controls, and app launchers
- 🎨 **Google Docs Highlighting** — Dedicated highlighters for classwork (Yellow, Blue, Green, Cyan, Magenta, etc.)
- 🔄 **Automatic Profile Switching** — Instantly (0-2ms, 0% CPU) switches profiles when your target apps (e.g. Opera, Chrome, Excel) gain focus
- 🖥️ **On-Screen Display (OSD)** — Floating translucent HUD showing the active profile and last button pressed; never steals keyboard focus
- 🌐 **Browser Companion Extension** — Automate web actions directly from macro keys
- 🔄 **Macros** — Record and playback keystroke sequences with natural timing
- 📋 **Profiles** — Switch between different key configurations
- 🔧 **System tray** — Runs quietly in the background with quick profile switching and 1-click OSD toggle
- 🚨 **Safety kill switch** — Press `Left Ctrl + Right Ctrl` to instantly disable all interception

---

## Requirements

- **Operating System:** Windows 10 (1607+) or Windows 11
- **Runtime:** .NET 10 Runtime (or run the self-contained single-file `.exe`)
- **Driver:** Interception driver (installed via included tool)
- **Hardware:** Any USB keypad or secondary keyboard

---

## Driver Installation & What to Expect

Lionfish uses the low-level Windows kernel driver [Interception](https://github.com/oblitum/Interception) to distinguish between physical keyboards.

### Does the Driver Install Warn the User?
**Yes.** Because the driver installs into the Windows kernel input stack:
1. **UAC Elevation Prompt:** Windows will show a User Account Control prompt asking: *"Do you want to allow this app to make changes to your device?"* You must click **Yes**.
2. **System Reboot Required:** Windows requires **one computer restart** after installing the driver before keyboard interception becomes active.
3. **Safety First:** If only one keyboard is connected, Lionfish automatically protects it so you never lock yourself out. The emergency kill switch (`Left Ctrl + Right Ctrl`) stops interception instantly at any time.

### How to Install/Uninstall the Driver:
You can manage the driver directly inside the app under **Settings > Driver**, or via PowerShell (Run as Administrator):
```powershell
# Check driver status
.\tools\manage-driver.ps1 -Action status

# Install driver (requires Admin + 1 system reboot)
.\tools\manage-driver.ps1 -Action install

# Cleanly uninstall driver
.\tools\manage-driver.ps1 -Action uninstall
```

---

## Windows SmartScreen & Self-Signed Certificates

When running an executable compiled directly on your machine (or downloaded without an expensive $300/yr corporate code signing certificate), Windows Defender SmartScreen / Smart App Control may display a notification: *"Windows protected your PC / Unrecognized app"*.

You have two simple ways to handle this:

### Option 1: Quick Run (No setup needed)
1. Double-click `Lionfish.exe` or `Launch Lionfish.cmd`.
2. When the blue SmartScreen window appears, click **"More info"**.
3. Click **"Run anyway"**.
*(Windows will remember your choice and won't ask again for this file).*

### Option 2: Permanent Trust via Local Certificate (Zero Warnings)
To completely prevent SmartScreen prompts for all builds on your PC:
1. Double-click the included certificate file: `LionfishDevCert.cer`.
2. Click **Install Certificate...**
3. Select **Current User** and click **Next**.
4. Choose **"Place all certificates in the following store"**, click **Browse...**, and choose **"Trusted Root Certification Authorities"** -> click **OK**.
5. Click **Next** -> **Finish** -> click **Yes** on the Windows confirmation.
*(Once installed, Windows recognizes the executable as fully verified and trusted).*

---

## Installation & Uninstallation

Lionfish provides a complete Windows application experience, with two installation and uninstallation methods:

### 1. Windows Setup Wizard (`Lionfish-Setup-1.0.0.exe`)
Download and run the single-file installer from the `dist/` folder:
- **Guided Setup:** Standard Windows installer with license acceptance, desktop shortcut option, and certificate trust.
- **Windows Integration:** Registers in Windows Settings → **Installed Apps** (and Control Panel → Programs and Features) with its lion icon and version.
- **Two Uninstall Modes:** When uninstalling through Windows Settings, the uninstaller asks:
  - **Uninstall & Retain Data (Recommended):** Removes the application binaries and shortcuts, but preserves `%APPDATA%\Lionfish` so your custom key mappings and profiles are ready if you reinstall.
  - **Complete Clean Uninstall:** Completely deletes all configuration files, profiles, shortcuts, and prompts to uninstall the kernel driver.

### 2. Scripted PowerShell Installation & Uninstallation
For developers, portable use, or automated setups without running the wizard:

```powershell
# Install application and register in Windows Settings
.\installer\Install-Lionfish.ps1

# Install and automatically trigger driver setup
.\installer\Install-Lionfish.ps1 -InstallDriver -TrustCertificate

# Interactive uninstaller (displays GUI choice: Retain Data vs Complete Wipe)
.\installer\Uninstall-Lionfish.ps1

# Silent / automated uninstall preserving your profiles
.\installer\Uninstall-Lionfish.ps1 -Mode RetainData

# Complete clean removal of app, profiles, and driver
.\installer\Uninstall-Lionfish.ps1 -Mode FullClean -UninstallDriver
```

---

## Quick Start

### 1. Launch Lionfish
- Double-click the **`Lionfish`** shortcut on your Desktop, or
- Open **Lionfish** from your Windows Start Menu, or
- Run `Launch Lionfish.cmd` / `.\run.ps1`.

### 2. Configure Your Keypad
1. Plug in your USB keypad.
2. In Lionfish, go to the **Devices** tab.
3. Click **🎯 Identify Device** and press any key on your keypad or keyboard.
4. Set your USB keypad as **Macro Pad**, and verify your main keyboard is marked **Master Keyboard**.
5. Switch to the **Key Map** tab and assign actions to your keypad keys!

---

## Browser Companion Extension (Google Docs & Web Actions)

For browser-based actions like Google Docs highlighting:
1. Open your browser's extension page (`opera://extensions` or `chrome://extensions`).
2. Enable **Developer mode** (toggle in the top-right).
3. Click **"Load unpacked"** and select the `apps/lionfish/extension/` folder.
4. Lionfish connects to the extension over a local WebSocket (`127.0.0.1:48123`) to trigger formatting, highlighting, and web macros directly.

---

## License

This project is licensed under the **[MIT License](LICENSE)**.

### Third-Party Notices & Acknowledgements
Lionfish is built upon and inspired by excellent open-source projects:
- **[Docs Hotkey](https://github.com/ZackMurry/docs-hotkey)** by Zack Murry (MIT License) — Inspiring browser-side Google Docs DOM automation workflows.
- **[InputInterceptor](https://github.com/oblitum/Interception)** by oblitum (MIT License) — .NET wrapper for the Interception driver.
- **[Interception](https://github.com/oblitum/Interception)** by Francisco Lopez (LGPLv3 / Commercial) — Windows kernel input interception driver.
- **[CommunityToolkit.Mvvm](https://github.com/CommunityToolkit/dotnet)** by Microsoft (MIT License) — MVVM framework.
- **[H.NotifyIcon.Wpf](https://github.com/HavenDV/H.NotifyIcon)** by HavenDV (MIT License) — Windows System Tray integration.

See **[THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md)** for full licenses and copyright texts.
