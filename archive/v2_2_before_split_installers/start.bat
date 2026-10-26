@echo off
setlocal
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
    py -3.11 -m venv .venv
    if errorlevel 1 goto failed
)
".venv\Scripts\python.exe" -c "import cryptography" >nul 2>&1
if errorlevel 1 (
    ".venv\Scripts\python.exe" -m pip install -r requirements.txt
    if errorlevel 1 goto failed
)
start "" ".venv\Scripts\pythonw.exe" app.py
exit /b 0
:failed
echo Source launch failed. Install Python 3.11 or use release\SecretVault-Setup-2.2.0-x64.exe.
pause
exit /b 1
