# SecretVault 2.3 — hai bộ cài riêng cho Windows x64

## Host: máy lưu dữ liệu chung

Cài `SecretVault-Host-Setup-2.3.0-x64.exe` trên máy làm chủ. Nếu bản Host cũ đang chạy, dùng shortcut dừng Host cũ trước khi mở bản mới. Cài đặt/gỡ ứng dụng không chủ động xóa `%LOCALAPPDATA%\SecretVault\v2`; giữ backup dữ liệu khi cập nhật.

Mở **SecretVault Host**. App phát hiện IP LAN, chạy HTTPS và hiển thị địa chỉ. Chứng chỉ nội bộ dùng lại identity đã có trên máy host; lần đầu Windows có thể hỏi xác nhận tin cậy chứng chỉ.

- **Mở ứng dụng trong trình duyệt**: chủ host dùng cùng địa chỉ với mọi người.
- **Sao chép địa chỉ LAN**: chia sẻ địa chỉ host.
- **Lưu gói kết nối**: xuất ZIP công khai cho Client khi đổi host hoặc IP.
- **Sao lưu dữ liệu máy chủ**: giữ bản sao tài khoản, gói khóa mã hóa và tệp mã hóa.
- Đóng bảng điều khiển sẽ dừng server nếu chính bảng đó vừa khởi chạy server. Host chạy nền từ Startup có thể dừng bằng **SecretVault Host - Stop** trong Start Menu.

Có tùy chọn khởi động host sau khi đăng nhập Windows trong bộ cài. Máy host cần bật và giữ kết nối mạng khi mọi người sử dụng.

## Client: hai máy còn lại

Cài cùng file `SecretVault-Client-Setup-2.3.0-x64.exe` trên cả hai máy khách. Client có cấu hình công khai sẵn cho host `https://192.168.1.3:8443` của đợt bàn giao này.

1. Mở **SecretVault Client**.
2. Lần đầu chọn **Tin cậy chứng chỉ & kết nối**, đối chiếu fingerprint với chủ host và xác nhận chứng chỉ trong Windows.
3. Trình duyệt mở kho chung; mỗi người đăng ký hoặc đăng nhập tài khoản riêng.
4. Các lần sau Client kiểm tra HTTPS/định danh host rồi mở app. Nếu host offline, app giữ màn hình để thử lại.

Client không chạy web server, không có SQLite và không lưu tệp người dùng. Nó chỉ lưu cấu hình/chứng chỉ công khai ở `%LOCALAPPDATA%\SecretVault\Client`. Mật khẩu và thao tác mã hóa nằm trong giao diện web của host như trước.

Nếu đổi host hoặc IP: Host xuất ZIP mới, Client mở **Connection settings** trong Start Menu hoặc chọn **Nhập gói kết nối từ Host (.zip)**. Client chỉ đọc cấu hình/chứng chỉ; không thực thi script chứa trong ZIP.

## Luồng dùng chung

Mọi người dùng cùng một host. Thêm nhau trong Danh bạ, đối chiếu rồi ghim public-key fingerprint. DH cần cả hai giữ tab mở; ElGamal cho phép người nhận mở sau khi người gửi đăng xuất, trong khi host vẫn chạy. Thuật toán mã hóa và giới hạn tệp 256 MiB giữ nguyên.

Có thể cài cả Host và Client trên một PC để trình diễn; tạo tài khoản riêng trong các tab của cùng địa chỉ host. Cài một Host và hai Client trên ba PC là cách dùng LAN thông thường.

Hai bộ cài chứa Python runtime sẵn. Không cần cài Python hoặc Node trên máy dùng app. Chứng chỉ TLS của host và public key danh tính người dùng là hai lớp khác nhau; vẫn cần ghim fingerprint của người nhận trong app.
