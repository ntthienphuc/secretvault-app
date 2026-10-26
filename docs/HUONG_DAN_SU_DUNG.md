# SecretVault 2 — hướng dẫn sử dụng

## Chạy trên Windows bằng bộ cài

1. Mở `SecretVault-Setup-2.2.0-x64.exe` trong thư mục `release` và chọn Install. Không cần cài Python/Node trên máy dùng app.
2. Mở SecretVault từ Start Menu. Bảng điều khiển khởi chạy Python server cục bộ và mở trình duyệt tại `http://127.0.0.1:8765`.
3. Chọn **Tạo tài khoản**, nhập email, tên và mật khẩu tối thiểu 10 ký tự. App tạo danh tính khóa công khai trên trình duyệt và mã hóa private key trước khi lưu.
4. Chọn **Mã hóa tệp** để lưu file vào vault. Mỗi tệp tối đa 256 MiB; từng chunk 1 MiB dùng IV riêng và AES-GCM.
5. Bấm **Khóa & đăng xuất** khi dùng xong. Đóng bảng điều khiển để tắt server cục bộ. Đóng tab không tự tắt server.

Đây là app desktop có bảng điều khiển Python và giao diện web cục bộ trong Chrome/Edge. Không phải cửa sổ webview nhúng. Bộ cài phát triển chưa có chứng chỉ ký mã Authenticode thương mại.

App cài mặc định ở `%LOCALAPPDATA%\Programs\SecretVault`. Dữ liệu nằm riêng tại `%LOCALAPPDATA%\SecretVault\v2`, nên cập nhật hoặc gỡ app không chủ động xóa vault. Không có tài khoản hoặc mật khẩu dùng chung mặc định.

## Dùng thử hai tài khoản trên một PC

- Tab 1: đăng ký Alice bằng email của bạn dùng cho thử nghiệm.
- Chọn **Mở tab tài khoản khác** hoặc mở tab mới tới cùng URL. Đăng ký Bob bằng email khác. Hai tab có session riêng.
- Trong Danh bạ của mỗi người, tìm email người kia. Đối chiếu fingerprint với người đó rồi bấm **Ghim public key này**. Đây là bước thiết lập tin cậy lần đầu.

### Chia sẻ offline bằng ElGamal

Alice tải một tệp lên vault → bấm nút chia sẻ ở hàng tệp → chọn Bob → Tạo envelope & ký. Alice có thể đăng xuất. Bob vào **Được chia sẻ** rồi giải mã và tải tệp bằng private key của mình.

Offline ở đây có nghĩa **người gửi không cần online**, còn máy chủ lưu ciphertext vẫn phải chạy khi người nhận tải. Nếu PC Alice cũng chính là server và PC ấy tắt, Bob phải chờ server mở lại hoặc dùng một host riêng luôn chạy.

Trong Crypto Inspector, **chữ ký hợp lệ** là metadata và các hash có chữ ký đã kiểm tra. **Nội dung hợp lệ** chỉ xuất hiện sau khi tải và xác minh từng hash/tag AES-GCM. Bạn có thể tải JSON bằng chứng, không chứa private key.

Thu hồi chia sẻ chặn lần tải tiếp. Không xóa bản rõ hoặc khóa mà người nhận đã giữ trước đó.

### Gửi live bằng Diffie–Hellman

Hai người cùng mở app → người gửi chọn tệp và liên hệ online → gửi lời mời → người nhận bấm **Nhận an toàn** → browser ký và xác minh hai public key DH → HKDF tạo khóa phiên → chuyển ciphertext từng khối → người nhận bấm **Xác minh, giải mã & tải**.

Phiên tối đa 15 phút. Refresh tab/đăng xuất giữa phiên làm mất khóa tạm; tạo phiên mới để gửi lại. Kênh Python dùng polling 3 giây, không phải P2P trực tiếp hay WebRTC. Ciphertext live được dọn khi phiên hết hạn và host xử lý request kế tiếp.

Nếu trình duyệt chặn lần tải tự động, bấm liên kết **Lưu tệp: ...** xuất hiện phía trên. Liên kết tồn tại hai phút; có thể bấm giải mã lại để tạo mới.

## Dùng hai PC hoặc dùng qua Internet

**Dùng trong LAN với bản 2.2:** máy host mở **SecretVault - Host LAN** và xuất gói ZIP; máy khách chạy `Connect.cmd` một lần rồi dùng shortcut **SecretVault LAN**. Xem [LAN_WINDOWS.md](LAN_WINDOWS.md).

Hai PC phải kết nối **cùng một host**, ví dụ `https://vault.example.com`. Mỗi PC mở bảng điều khiển SecretVault, nhập URL trong ô **Kết nối tới host HTTPS**, rồi đăng nhập trên địa chỉ đó. Máy khách cũng có thể mở URL trực tiếp trong Chrome/Edge mà không cần bộ cài.

`127.0.0.1` luôn là chính máy đang dùng. Không gửi địa chỉ này cho PC khác. Việc cài app trên hai PC không tự đồng bộ hai server SQLite riêng.

Backend Python hỗ trợ HTTPS trực tiếp với chứng chỉ hợp lệ hoặc đứng sau Caddy. Xem `HOSTING.md`. Cấu hình hosting được chuẩn bị sẵn; bản giao không tự tạo domain, mua VPS hay public/deploy server.

## Sao lưu và mở lại trên thiết bị khác

- Đăng nhập cùng host từ thiết bị khác bằng email/mật khẩu: browser tải private bundle đã mã hóa, rồi giải mã cục bộ. Không phụ thuộc vào localStorage chứa private key thô.
- Trong **Tài khoản & kết nối**, tải gói khóa mã hóa để giữ bản sao. Gói này cần mật khẩu; nó không thay cho bản sao file/cơ sở dữ liệu server.
- Bảng điều khiển PC có nút sao lưu toàn bộ server thành ZIP: SQLite snapshot + thư mục ciphertext. Nút này tạo snapshot nhất quán của DB; trong lúc sao lưu, chờ các upload hoàn tất.
- Khôi phục: tắt server; giải nén ZIP vào một thư mục dữ liệu **mới**; chạy `SecretVault.exe --data-dir "D:\SecretVault-restored"`. Nếu chạy source, thêm `--data-dir` sau `app.py`. Giữ bản gốc, không ghi đè khi chưa kiểm tra.
- Mất mật khẩu có thể khiến mất khả năng mở khóa. App chưa có email reset/recovery hoặc xoay khóa; email hiện dùng như tên đăng nhập, chưa xác minh sở hữu email.

## Chạy từ mã nguồn / xử lý cổng bận

Python 3.11 trở lên:

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe app.py
```

Chỉ chạy server, không mở bảng điều khiển:

```powershell
.\.venv\Scripts\python.exe app.py --headless --no-browser
```

Cổng bận: dùng `--port 8766`. App không tắt tiến trình khác để chiếm cổng. Nếu instance SecretVault 2 cùng cổng đã chạy, launcher có thể mở lại instance ấy. Không chia sẻ cổng với bản v1.

Source v1 được giữ nguyên tại `archive/v1_20261022`. Dữ liệu/khóa v1 không tự đổi sang v2 vì cấu trúc mật mã khác; muốn mang file sang, mở đúng trình duyệt và server v1 để giải mã, rồi upload vào v2.
