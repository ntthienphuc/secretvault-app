# SecretVault 2.2 — một máy host, hai máy khách trong LAN

Máy host chạy Python HTTPS và lưu chung tài khoản/tệp. Hai máy khách dùng Chrome/Edge, không cần cài Python. Các máy cần truy cập được nhau trong mạng LAN; Wi-Fi khách hoặc chế độ client isolation có thể chặn kết nối.

## Máy host

1. Cài `SecretVault-Setup-2.2.0-x64.exe`.
2. Mở **SecretVault - Host LAN** từ Start Menu. Lần đầu Windows có thể hỏi xác nhận chứng chỉ **SecretVault LAN …**; đây là chứng chỉ HTTPS nội bộ dành riêng cho host.
3. Bảng điều khiển hiển thị địa chỉ, ví dụ `https://192.168.1.3:8443`. Cả ba người dùng đều mở địa chỉ này.
4. Chọn **Lưu gói kết nối cho hai máy khách…**, gửi ZIP cho hai máy còn lại bằng USB hoặc phương tiện bạn chọn.
5. Giữ máy host bật và không để sleep trong lúc sử dụng. Khi bảng điều khiển tự khởi chạy server, đóng bảng sẽ dừng server đó. Nếu đã có host chạy nền, bảng chỉ kết nối tới host đang chạy.

Dữ liệu: `%LOCALAPPDATA%\SecretVault\v2`. Tài khoản/tệp của server cũ dùng cùng thư mục này được giữ lại. Một server ở thư mục dữ liệu khác là một kho độc lập.

Chế độ LAN chọn IPv4 của card mạng có gateway, chỉ bind vào IP đó và từ chối client ngoài subnet đã chọn. Nếu có nhiều card LAN, thêm `--lan-ip` để chọn. Không cần cấu hình port forwarding trên router.

Máy hiện tại còn được cấu hình chạy host nền sau khi đăng nhập Windows. Desktop có **SecretVault - Host LAN** để mở bảng điều khiển, **SecretVault LAN** để mở web, và **Dung SecretVault Host LAN** để dừng host nền. Muốn tắt tự khởi động, gỡ shortcut `SecretVault LAN Host.lnk` trong thư mục Startup của tài khoản Windows; dữ liệu vẫn được giữ.

## Hai máy khách Windows

1. Giải nén toàn bộ `SecretVault-LAN-Clients.zip` vào một thư mục.
2. Chạy **Connect.cmd**. Script kiểm tra SHA256 chứng chỉ, cài chứng chỉ công khai vào `CurrentUser\Root`, kiểm tra host qua HTTPS rồi mở trình duyệt. Nếu Windows hỏi xác nhận, đối chiếu tên/fingerprint với người giữ máy host trước khi đồng ý.
3. Mỗi người **Đăng ký** bằng email, tên và mật khẩu riêng. Nếu đã có tài khoản trên đúng host này thì **Đăng nhập**.
4. Các lần sau chỉ cần mở shortcut **SecretVault LAN** trên Desktop.

Không cần quyền Administrator khi cài chứng chỉ cho tài khoản Windows hiện tại. Chứng chỉ cần cài lại nếu chuyển sang tài khoản Windows khác. Chrome/Edge dùng kho chứng chỉ Windows; Firefox có thể cần thiết lập riêng. Nếu trình duyệt chưa nhận chứng chỉ mới, đóng/mở lại trình duyệt. Không bỏ qua cảnh báo TLS để đăng nhập.

ZIP máy khách chỉ chứa chứng chỉ công khai, script kết nối, địa chỉ và hướng dẫn. Không gửi thư mục `lan\private`: thư mục đó có khóa riêng của host. CA chỉ được cấp cho các địa chỉ IPv4 riêng/loopback và tên máy host; khóa được lưu trong thư mục giới hạn quyền cho tài khoản chủ host và SYSTEM.

## Tạo tài khoản và kiểm tra luồng

- Đăng ký: tên 1–80 ký tự, email hợp lệ, mật khẩu tối thiểu 10 ký tự và xác nhận trùng nhau. Chữ ký đăng ký chứng minh nắm giữ khóa riêng. Email hiện là tên đăng nhập, chưa xác minh bằng email.
- Trùng email: báo lỗi, giữ tài khoản/khóa cũ. Sai mật khẩu: không đăng nhập và không mở được gói khóa.
- Đăng xuất: token của phiên đó hết hiệu lực; các phiên khác cùng tài khoản tiếp tục độc lập. Đăng nhập lại trên máy khác bằng cùng email/mật khẩu mở được gói khóa của cùng host.
- Hai người thêm nhau trong **Danh bạ**, đối chiếu rồi ghim fingerprint. Sau đó dùng **Chia sẻ offline** hoặc **Gửi trực tiếp**.
- ElGamal: người gửi chia sẻ xong có thể đăng xuất; host vẫn phải chạy để người nhận tải sau. DH: hai người giữ tab mở trong phiên; F5 làm mất khóa DH tạm và cần gửi lại.
- Không có email reset mật khẩu hoặc tài khoản dùng chung mặc định. Giữ mật khẩu và sao lưu gói khóa đã mã hóa.

## Vận hành và đổi địa chỉ

- Máy host hiện tại được cấu hình ở `https://192.168.1.3:8443`; xem gói ZIP xuất mới nhất để biết địa chỉ thực tế.
- Nếu DHCP đổi IP, mở lại Host LAN để cập nhật chứng chỉ và ZIP. Gói kết nối cũng thử tên máy, nhưng khả năng phân giải tên phụ thuộc mạng. Có thể đặt DHCP reservation trên router khi bạn có quyền quản trị router.
- Giữ backup cả SQLite và thư mục ciphertext. App có nút sao lưu server.
- Giới hạn tệp vẫn 256 MiB; chưa có quota theo GB. Thiết lập LAN không thay đổi thuật toán mã hóa của đề tài.
- Nếu firewall bật và chặn cổng 8443, quản trị viên chỉ mở TCP 8443 từ subnet LAN trên đúng card mạng. Không tắt firewall để xử lý kết nối.

## Chạy source

```powershell
.\.venv\Scripts\python.exe app.py --lan-host --trust-lan
```

Chỉ xuất cấu hình/chứng chỉ/ZIP:

```powershell
.\.venv\Scripts\python.exe app.py --lan-host --prepare-lan
```

Máy khách đã lưu host sẽ được bản 2.2 mở thẳng host đó khi khởi động SecretVault. Dùng `--local` khi chủ động muốn mở kho cục bộ riêng.
