#define MyAppVersion "2.3.0"
[Setup]
AppId=SecretVaultHostV2
AppName=SecretVault Host
AppVersion={#MyAppVersion}
AppPublisher=SecretVault Academic Project
DefaultDirName={localappdata}\Programs\SecretVaultHost
DefaultGroupName=SecretVault Host
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir=..\release
OutputBaseFilename=SecretVault-Host-Setup-{#MyAppVersion}-x64
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
UninstallDisplayIcon={app}\SecretVaultHost.exe
CloseApplications=no
DisableProgramGroupPage=yes
SetupLogging=yes

[Tasks]
Name: "desktopicon"; Description: "Create Host desktop shortcut"; GroupDescription: "Shortcuts:"
Name: "startup"; Description: "Start the Host after signing in to Windows"; GroupDescription: "Host:"; Flags: unchecked

[Files]
Source: "..\dist\SecretVaultHost\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\docs\HOST_CLIENT_INSTALL.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\docs\LAN_WINDOWS.md"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\SecretVault Host"; Filename: "{app}\SecretVaultHost.exe"; Parameters: "--lan-host"
Name: "{autoprograms}\SecretVault Host - Stop"; Filename: "{app}\SecretVaultHost.exe"; Parameters: "--stop-host"
Name: "{autodesktop}\SecretVault Host"; Filename: "{app}\SecretVaultHost.exe"; Parameters: "--lan-host"; Tasks: desktopicon
Name: "{userstartup}\SecretVault Host"; Filename: "{app}\SecretVaultHost.exe"; Parameters: "--lan-host --headless --no-browser"; Tasks: startup

[Run]
Filename: "{app}\SecretVaultHost.exe"; Parameters: "--lan-host"; Description: "Open SecretVault Host"; Flags: nowait postinstall skipifsilent
