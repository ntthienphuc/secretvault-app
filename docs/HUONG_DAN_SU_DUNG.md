# Hướng dẫn SecretVault Online

Cập nhật ngày 30/10/2026 sau đợt thiết kế lại giao diện. Web và app Windows Online 3.0.1 tải cùng giao diện mới; không cần cài lại app.

## Mở ứng dụng

Truy cập https://secretvault-online.vercel.app bằng Chrome hoặc Edge trên PC; dùng trình duyệt hiện đại trên điện thoại. Trên Windows x64, chạy bộ cài SecretVault-Online-Setup-3.0.1-x64.exe rồi mở SecretVault Online. Máy khách không cần Python hay server riêng. Web và app cùng tài khoản, tệp và danh bạ; hai người không cần cùng mạng.

Lần mở đầu có thể phải chờ máy chủ miễn phí thức dậy. Đợi dòng **Đã kết nối an toàn** rồi đăng nhập; nếu thất bại, bấm **Kết nối lại**. Nếu cửa sổ Windows không mở được WebView2, chọn mở bản web khi ứng dụng đề nghị.

## Tài khoản

Chọn **Tạo tài khoản**, nhập tên, email và mật khẩu ít nhất 10 ký tự, rồi nhập lại mật khẩu. Nút **Hiện/Ẩn** giúp kiểm tra mật khẩu đang gõ. Giữ mật khẩu ở nơi an toàn: bản demo chưa xác minh email và chưa hỗ trợ khôi phục mật khẩu.

Đăng nhập cùng tài khoản trên thiết bị khác để mở tệp đã lưu. Tải lại trang hoặc đóng app sẽ khóa phiên trên thiết bị; bạn đăng nhập lại bình thường. Khi dùng máy chung, mở **Tài khoản**, rồi bấm **Đăng xuất**. Trên PC, bấm tên của bạn ở góc dưới thanh bên; trên điện thoại, dùng mục **Tài khoản** ở thanh dưới. Liên kết tải tệp đã giải mã trong app được dọn khi đăng xuất; những bản đã lưu trong Downloads vẫn do bạn quản lý.

## Lưu và nhận tệp

1. Trong **Tệp của tôi**, bấm **Tải tệp lên** hoặc kéo thả. Có thể chọn nhiều tệp; app xử lý lần lượt.
2. Chờ thông báo đã tải lên. Mỗi tệp tối đa 25 MiB; tên tệp tối đa 240 ký tự.
3. Tìm bằng ô **Tìm tệp** ngay trên danh sách. Mở biểu tượng **Lọc và sắp xếp** để chọn tài liệu/hình ảnh hoặc tên/ngày. Nếu không thấy kết quả, bấm **Xóa bộ lọc**.
4. Với tệp của bạn, mở dấu **…** ở cuối dòng và chọn **Tải xuống**. Với tệp người khác gửi, mở **Đã nhận** rồi bấm **Tải xuống** ngay trên dòng tệp. App kiểm tra và giải mã trên thiết bị rồi chuyển tệp cho trình duyệt lưu.
5. Nếu trình duyệt chưa tải, dùng nút **Lưu tệp** xuất hiện bên dưới. Liên kết này hết hạn sau hai phút; bấm tải lại nếu cần. Chọn nơi lưu khi trình duyệt hoặc app hỏi.

## Chia sẻ cho người mở sau

Người nhận cần có tài khoản SecretVault. Tại tệp, bấm **Chia sẻ**, nhập đúng email của họ (có gợi ý từ danh bạ), rồi bấm **Gửi tệp**. Không cần thêm danh bạ trước. Màn hình thành công xác nhận tên và email người nhận. Họ mở **Đã nhận** để tải. Bạn có thể đăng xuất sau khi chia sẻ thành công.

Mở lại hộp thoại chia sẻ, mở **Ai có quyền xem**, rồi chọn **Thu hồi**. Thu hồi chỉ chặn những lần tải tiếp theo; không xóa được bản người nhận đã lưu. Ứng dụng xử lý bảo vệ tệp tự động, không yêu cầu nhập khóa.

## Gửi trực tiếp

Cả hai mở SecretVault. Người gửi vào **Gửi trực tiếp**, chọn tệp, nhập email người nhận đang online, rồi bấm **Gửi lời mời**. Không cần thêm danh bạ trước. Người nhận thấy thông báo lời mời ngay cả khi đang ở trang khác: bấm **Xem lời mời**, **Nhận tệp**, chờ tệp chuyển xong rồi **Tải xuống**. Những phiên đã kết thúc được gọn lại trong **Phiên trước đây**.

Giữ cả hai trang mở. Lời mời có hiệu lực 14 phút. Nếu tải lại trang, mất phiên hoặc server khởi động lại, tạo lời mời mới. Với người không online, dùng chia sẻ từ **Tệp của tôi**.

## Thùng rác và dung lượng

Tại tệp của bạn, mở dấu **…** rồi chọn **Chuyển vào thùng rác**. Mở **Thùng rác** ở thanh bên trên PC; trên điện thoại, mở từ **Tài khoản**.

Bấm **Khôi phục** để đưa tệp về kho. Các quyền chia sẻ chưa thu hồi cũng hoạt động lại. Thùng rác vẫn tính vào dung lượng; chưa có xóa vĩnh viễn trong UI này. Tài khoản mặc định có 100 MiB, toàn demo 512 MiB và tối đa 50 tài khoản. Nếu đầy, liên hệ quản trị viên để xem lại hạn mức.

## Quản trị

Dashboard tại https://secretvault-online.vercel.app/admin chỉ dành cho tài khoản đã được kích hoạt quản trị. Chủ ứng dụng dùng shortcut kích hoạt riêng được lưu trên máy; không gửi shortcut này cho người dùng khác.

Admin xem số tài khoản, dung lượng, tệp, sự kiện và phiên chuyển. Có thể điều chỉnh hạn mức hoặc tạm dừng tài khoản. Dashboard không cung cấp nội dung tệp đã giải mã hay khóa riêng.

## Khi có lỗi

- Sai email/mật khẩu: kiểm tra email và nút hiện mật khẩu; app không có nút đặt lại mật khẩu.
- Không thấy tệp được chia sẻ: mở **Đã nhận**, xác nhận đúng email tài khoản và bỏ bộ lọc. Danh sách tự cập nhật khi đang online; không cần tải lại cả trang.
- Người nhận ngoại tuyến: chuyển sang chia sẻ để mở sau hoặc chờ họ đăng nhập.
- Không xác minh được tệp/kết nối: thao tác dừng; thử lại và liên hệ admin nếu còn lỗi. Không bỏ qua kiểm tra bảo vệ.
- Mất mạng trong lúc upload: chờ thông báo, kiểm tra danh sách trước khi gửi lại. App chưa có tiếp tục upload xuyên lần đóng trang.

Đây là triển khai demo nhỏ. Render miễn phí có thời gian ngủ; app chưa có SLA luôn sẵn sàng, khôi phục mật khẩu hoặc kiểm toán bảo mật độc lập. Thử responsive không thay thế kiểm thử trên điện thoại vật lý.
