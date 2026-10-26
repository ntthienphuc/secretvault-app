"""Windows launcher and command-line hosting. The installer bundles Python."""

from __future__ import annotations

import argparse
import atexit
import json
import os
import shutil
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
from .lan import prepare_lan, trust_host_certificate


def default_data():
    if os.name == "nt":
        return Path(os.environ.get("LOCALAPPDATA", Path.home())) / "SecretVault" / "v2"
    return Path.home() / ".local" / "share" / "secretvault-v2"


def arguments():
    parser = argparse.ArgumentParser(description="SecretVault 2 encrypted workspace")
    parser.add_argument("--headless", action="store_true", help="Run without the Windows launcher")
    parser.add_argument("--no-browser", action="store_true")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=None)
    parser.add_argument("--data-dir", type=Path, default=Path(os.environ.get("SECRET_VAULT_DATA", default_data())))
    parser.add_argument("--tls-cert", type=Path)
    parser.add_argument("--tls-key", type=Path)
    parser.add_argument("--behind-proxy", action="store_true", help="Require an HTTPS reverse proxy on loopback")
    parser.add_argument("--lan-host", action="store_true", help="Host this PC's private LAN with HTTPS, default port 8443")
    parser.add_argument("--lan-ip", help="Select the LAN IPv4 address when multiple interfaces are active")
    parser.add_argument("--prepare-lan", action="store_true", help="Prepare certificates/client ZIP without starting a server")
    parser.add_argument("--trust-lan", action="store_true", help="Trust this host's local CA for the current Windows user")
    parser.add_argument("--allowed-network", action="append", default=[], help="Restrict incoming clients to a CIDR network")
    parser.add_argument("--local", action="store_true", help="Open local vault instead of a saved remote host")
    return parser.parse_args()


def public_dir():
    if getattr(sys, "frozen", False):
        return Path(sys._MEIPASS) / "public"
    return Path(__file__).resolve().parent.parent / "public"


def main():
    args = arguments()
    args.port = args.port if args.port is not None else (8443 if args.lan_host else 8765)
    if not 1 <= args.port <= 65535:
        raise SystemExit("Port must be between 1 and 65535")
    if args.prepare_lan and not args.lan_host:
        raise SystemExit("Use --prepare-lan with --lan-host")
    # A client with a saved host opens that host directly, without a second vault.
    if not (args.lan_host or args.local or args.headless or args.tls_cert or args.behind_proxy):
        try:
            settings = json.loads((args.data_dir / "client-settings.json").read_text(encoding="utf-8-sig"))
            remote = urlparse(settings.get("server", ""))
            if remote.scheme == "https" and remote.hostname and not remote.username and not remote.password and not remote.query:
                webbrowser.open(settings["server"])
                return
        except (OSError, ValueError, TypeError):
            pass
    args.data_dir.mkdir(parents=True, exist_ok=True)
    if sys.stdout is None:
        log = open(args.data_dir / "secretvault.log", "a", encoding="utf-8", buffering=1)
        sys.stdout = log
        sys.stderr = log
    lan_info = None
    if args.lan_host:
        if args.tls_cert or args.tls_key or args.behind_proxy:
            raise SystemExit("LAN mode manages its own TLS certificate")
        lan_info = prepare_lan(args.data_dir, args.port, args.lan_ip)
        if args.trust_lan:
            trust_host_certificate(lan_info)
        if args.prepare_lan:
            print(json.dumps(lan_info, ensure_ascii=False, default=str), flush=True)
            return
        args.host = lan_info["address"]
        args.tls_cert, args.tls_key = lan_info["certificate"], lan_info["key"]
        args.allowed_network = [lan_info["network"]]
    if args.host not in ("127.0.0.1", "localhost", "::1") and not args.tls_cert:
        raise SystemExit("Remote host requires --tls-cert and --tls-key. For Caddy use --host 127.0.0.1 --behind-proxy.")
    if args.behind_proxy and args.host not in ("127.0.0.1", "localhost", "::1"):
        raise SystemExit("Reverse proxy mode must bind to loopback")
    store = Store(args.data_dir)
    scheme = "https" if args.tls_cert else "http"
    local_host = "127.0.0.1" if args.host in ("0.0.0.0", "localhost") else args.host
    url = f"{scheme}://{local_host}:{args.port}"
    server = None
    context = None
    if args.tls_cert:
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.minimum_version = ssl.TLSVersion.TLSv1_2
        context.load_cert_chain(str(args.tls_cert), str(args.tls_key))
    try:
        server = VaultHTTPServer((args.host, args.port), store, public_dir(), secure=bool(args.tls_cert), behind_proxy=args.behind_proxy, allowed_networks=args.allowed_network, lan_host_id=lan_info["hostId"] if lan_info else None)
        if context:
            server.socket = context.wrap_socket(server.socket, server_side=True)
    except OSError:
        # Never terminate another process to take its port.
        try:
            probe_context = ssl.create_default_context(cafile=str(lan_info["ca"])) if lan_info else None
            with urllib.request.urlopen(url + "/api/health", timeout=2, context=probe_context) as response:
                health = json.load(response)
            if health.get("app") != "SecretVault" or health.get("version") != VERSION:
                raise ValueError("Port is occupied by a different application")
            if lan_info and health.get("lanHostId") != lan_info["hostId"]:
                raise ValueError("Port belongs to a different LAN host")
        except Exception as error:
            if not args.headless:
                import tkinter.messagebox
                tkinter.messagebox.showerror("SecretVault", "Cổng đang được ứng dụng khác sử dụng.\nChạy với --port 8766 hoặc tắt phiên cũ.\n" + str(error))
            raise SystemExit("Port occupied; try --port 8766")
    if server:
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        if lan_info:
            pid_file = lan_info["directory"] / "host-process.json"
            pid_file.write_text(json.dumps({"pid": os.getpid(), "executable": str(Path(sys.executable).resolve()), "url": url, "dataDir": str(store.root)}), encoding="utf-8")

            def remove_pid():
                try:
                    if json.loads(pid_file.read_text(encoding="utf-8")).get("pid") == os.getpid():
                        pid_file.unlink()
                except (OSError, ValueError):
                    pass
            atexit.register(remove_pid)
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
    launcher(store, server, url, args.no_browser, lan_info)


def launcher(store, server, url, no_browser, lan_info=None):
    import tkinter as tk
    from tkinter import filedialog, messagebox

    window = tk.Tk()
    window.title("SecretVault · Máy chủ & kết nối")
    window.geometry("640x535")
    window.minsize(600, 510)
    window.configure(bg="#f8f7fc")
    fg = "#42334e"
    muted = "#9482a1"

    def label(value, size=10, color=muted):
        widget = tk.Label(window, text=value, fg=color, bg="#f8f7fc", font=("Segoe UI", size), anchor="w", justify="left")
        widget.pack(fill="x", padx=28, pady=(10, 0))
        return widget

    def button(value, command, primary=False):
        widget = tk.Button(window, text=value, command=command, relief="flat", cursor="hand2",
                           bg="#7555df" if primary else "#ffffff", fg="white" if primary else fg,
                           activebackground="#ece4fa", activeforeground=fg, font=("Segoe UI", 11), pady=9)
        widget.pack(fill="x", padx=28, pady=(10, 0))
        return widget

    label("SecretVault", 25, fg)
    label("Vault mã hóa · DH live · ElGamal offline", 11)
    status = label("● Máy chủ cục bộ đang chạy" if server else "● Đang dùng máy chủ SecretVault đã mở", 12, "#75a38b")
    address = tk.Entry(window, relief="flat", bg="#ffffff", fg=fg, font=("Consolas", 12))
    address.insert(0, url)
    address.configure(state="readonly", readonlybackground="#ffffff")
    address.pack(fill="x", padx=28, pady=(10, 0), ipady=8)
    button("Mở ứng dụng trong trình duyệt", lambda: webbrowser.open(url), True)
    if lan_info:
        window.title("SecretVault · Host LAN")
        status.configure(text="● Host HTTPS trong LAN · " + lan_info["network"])
        label("Gửi gói kết nối cho hai máy khách. Mỗi người đăng ký tài khoản riêng.\nMáy này lưu dữ liệu chung; hãy giữ máy bật khi đang gửi/nhận.")

        def copy_address():
            window.clipboard_clear()
            window.clipboard_append(url)
            window.update()
            messagebox.showinfo("Địa chỉ host", "Đã sao chép: " + url)

        def export_clients():
            destination = filedialog.asksaveasfilename(title="Gói kết nối cho máy khách", defaultextension=".zip", initialfile="SecretVault-LAN-Clients.zip", filetypes=[("ZIP", "*.zip")])
            if destination:
                if Path(destination).resolve() != lan_info["kit"].resolve():
                    shutil.copy2(lan_info["kit"], destination)
                messagebox.showinfo("Máy khách", "Gửi ZIP này cho hai máy còn lại.\nGiải nén rồi chạy Connect.cmd một lần; các lần sau mở shortcut SecretVault LAN.")

        button("Sao chép địa chỉ LAN", copy_address)
        button("Lưu gói kết nối cho hai máy khách…", export_clients)
    else:
        label("Dùng cùng máy: tạo Alice và Bob trong hai tab.\nDùng hai PC: cả hai đăng nhập cùng một địa chỉ HTTPS của host.")
    remote = tk.Entry(window, relief="flat", bg="#ffffff", fg=fg, insertbackground=fg, font=("Segoe UI", 11))
    config = store.root / "client-settings.json"
    try:
        settings = json.loads(config.read_text(encoding="utf-8"))
        remote.insert(0, settings.get("server", "https://"))
    except (OSError, ValueError):
        remote.insert(0, "https://")
    if not lan_info:
        remote.pack(fill="x", padx=28, pady=(10, 0), ipady=8)

    def open_remote():
        value = remote.get().strip().rstrip("/")
        parsed = urlparse(value)
        if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password or parsed.query:
            messagebox.showerror("Địa chỉ host", "Nhập URL HTTPS của máy chủ, ví dụ https://vault.example.com")
            return
        config.write_text(json.dumps({"server": value}), encoding="utf-8")
        webbrowser.open(value)

    if not lan_info:
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
