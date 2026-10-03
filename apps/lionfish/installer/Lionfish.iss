; Inno Setup Script for Lionfish
; Modern Windows Application Installer with Data-Retention Uninstaller

#define MyAppName "Lionfish"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "jeffersonwm"
#define MyAppURL "https://github.com/jeffersonwm/lionfish"
#define MyAppExeName "Lionfish.exe"

[Setup]
AppId={{C730A539-7814-4A3C-B972-8C84E91F3EE5}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={localappdata}\Programs\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
LicenseFile=..\LICENSE
OutputDir=..\dist
OutputBaseFilename=Lionfish-Setup-{#MyAppVersion}
SetupIconFile=..\src\Lionfish.App\Assets\icon.ico
UninstallDisplayIcon={app}\{#MyAppExeName}
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
CloseApplications=yes
RestartApplications=no

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: checkedonce
Name: "trustcert"; Description: "Trust Lionfish development certificate (prevents SmartScreen warnings)"; GroupDescription: "Security & Trust:"; Flags: checkedonce
Name: "installdriver"; Description: "Install Interception keyboard filter driver (Requires Administrator prompt & Reboot)"; GroupDescription: "Hardware Driver:"; Flags: checkedonce

[Files]
Source: "..\publish\Lionfish.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\LionfishDevCert.cer"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\LICENSE"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\THIRD_PARTY_LICENSES.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\README.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\tools\*"; DestDir: "{app}\tools"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\extension\*"; DestDir: "{app}\extension"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "Uninstall-Lionfish.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "Uninstall Lionfish.exe"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\{#MyAppName}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{autoprograms}\{#MyAppName}\Uninstall Lionfish"; Filename: "{app}\Uninstall Lionfish.exe"
Name: "{autoprograms}\{#MyAppName}\Lionfish Companion Extension"; Filename: "{app}\extension"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
; Optional certificate installation
Filename: "certutil.exe"; Parameters: "-addstore -user Root ""{app}\LionfishDevCert.cer"""; Tasks: trustcert; Flags: runhidden
Filename: "certutil.exe"; Parameters: "-addstore -user TrustedPublisher ""{app}\LionfishDevCert.cer"""; Tasks: trustcert; Flags: runhidden
; Optional driver installation
Filename: "{app}\{#MyAppExeName}"; Parameters: "--install-driver"; Tasks: installdriver; Flags: waituntilterminated; Description: "Installing Interception keyboard driver..."
; Launch program after setup
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

[Code]
var
  RetainUserData: Boolean;
  UninstallDriverRequested: Boolean;

function InitializeUninstall(): Boolean;
var
  Ans: Integer;
begin
  Result := False;
  RetainUserData := True;
  UninstallDriverRequested := False;

  // ── Dialog 1: Initial uninstall request ────────────────────────────────────
  Ans := MsgBox(
    'Are you sure you want to uninstall Lionfish from your computer?',
    mbConfirmation, MB_YESNO
  );
  if Ans <> IDYES then
  begin
    Exit;
  end;

  // ── Dialog 2: Would you like to keep your data? ───────────────────────────
  Ans := MsgBox(
    'Would you like to keep your saved data?' + #13#10 + #13#10 +
    'Click [YES] to keep your macro profiles, keypad maps, and settings.' + #13#10 +
    '(Recommended if you might reinstall or upgrade Lionfish later).' + #13#10 + #13#10 +
    'Click [NO] to delete all profiles and settings.',
    mbConfirmation, MB_YESNO
  );

  if Ans = IDYES then
  begin
    RetainUserData := True;

    // ── Dialog 3A: Confirmation of uninstall keeping preferences ────────────
    Ans := MsgBox(
      'Lionfish application files and shortcuts will be removed, but your custom profiles and settings will be preserved in %APPDATA%\Lionfish.' + #13#10 + #13#10 +
      'Proceed with uninstallation?',
      mbConfirmation, MB_YESNO
    );
    if Ans <> IDYES then
    begin
      Exit;
    end;
  end
  else
  begin
    RetainUserData := False;

    // ── Dialog 3B: Confirmation of total clean uninstall ────────────────────
    Ans := MsgBox(
      'WARNING: Complete Clean Uninstall' + #13#10 + #13#10 +
      'This will remove Lionfish AND permanently delete all your saved profiles, keypad configurations, and settings.' + #13#10 + #13#10 +
      'Are you sure you want to proceed with a complete uninstall?',
      mbConfirmation, MB_YESNO
    );
    if Ans <> IDYES then
    begin
      Exit;
    end;
  end;

  // ── Dialog 4: Keyboard Driver prompt ─────────────────────────────────────
  Ans := MsgBox(
    'Do you also want to uninstall the Interception keyboard driver?' + #13#10 + #13#10 +
    'Note: Removing the driver requires Administrator privileges and a computer reboot.' + #13#10 + #13#10 +
    '• Click [YES] to uninstall the driver.' + #13#10 +
    '• Click [NO] to keep the driver (recommended if retaining data or using other keypad tools).',
    mbConfirmation, MB_YESNO
  );
  if Ans = IDYES then
  begin
    UninstallDriverRequested := True;
  end;

  Result := True;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  AppDir: String;
  AppDataDir: String;
  ResultCode: Integer;
begin
  // Before deleting binaries, run elevated driver uninstallation if requested
  if CurUninstallStep = usUninstall then
  begin
    if UninstallDriverRequested then
    begin
      AppDir := ExpandConstant('{app}');
      Exec(AppDir + '\Lionfish.exe', '--uninstall-driver', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    end;
  end;

  // After binaries are removed, process data retention
  if CurUninstallStep = usPostUninstall then
  begin
    AppDataDir := ExpandConstant('{userappdata}\Lionfish');

    if not RetainUserData then
    begin
      // Full Clean: remove %APPDATA%\Lionfish completely
      if DirExists(AppDataDir) then
      begin
        DelTree(AppDataDir, True, True, True);
      end;

      // Remove dev certificate
      Exec('certutil.exe', '-delstore -user Root "Lionfish Development"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
      Exec('certutil.exe', '-delstore -user TrustedPublisher "Lionfish Development"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    end;
  end;
end;
