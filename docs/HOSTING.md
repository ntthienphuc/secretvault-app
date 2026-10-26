# Host Python server cho SecretVault

## Một PC

Bộ cài tự chạy server loopback; không cần domain, port forwarding hay Internet để dùng vault trên PC đó. Python runtime đã nằm trong app. Chia sẻ hai tài khoản trên cùng PC thực hiện bằng hai tab riêng.

## Một host chung cho nhiều PC

Dùng một máy/VPS luôn chạy. Trình duyệt remote phải nhận trang qua HTTPS có chứng chỉ hợp lệ để dùng Web Crypto. Client mở cùng một URL; mỗi người có tài khoản và private bundle mã hóa riêng. Metadata tên tệp/email vẫn có trên server.

Mẫu đơn giản: Python ở loopback, Caddy cung cấp HTTPS. Cài Python 3.11+, dependency trong `requirements.txt`, và Caddy từ nguồn chính thức. Đặt thư mục project ở `/opt/secretvault` và tạo user dịch vụ `secretvault` có quyền ghi `/var/lib/secretvault`.

```bash
cd /opt/secretvault
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python app.py --headless --no-browser --host 127.0.0.1 --port 8765 --behind-proxy --data-dir /var/lib/secretvault
```

Ví dụ Caddyfile (thay domain bằng domain thật của bạn):

```caddyfile
vault.example.com {
    reverse_proxy 127.0.0.1:8765
}
```

Domain cần trỏ tới IP host; Caddy cần truy cập cổng 80/443 để lấy và phục vụ chứng chỉ. Không expose 8765 trực tiếp. Chế độ `--behind-proxy` chỉ chấp nhận request từ loopback với `X-Forwarded-Proto: https`; Caddy chuyển header này khi proxy HTTPS.

Mẫu dịch vụ systemd có trong `hosting/secretvault.service`. Copy và điều chỉnh đường dẫn, user dịch vụ, domain rồi tự enable theo máy host. Đó là thao tác triển khai; task này chỉ chuẩn bị cấu hình, chưa triển khai public.

Hoặc dùng HTTPS trực tiếp khi đã có chứng chỉ tin cậy:

```powershell
SecretVault.exe --headless --no-browser --host 0.0.0.0 --port 8443 --tls-cert "D:\certs\fullchain.pem" --tls-key "D:\certs\privkey.pem" --data-dir "D:\SecretVaultData"
```

Không dùng cert tự ký rồi tắt kiểm tra TLS. Với LAN dùng domain/chứng chỉ tin cậy phù hợp, hoặc thử hai tài khoản trên cùng PC trước.

## Vận hành

- Giữ backup `vault-v2.db` nhất quán và toàn bộ thư mục `ciphertext`. App PC có chức năng snapshot + ZIP; host CLI nên dừng dịch vụ trước khi copy backup.
- Khi phục hồi vào một thư mục dữ liệu mới, dừng instance cũ trước; không chạy hai process ghi vào cùng thư mục.
- Kênh live dùng polling + lưu ciphertext có thời hạn 15 phút. Server còn cần chạy để người nhận offline share tải về; sender không cần online.
- Giới hạn hiện tại: tệp 256 MiB, 1.000 tệp mỗi tài khoản; đây là bản đồ án cho nhóm nhỏ. Chưa có service HA, object storage, quota toàn server hay audit bảo mật để mở đăng ký Internet đại trà.
- Backend bảo vệ API bằng token ngẫu nhiên có thời hạn, pin public key, chữ ký và ACL. Bảo vệ host, tài khoản hệ điều hành và mã JavaScript được phân phối vẫn là một phần của mô hình tin cậy.

Tài liệu Caddy chính thức: https://caddyserver.com/docs/automatic-https và https://caddyserver.com/docs/caddyfile/directives/reverse_proxy.
