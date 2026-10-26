"""Install the actual Setup.exe into an isolated QA folder and probe its runtime."""

import hashlib
import json
import os
import shutil
import sqlite3
import subprocess
import sys
import time
import urllib.request
import zipfile
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
INSTALLER = ROOT / "release" / "SecretVault-Setup-2.0.0-x64.exe"
TARGET = (ROOT / "audit" / "installer-test").resolve()
RUNTIME = ROOT / "audit" / "installer-runtime"
assert TARGET.is_relative_to(ROOT / "audit")
assert not TARGET.exists(), "Refuse to overwrite an existing QA installation"
assert INSTALLER.is_file()


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def wait_health(port, process):
    deadline = time.monotonic() + 20
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise RuntimeError("Packaged executable exited: " + str(process.returncode))
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/health", timeout=1) as response:
                return json.load(response)
        except OSError:
            time.sleep(0.25)
    raise RuntimeError("Packaged server did not start")


def stop(process):
    if process.poll() is None:
        process.terminate()
        process.wait(timeout=15)


checks = []
install = subprocess.run([
    str(INSTALLER), "/VERYSILENT", "/SUPPRESSMSGBOXES", "/NORESTART", "/SP-", "/NOICONS",
    "/DIR=" + str(TARGET), "/LOG=" + str(ROOT / "audit" / "installer-install.log"),
], timeout=90)
assert install.returncode == 0, "Installer failed"
exe = TARGET / "SecretVault.exe"
assert exe.is_file()
checks.append("Actual Setup.exe installed successfully without admin")

assets = ["index.html", "styles.css", "favicon.svg", "src/app.js", "src/api.js", "src/crypto.js", "src/view.js"]
for name in assets:
    assert sha(ROOT / "public" / name) == sha(TARGET / "_internal" / "public" / name), "Stale installed asset: " + name
assert not (TARGET / "_internal" / "public" / "src" / "lab.js").exists()
assert not list(TARGET.rglob("*.db"))
assert (TARGET / "_internal" / "python311.dll").is_file()
assert (TARGET / "_internal" / "_tkinter.pyd").is_file()
checks.append("Installed assets exactly match current source; no lab/test database bundled")

# Exclude installed Python from PATH only in the packaged app's child process.
environment = os.environ.copy()
environment["PATH"] = str(Path(os.environ["SystemRoot"]) / "System32")
process = subprocess.Popen([str(exe), "--headless", "--no-browser", "--port", "8788", "--data-dir", str(RUNTIME)], env=environment)
try:
    health = wait_health(8788, process)
    assert health["version"] == "2.0.0"
    checks.append("Bundled Python server runs with system Python absent from PATH")
    test_env = os.environ.copy()
    test_env["SV_TEST_URL"] = "http://127.0.0.1:8788"
    tests = subprocess.run(["node", "tests/integration.mjs"], cwd=ROOT, env=test_env, timeout=120, capture_output=True, text=True, encoding="utf-8")
    (ROOT / "audit" / "installed-integration.log").write_text(tests.stdout + tests.stderr, encoding="utf-8")
    assert tests.returncode == 0, tests.stdout[-2000:] + tests.stderr[-2000:]
    shutil.copy2(ROOT / "audit" / "integration-results.json", ROOT / "audit" / "installed-integration-results.json")
    checks.append("Full HTTP and cryptographic integration suite passed against installed executable")
finally:
    stop(process)

db = sqlite3.connect(RUNTIME / "vault-v2.db")
assert db.execute("PRAGMA integrity_check").fetchone()[0] == "ok"
db.close()
checks.append("SQLite persistence remains valid after packaged server restart boundary")

# Exercise the actual Tk launcher path as well as headless hosting.
gui = subprocess.Popen([str(exe), "--no-browser", "--port", "8789", "--data-dir", str(ROOT / "audit" / "installer-gui")], env=environment)
try:
    health = wait_health(8789, gui)
    time.sleep(1)
    assert gui.poll() is None
    checks.append("Installed desktop launcher opens and serves HTTP with bundled Tcl/Tk")
finally:
    stop(gui)

uninstall = subprocess.run([str(TARGET / "unins000.exe"), "/VERYSILENT", "/SUPPRESSMSGBOXES", "/NORESTART"], timeout=60)
assert uninstall.returncode == 0
assert not exe.exists()
checks.append("QA installation uninstalls; isolated runtime data remains separate")

report = {
    "timestamp": datetime.now(timezone.utc).isoformat(), "installer": INSTALLER.name,
    "sha256": sha(INSTALLER), "bytes": INSTALLER.stat().st_size,
    "checks": checks, "passed": len(checks),
    "limitations": ["Desktop launcher startup probed; native UI automation was unavailable", "No public deployment or two-physical-PC network test"],
}
(ROOT / "audit" / "installer-results.json").write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
print(json.dumps(report, indent=2, ensure_ascii=False))
