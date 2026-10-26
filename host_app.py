"""Dedicated host entry point; the client is a different executable."""

import sys

from vaultserver.desktop import main


if __name__ == "__main__":
    if "--stop-host" in sys.argv:
        from pathlib import Path
        from vaultserver.desktop import default_data
        from vaultserver.host_control import stop_background
        root = default_data()
        if "--data-dir" in sys.argv:
            root = Path(sys.argv[sys.argv.index("--data-dir") + 1])
        try:
            stop_background(root)
            if "--headless" not in sys.argv:
                from tkinter import messagebox
                messagebox.showinfo("SecretVault Host", "Đã dừng host LAN. Dữ liệu được giữ lại.")
        except Exception as error:
            if "--headless" not in sys.argv:
                from tkinter import messagebox
                messagebox.showerror("SecretVault Host", str(error))
            raise SystemExit(1)
        raise SystemExit(0)
    if not any(option in sys.argv for option in ("--lan-host", "--local", "--tls-cert", "--behind-proxy")):
        sys.argv.append("--lan-host")
    if "--lan-host" in sys.argv and not any(option in sys.argv for option in ("--headless", "--prepare-lan", "--trust-lan")):
        sys.argv.append("--trust-lan")
    try:
        main()
    except Exception as error:
        if "--headless" not in sys.argv and "--prepare-lan" not in sys.argv:
            from tkinter import messagebox
            messagebox.showerror("SecretVault Host", str(error))
        raise
