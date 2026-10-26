#define MyAppName "SecretVault"
#define MyAppVersion "2.1.0"
#define MyAppExeName "SecretVault.exe"

[Setup]
AppId=SecretVaultAcademicV2
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher=SecretVault Academic Project
DefaultDirName={localappdata}\Programs\SecretVault
DefaultGroupName=SecretVault
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir=..\release
OutputBaseFilename=SecretVault-Setup-2.1.0-x64
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
UninstallDisplayIcon={app}\{#MyAppExeName}
CloseApplications=no
DisableProgramGroupPage=yes
SetupLogging=yes

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Shortcuts:"; Flags: unchecked

[Files]
Source: "..\dist\SecretVault\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\README.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\docs\HUONG_DAN_SU_DUNG.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\docs\DOI_CHIEU_SLIDE.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\docs\UI_DESIGN.md"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\SecretVault"; Filename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\SecretVault"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Open SecretVault"; Flags: nowait postinstall skipifsilent
