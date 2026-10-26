"""Stop only the exact LAN process recorded by this user's Host instance."""

import ipaddress
import json
import os
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlparse


def stop_background(data_root):
    if os.name != "nt":
        raise ValueError("Use the operating system service manager on this platform.")
    data_root = Path(data_root).resolve()
    metadata = json.loads((data_root / "lan/host-process.json").read_text(encoding="utf-8"))
    process_id = int(metadata["pid"])
    executable = Path(metadata["executable"]).resolve()
    if process_id <= 0 or executable != Path(sys.executable).resolve() or Path(metadata["dataDir"]).resolve() != data_root:
        raise ValueError("Phiên host không thuộc bản ứng dụng/thư mục dữ liệu này.")
    parsed = urlparse(metadata["url"])
    address = ipaddress.ip_address(parsed.hostname)
    port = parsed.port
    if parsed.scheme != "https" or address.version != 4 or not address.is_private or not port:
        raise ValueError("Định danh host không hợp lệ.")
    quoted_executable = str(executable).replace("'", "''")
    script = f"""$ErrorActionPreference='Stop'
    $hostCandidate=Get-CimInstance Win32_Process -Filter 'ProcessId={process_id}'
    $hostSocket=Get-NetTCPConnection -State Listen -LocalAddress '{address}' -LocalPort {int(port)} -ErrorAction SilentlyContinue
    if (-not $hostCandidate -or $hostCandidate.ExecutablePath -ne '{quoted_executable}' -or $hostCandidate.CommandLine -notlike '*--lan-host*' -or $hostSocket.OwningProcess -notcontains {process_id}) {{ throw 'Process ownership mismatch; no process was stopped.' }}
    Stop-Process -Id {process_id} -ErrorAction Stop
    """
    powershell = Path(os.environ["SystemRoot"]) / "System32/WindowsPowerShell/v1.0/powershell.exe"
    result = subprocess.run([str(powershell), "-NoProfile", "-NonInteractive", "-Command", script], capture_output=True, text=True,
                            errors="replace", timeout=20, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    if result.returncode != 0:
        raise ValueError("Không dừng host vì không xác minh được đúng tiến trình. Kiểm tra host đang chạy.")
