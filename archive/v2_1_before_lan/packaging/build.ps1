$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
$pythonPath = Join-Path $projectRoot '.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $pythonPath)) {
    py -3.11 -m venv .venv
}
& $pythonPath -m pip install -r requirements-build.txt
if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed' }
& $pythonPath -m PyInstaller --noconfirm --onedir --windowed --name SecretVault --add-data 'public;public' --collect-all cryptography app.py
if ($LASTEXITCODE -ne 0) { throw 'PyInstaller build failed' }
$compilerPath = Join-Path ${env:ProgramFiles(x86)} 'Inno Setup 6\ISCC.exe'
if (-not (Test-Path -LiteralPath $compilerPath)) { throw 'Install Inno Setup 6 to build the Setup.exe installer.' }
& $compilerPath 'packaging\windows.iss'
if ($LASTEXITCODE -ne 0) { throw 'Inno Setup compilation failed' }
Get-FileHash -Algorithm SHA256 -LiteralPath 'release\SecretVault-Setup-2.1.0-x64.exe' | Format-List
