"""Windows launcher and command-line hosting. The installer bundles Python."""

from __future__ import annotations

import argparse
import json
import os
import ssl
import sys
import threading
import urllib.request
import webbrowser
from pathlib import Path
from urllib.parse import urlparse

from . import VERSION
from .server import VaultHTTPServer
from .store import Store


def default_data():
    if os.name == "nt":
        return Path(os.environ.get("LOCALAPPDATA", Path.home())) / "SecretVault" / "v2"
    return Path.home() / ".local" / "share" / "secretvault-v2"


def arguments():
    parser = argparse.ArgumentParser(description="SecretVault 2 encrypted workspace")
    parser.add_argument("--headless", action="store_true", help="Run without the Windows launcher")
    parser.add_argument("--no-browser", action="store_true")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--data-dir", type=Path, default=Path(os.environ.get("SECRET_VAULT_DATA", default_data())))
    parser.add_argument("--tls-cert", type=Path)
    parser.add_argument("--tls-key", type=Path)
    parser.add_argument("--behind-proxy", action="store_true", help="Require an HTTPS reverse proxy on loopback")
    return parser.parse_args()


def public_dir():
    if getattr(sys, "frozen", False):
        return Path(sys._MEIPASS) / "public"
    return Path(__file__).resolve().parent.parent / "public"


def main():
    args = arguments()
    args.data_dir.mkdir(parents=True, exist_ok=True)
    if sys.stdout is None:
        log = open(args.data_dir / "secretvault.log", "a", encoding="utf-8", buffering=1)
        sys.stdout = log
        sys.stderr = log
    if args.host not in ("127.0.0.1", "localhost", "::1") and not args.tls_cert:
        raise SystemExit("Remote host requires --tls-cert and --tls-key. For Caddy use --host 127.0.0.1 --behind-proxy.")
    if args.behind_proxy and args.host not in ("127.0.0.1", "localhost", "::1"):
        raise SystemExit("Reverse proxy mode must bind to loopback")
    store = Store(args.data_dir)
    scheme = "https" if args.tls_cert else "http"
    local_host = "127.0.0.1" if args.host in ("0.0.0.0", "localhost") else args.host
    url = f"{scheme}://{local_host}:{args.port}"
    server = None
    try:
        server = VaultHTTPServer((args.host, args.port), store, public_dir(), secure=bool(args.tls_cert), behind_proxy=args.behind_proxy)
        if args.tls_cert:
            context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
            context.minimum_version = ssl.TLSVersion.TLSv1_2
            context.load_cert_chain(str(args.tls_cert), str(args.tls_key))
            server.socket = context.wrap_socket(server.socket, server_side=True)
    except OSError:
        # Never terminate another process to take its port.
        try:
            with urllib.request.urlopen(url + "/api/health", timeout=2) as response:
                health = json.load(response)
            if health.get("app") != "SecretVault" or health.get("version") != VERSION:
                raise ValueError("Port is occupied by a different application")
        except Exception as error:
            if not args.headless:
                import tkinter.messagebox
                tkinter.messagebox.showerror("SecretVault", "Cổng đang được ứng dụng khác sử dụng.\nChạy với --port 8766 hoặc tắt phiên cũ.\n" + str(error))
            raise SystemExit("Port occupied; try --port 8766")
    if server:
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
    print(f"SecretVault {VERSION}: {url} | data: {store.root}", flush=True)
    if args.headless:
        if not args.no_browser and not args.behind_proxy:
            webbrowser.open(url)
        if not server:
            return
        try:
            thread.join()
        except KeyboardInterrupt:
            server.shutdown()
            server.server_close()
        return
    launcher(store, server, url, args.no_browser)


def launcher(store, server, url, no_browser):
    import tkinter as tk
    from tkinter import filedialog, messagebox

    window = tk.Tk()
    window.title("SecretVault · Máy chủ & kết nối")
    window.geometry("640x535")
    window.minsize(600, 510)
    window.configure(bg="#0b1020")
    fg = "#edf0ff"
    muted = "#a7b2ce"

    def label(value, size=10, color=muted):
        widget = tk.Label(window, text=value, fg=color, bg="#0b1020", font=("Segoe UI", size), anchor="w", justify="left")
        widget.pack(fill="x", padx=28, pady=(10, 0))
        return widget

    def button(value, command, primary=False):
        widget = tk.Button(window, text=value, command=command, relief="flat", cursor="hand2",
                           bg="#775ee7" if primary else "#1d2944", fg=fg,
                           activebackground="#8e7af5", activeforeground="white", font=("Segoe UI", 11), pady=9)
        widget.pack(fill="x", padx=28, pady=(10, 0))
        return widget

    label("SecretVault", 25, fg)
    label("Vault mã hóa · DH live · ElGamal offline", 11)
    status = label("● Máy chủ cục bộ đang chạy" if server else "● Đang dùng máy chủ SecretVault đã mở", 12, "#6ee6cb")
    address = tk.Entry(window, relief="flat", bg="#141f36", fg=fg, font=("Consolas", 12))
    address.insert(0, url)
    address.configure(state="readonly", readonlybackground="#141f36")
    address.pack(fill="x", padx=28, pady=(10, 0), ipady=8)
    button("Mở ứng dụng trong trình duyệt", lambda: webbrowser.open(url), True)
    label("Dùng cùng máy: tạo Alice và Bob trong hai tab.\nDùng hai PC: cả hai đăng nhập cùng một địa chỉ HTTPS của host.")
    remote = tk.Entry(window, relief="flat", bg="#141f36", fg=fg, insertbackground=fg, font=("Segoe UI", 11))
    config = store.root / "client-settings.json"
    try:
        settings = json.loads(config.read_text(encoding="utf-8"))
        remote.insert(0, settings.get("server", "https://"))
    except (OSError, ValueError):
        remote.insert(0, "https://")
    remote.pack(fill="x", padx=28, pady=(10, 0), ipady=8)

    def open_remote():
        value = remote.get().strip().rstrip("/")
        parsed = urlparse(value)
        if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password or parsed.query:
            messagebox.showerror("Địa chỉ host", "Nhập URL HTTPS của máy chủ, ví dụ https://vault.example.com")
            return
        config.write_text(json.dumps({"server": value}), encoding="utf-8")
        webbrowser.open(value)

    button("Kết nối tới host HTTPS", open_remote)

    def backup():
        destination = filedialog.asksaveasfilename(title="Sao lưu server", defaultextension=".zip", initialfile="SecretVault-server-backup.zip", filetypes=[("ZIP backup", "*.zip")])
        if destination:
            store.backup(Path(destination))
            messagebox.showinfo("Sao lưu", "Đã sao lưu tài khoản, gói khóa mã hóa và ciphertext.\nGiữ mật khẩu để có thể mở lại vault.")

    button("Sao lưu dữ liệu máy chủ…", backup)
    label("Dữ liệu riêng: " + str(store.root), 9)

    def close():
        if server:
            server.shutdown()
            server.server_close()
        window.destroy()

    window.protocol("WM_DELETE_WINDOW", close)
    if not no_browser:
        window.after(350, lambda: webbrowser.open(url))
    window.mainloop()
