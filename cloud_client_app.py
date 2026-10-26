"""Windows cloud client: a native Edge WebView2 window using the public HTTPS web app."""
from __future__ import annotations

import argparse
import json
import os
import sys
import traceback
import webbrowser
from pathlib import Path

VERSION = "3.0.0"
WEB_URL = "https://secretvault-online.vercel.app"
API_URL = "https://thienphuc12339-secretvault-api.hf.space"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--browser", action="store_true", help="Open the same workspace in the default browser")
    parser.add_argument("--diagnose", action="store_true", help="Check public endpoints without opening the UI")
    args = parser.parse_args()
    data = Path(os.getenv("LOCALAPPDATA", str(Path.home()))) / "SecretVaultOnline"
    data.mkdir(parents=True, exist_ok=True)
    if args.diagnose:
        import urllib.request
        checks = {"version": VERSION, "web": WEB_URL, "api": API_URL}
        for label, url in (("webStatus", WEB_URL), ("apiStatus", API_URL + "/api/health")):
            with urllib.request.urlopen(url, timeout=90) as response:
                checks[label] = response.status
        (data / "diagnostics.json").write_text(json.dumps(checks, indent=2), encoding="utf8")
        return 0
    if args.browser:
        webbrowser.open(WEB_URL)
        return 0
    try:
        import webview
        webview.settings["ALLOW_DOWNLOADS"] = True
        window = webview.create_window("SecretVault", WEB_URL, width=1280, height=850,
                                       min_size=(760, 610), background_color="#f8f9fc",
                                       text_select=True)

        def loaded():
            # Readiness evidence excludes account information and page content.
            (data / "startup.json").write_text(json.dumps({"version": VERSION, "loaded": True, "url": window.get_current_url(), "renderer": "Edge WebView2"}, indent=2), encoding="utf8")

        window.events.loaded += loaded
        # No local certificate, secret key or server configuration. Downloads use
        # the native save dialog. Sign-in state is cleared when the window closes.
        webview.start(gui="edgechromium", debug=False, private_mode=True, storage_path=str(data / "browser"))
    except Exception:
        (data / "startup-error.log").write_text(traceback.format_exc(), encoding="utf8")
        import tkinter as tk
        from tkinter import messagebox
        root = tk.Tk()
        root.withdraw()
        if messagebox.askyesno("SecretVault", "Chưa mở được cửa sổ ứng dụng. Bạn có thể dùng đầy đủ SecretVault trên Chrome/Edge.\n\nMở bản web ngay?"):
            webbrowser.open(WEB_URL)
        root.destroy()
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
