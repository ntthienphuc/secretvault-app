"""Small native client launcher. All file cryptography remains in the browser."""

from __future__ import annotations

import argparse
import json
import queue
import sys
import threading
import webbrowser
from pathlib import Path

from . import VERSION
from .connection import check_connection, default_profile_dir, import_kit, install_trust, seed_profile, windows_trusted


def bootstrap_dir():
    if getattr(sys, "frozen", False):
        return Path(sys._MEIPASS) / "bootstrap"
    return Path(__file__).resolve().parent.parent / "packaging" / "client-bootstrap"


def main():
    parser = argparse.ArgumentParser(description="SecretVault Client — connect to a shared HTTPS host")
    parser.add_argument("--profile-dir", type=Path, default=default_profile_dir())
    parser.add_argument("--import-kit", type=Path)
    parser.add_argument("--check", action="store_true", help="Verify TLS/host identity without opening a browser or changing certificate trust")
    parser.add_argument("--result-file", type=Path)
    parser.add_argument("--no-browser", action="store_true")
    parser.add_argument("--show-setup", action="store_true")
    args = parser.parse_args()
    args.profile_dir.mkdir(parents=True, exist_ok=True)
    if sys.stdout is None:
        log = open(args.profile_dir / "client.log", "a", encoding="utf-8", buffering=1)
        sys.stdout = log
        sys.stderr = log
    profile = None
    failure = ""
    try:
        profile = import_kit(args.profile_dir, args.import_kit) if args.import_kit else seed_profile(args.profile_dir, bootstrap_dir())
        if args.check:
            result = {"clientVersion": VERSION, **check_connection(profile), "windowsTrusted": windows_trusted(profile), "startsServer": False}
            if args.result_file:
                args.result_file.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
            print(json.dumps(result, ensure_ascii=False), flush=True)
            return
    except Exception as error:
        if args.check:
            print(json.dumps({"ok": False, "error": str(error)}, ensure_ascii=False), flush=True)
            raise SystemExit(1)
        failure = str(error)
    launcher(args, profile, failure)


def launcher(args, initial_profile, failure):
    import tkinter as tk
    from tkinter import filedialog

    window = tk.Tk()
    window.title("SecretVault Client")
    window.geometry("620x510")
    window.minsize(590, 510)
    window.configure(bg="#f8f7fc")
    fg, muted, violet = "#42334e", "#80738d", "#7555df"
    profile = initial_profile
    events = queue.SimpleQueue()
    running = False
    trusted = False

    def label(text, size=10, color=muted):
        item = tk.Label(window, text=text, bg="#f8f7fc", fg=color, font=("Segoe UI", size), justify="left", anchor="w", wraplength=555)
        item.pack(fill="x", padx=28, pady=(9, 0))
        return item

    label("SecretVault Client", 24, fg)
    label("Vào kho chung của nhóm", 12, fg)
    label("Tệp được mã hóa và mở khóa trên trình duyệt của bạn.")
    url = tk.StringVar(value=profile["url"] if profile else "Chưa có cấu hình host")
    field = tk.Entry(window, textvariable=url, state="readonly", readonlybackground="white", fg=fg, relief="flat", font=("Consolas", 12))
    field.pack(fill="x", padx=28, pady=(18, 0), ipady=9)
    status = label(failure or "Đang kiểm tra cấu hình…", 11)
    fingerprint = label("", 9)

    def refresh_labels():
        url.set(profile["url"] if profile else "Chưa có cấu hình host")
        fingerprint.configure(text=("Fingerprint chứng chỉ host · SHA-256\n" + profile["caSha256"]) if profile else "Nhập ZIP kết nối được xuất từ SecretVault Host.")
        connect.configure(text="Mở SecretVault" if trusted else "Tin cậy chứng chỉ & kết nối", state="normal" if profile and not running else "disabled")
        choose.configure(state="disabled" if running else "normal")

    def start_worker(operation, operation_name):
        nonlocal running
        if running:
            return
        running = True
        refresh_labels()

        def run():
            try:
                events.put((operation_name, operation(), None))
            except Exception as error:
                events.put((operation_name, None, str(error)))
        threading.Thread(target=run, daemon=True).start()

    def connect_now():
        status.configure(text="Đang kiểm tra HTTPS và danh tính host…", fg=muted)

        def work():
            result = check_connection(profile)
            install_trust(profile)
            return result
        start_worker(work, "connect")

    connect = tk.Button(window, text="Kết nối", command=connect_now, relief="flat", bg=violet, fg="white", activebackground="#ece4fa", activeforeground=fg, cursor="hand2", font=("Segoe UI", 11), pady=10)
    connect.pack(fill="x", padx=28, pady=(20, 0))

    def choose_kit():
        nonlocal profile, trusted
        selection = filedialog.askopenfilename(title="Chọn gói kết nối từ máy Host", filetypes=[("Gói kết nối ZIP", "*.zip")])
        if not selection:
            return
        try:
            profile = import_kit(args.profile_dir, Path(selection))
            trusted = False
            status.configure(text="Đã nhập host. Đối chiếu fingerprint với chủ host trước khi kết nối.", fg=muted)
            start_worker(lambda: windows_trusted(profile), "trust-check")
        except Exception as error:
            status.configure(text=str(error), fg="#b14b66")
        refresh_labels()

    choose = tk.Button(window, text="Nhập gói kết nối từ Host (.zip)…", command=choose_kit, relief="flat", bg="white", fg=fg, cursor="hand2", font=("Segoe UI", 11), pady=9)
    choose.pack(fill="x", padx=28, pady=(10, 0))
    label("Lần đầu, Windows có thể hỏi xác nhận chứng chỉ HTTPS nội bộ.\nChỉ dùng gói kết nối do chủ host của bạn cung cấp.", 9)
    label("Đăng ký hoặc đăng nhập tài khoản riêng sau khi mở app.\nMáy host cần bật khi bạn lưu, gửi hoặc nhận tệp.", 9)

    def poll_events():
        nonlocal running, trusted
        try:
            while True:
                action, result, error = events.get_nowait()
                running = False
                if error:
                    status.configure(text=error, fg="#b14b66")
                elif action == "trust-check":
                    trusted = result
                    status.configure(text="Chứng chỉ đã tin cậy. Sẵn sàng mở app." if trusted else "Xác nhận chứng chỉ một lần để dùng Chrome/Edge với host này.", fg=muted)
                    if trusted and not args.show_setup and not args.no_browser:
                        window.after(100, connect_now)
                elif action == "connect":
                    trusted = True
                    status.configure(text="Đã xác minh HTTPS. " + result["url"], fg="#52866d")
                    if not args.no_browser:
                        webbrowser.open(result["url"])
                        window.after(1000, window.destroy)
                refresh_labels()
        except queue.Empty:
            pass
        window.after(100, poll_events)

    refresh_labels()
    if profile:
        window.after(100, lambda: start_worker(lambda: windows_trusted(profile), "trust-check"))
    window.after(100, poll_events)
    window.mainloop()
