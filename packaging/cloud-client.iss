#define MyAppVersion "3.0.0"
[Setup]
AppId=SecretVaultOnlineV3
AppName=SecretVault Online
AppVersion={#MyAppVersion}
AppPublisher=SecretVault
DefaultDirName={localappdata}\Programs\SecretVaultOnline
DefaultGroupName=SecretVault Online
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir=..\release
OutputBaseFilename=SecretVault-Online-Setup-{#MyAppVersion}-x64
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
UninstallDisplayIcon={app}\SecretVaultOnline.exe
CloseApplications=no
DisableProgramGroupPage=yes
SetupLogging=yes

[Tasks]
Name: "desktopicon"; Description: "Create desktop shortcut"; GroupDescription: "Shortcuts:"

[Files]
Source: "..\dist\SecretVaultOnline\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\docs\CLOUD_ONLINE.md"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\SecretVault Online"; Filename: "{app}\SecretVaultOnline.exe"
Name: "{autoprograms}\SecretVault Online - Web"; Filename: "{app}\SecretVaultOnline.exe"; Parameters: "--browser"
Name: "{autodesktop}\SecretVault Online"; Filename: "{app}\SecretVaultOnline.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\SecretVaultOnline.exe"; Description: "Open SecretVault Online"; Flags: nowait postinstall skipifsilent
