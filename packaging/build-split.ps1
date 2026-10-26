param([string]$HostDataDirectory = (Join-Path $env:LOCALAPPDATA 'SecretVault\v2'))
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
$pythonPath = Join-Path $projectRoot '.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $pythonPath)) { throw 'Create the Python 3.11 build environment first.' }
& $pythonPath 'packaging\prepare_client.py' --host-data $HostDataDirectory
if ($LASTEXITCODE -ne 0) { throw 'Client bootstrap preparation failed' }
& $pythonPath -m PyInstaller --noconfirm --onedir --windowed --name SecretVaultHost --add-data 'public;public' --collect-all cryptography host_app.py
if ($LASTEXITCODE -ne 0) { throw 'Host build failed' }
& $pythonPath -m PyInstaller --noconfirm --onedir --windowed --name SecretVaultClient --add-data 'packaging/client-bootstrap;bootstrap' client_app.py
if ($LASTEXITCODE -ne 0) { throw 'Client build failed' }
$compiler = Join-Path ${env:ProgramFiles(x86)} 'Inno Setup 6\ISCC.exe'
if (-not (Test-Path -LiteralPath $compiler)) { throw 'Inno Setup 6 is required.' }
foreach ($role in @('host','client')) {
    & $compiler ('packaging\' + $role + '.iss')
    if ($LASTEXITCODE -ne 0) { throw ('Installer build failed: ' + $role) }
}
Get-FileHash -Algorithm SHA256 -LiteralPath 'release\SecretVault-Host-Setup-2.3.0-x64.exe','release\SecretVault-Client-Setup-2.3.0-x64.exe'
