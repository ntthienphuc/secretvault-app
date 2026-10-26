#define MyAppVersion "2.3.0"
[Setup]
AppId=SecretVaultClientV2
AppName=SecretVault Client
AppVersion={#MyAppVersion}
AppPublisher=SecretVault Academic Project
DefaultDirName={localappdata}\Programs\SecretVaultClient
DefaultGroupName=SecretVault Client
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir=..\release
OutputBaseFilename=SecretVault-Client-Setup-{#MyAppVersion}-x64
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
UninstallDisplayIcon={app}\SecretVaultClient.exe
CloseApplications=no
DisableProgramGroupPage=yes
SetupLogging=yes

[Tasks]
Name: "desktopicon"; Description: "Create Client desktop shortcut"; GroupDescription: "Shortcuts:"

[Files]
Source: "..\dist\SecretVaultClient\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\docs\HOST_CLIENT_INSTALL.md"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\SecretVault Client"; Filename: "{app}\SecretVaultClient.exe"
Name: "{autoprograms}\SecretVault Client - Connection settings"; Filename: "{app}\SecretVaultClient.exe"; Parameters: "--show-setup"
Name: "{autodesktop}\SecretVault Client"; Filename: "{app}\SecretVaultClient.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\SecretVaultClient.exe"; Description: "Open SecretVault Client"; Flags: nowait postinstall skipifsilent
