# SecretVault 2.0

Ứng dụng đồ án với đúng ba nội dung: **khóa công khai, gửi live bằng Diffie–Hellman, chia sẻ offline bằng ElGamal Hybrid**. Backend Python, giao diện web tiếng Việt, SQLite và mã hóa tệp ở browser.

## Dùng ngay trên PC

Mở `release/SecretVault-Setup-2.0.0-x64.exe`, cài rồi mở SecretVault từ Start Menu. App có Python runtime đi kèm; người dùng không cần cài Python hoặc npm. Launcher mở server cục bộ và browser. Dữ liệu riêng tại `%LOCALAPPDATA%\SecretVault\v2`.

- [Hướng dẫn sử dụng](docs/HUONG_DAN_SU_DUNG.md): đăng ký, danh bạ, hai tab, offline share, live transfer, backup.
- [Đối chiếu ba nội dung với slide](docs/DOI_CHIEU_SLIDE.md): điểm sai của v1 và sửa ở v2.
- [Cách host chung cho hai PC](docs/HOSTING.md): HTTPS + Python/Caddy; chưa triển khai public.
- [Bằng chứng kiểm thử](audit/integration-results.json): kiểm thử API/crypto có trường hợp dữ liệu bị sửa và sai quyền.

## Chạy mã nguồn

Python 3.11 trở lên. Chạy `start.bat` hoặc:

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe app.py
```

Server không cần GUI:

```powershell
.\.venv\Scripts\python.exe app.py --headless --no-browser --port 8765
```

Mở `http://127.0.0.1:8765`. Mỗi tab đăng nhập một tài khoản riêng. Tất cả client muốn chia sẻ phải dùng chung một host; mỗi PC chạy một SQLite server độc lập không tự đồng bộ.

## Tổ chức mã nguồn

- `vaultserver/store.py`: DB, metadata, ACL helpers, ciphertext và backup.
- `vaultserver/security.py`: password verifier, public key validation và xác minh chữ ký.
- `vaultserver/server.py`: API có xác thực và kiểm tra ownership/recipient.
- `vaultserver/desktop.py`: launcher PC, CLI và cấu hình host.
- `public/src/crypto.js`: ElGamal/DH hữu hạn MODP3072, HKDF, AES-GCM, chữ ký hỗ trợ và bảo vệ private bundle.
- `public/src/app.js`, `view.js`, `api.js`: các workflow và giao diện.
- `tests/integration.mjs`: kiểm thử end-to-end qua HTTP thật.
- `packaging/build.ps1`: PyInstaller + Inno Setup; tạo bộ cài x64.

## Kiểm thử / đóng gói

```powershell
.\.venv\Scripts\python.exe app.py --headless --no-browser --port 8786 --data-dir audit/runtime-test
node tests/integration.mjs
```

Chạy kiểm thử ở cửa sổ terminal khác với server. Dữ liệu QA riêng, không ghi vào vault người dùng. Build bằng `pwsh -File packaging/build.ps1` với Python 3.11 và Inno Setup 6 trên Windows.

Offline nghĩa chủ tệp có thể offline, còn server vẫn cần chạy. Ghim fingerprint là TOFU, chưa là PKI có CA. ElGamal Hybrid của đồ án không phải HPKE đã chuẩn hóa. Mã BigInt tự cài chưa qua kiểm toán timing/bảo mật; không tuyên bố mức an toàn sản phẩm đã audit. Xem tài liệu đối chiếu để hiểu giới hạn.

Source bản cũ giữ ở `archive/v1_20261022`; không chạy lẫn dữ liệu v1 và v2.
