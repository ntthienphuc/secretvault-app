# Hướng dẫn SecretVault Online

Cập nhật ngày 30/10/2026 sau đợt thiết kế lại giao diện. Web và app Windows Online 3.0.1 tải cùng giao diện mới; không cần cài lại app.

## Mở ứng dụng

Truy cập https://secretvault-online.vercel.app bằng Chrome hoặc Edge trên PC; dùng trình duyệt hiện đại trên điện thoại. Trên Windows x64, chạy bộ cài SecretVault-Online-Setup-3.0.1-x64.exe rồi mở SecretVault Online. Máy khách không cần Python hay server riêng. Web và app cùng tài khoản, tệp và danh bạ; hai người không cần cùng mạng.

Lần mở đầu có thể phải chờ máy chủ miễn phí thức dậy. Đợi dòng **Đã kết nối an toàn** rồi đăng nhập; nếu thất bại, bấm **Kết nối lại**. Nếu cửa sổ Windows không mở được WebView2, chọn mở bản web khi ứng dụng đề nghị.

## Tài khoản

Chọn **Tạo tài khoản**, nhập tên, email và mật khẩu ít nhất 10 ký tự, rồi nhập lại mật khẩu. Nút **Hiện/Ẩn** giúp kiểm tra mật khẩu đang gõ. Giữ mật khẩu ở nơi an toàn: bản demo chưa xác minh email và chưa hỗ trợ khôi phục mật khẩu.

Đăng nhập cùng tài khoản trên thiết bị khác để mở tệp đã lưu. F5/tải lại trang giữ phiên trong tab hiện tại, tối đa 12 giờ. Chọn **Ghi nhớ trên thiết bị này trong 7 ngày** khi đăng nhập để mở lại cả sau khi đóng tab/app hoặc server khởi động lại. Chỉ chọn trên thiết bị cá nhân; ai dùng được hồ sơ trình duyệt này có thể mở kho. App không lưu mật khẩu. Khi dùng máy chung, mở **Tài khoản**, rồi bấm **Đăng xuất**. Trên PC, bấm tên của bạn ở góc dưới thanh bên; trên điện thoại, dùng mục **Tài khoản** ở thanh dưới. Liên kết tải tệp đã giải mã trong app được dọn khi đăng xuất; những bản đã lưu trong Downloads vẫn do bạn quản lý.

## Lưu và nhận tệp

1. Trong **Tệp của tôi**, bấm **Tải tệp lên** hoặc kéo thả. Có thể chọn nhiều tệp; app xử lý lần lượt.
2. Chờ thông báo đã tải lên. Mỗi tệp tối đa 25 MiB; tên tệp tối đa 240 ký tự.
3. Tìm bằng ô **Tìm tệp** ngay trên danh sách. Mở biểu tượng **Lọc và sắp xếp** để chọn tài liệu/hình ảnh hoặc tên/ngày. Nếu không thấy kết quả, bấm **Xóa bộ lọc**.
4. Với tệp của bạn, mở dấu **…** ở cuối dòng và chọn **Tải xuống**. Với tệp người khác gửi, mở **Đã nhận → Nhận tệp → Tải về thiết bị**. App kiểm tra và giải mã trên thiết bị rồi chuyển tệp cho trình duyệt lưu.
5. Nếu trình duyệt chưa tải, dùng nút **Lưu tệp** xuất hiện bên dưới. Liên kết này hết hạn sau hai phút; bấm tải lại nếu cần. Chọn nơi lưu khi trình duyệt hoặc app hỏi.

## Hai tab gửi tệp

Mở **Gửi tệp** để chọn:

- **Gửi trực tiếp:** cả hai online. Chọn tệp từ thiết bị, nhập email, bấm **Gửi lời mời**. Người nhận mở lời mời, **Nhận tệp**, chờ chuyển xong rồi **Tải xuống**. Giữ cả hai trang mở; tệp không tự lưu vào kho.
- **Gửi để nhận sau:** chọn tệp và email rồi **Gửi tệp**. App tự lưu vào **Tệp của tôi** trước khi gửi. Bạn cũng có thể mở **Hoặc chọn từ Tệp của tôi** để dùng tệp đã có, không tải trùng. Người nhận không cần online lúc gửi.

Nếu khi gửi trực tiếp app phát hiện người nhận offline, app chuyển sang tab nhận sau và giữ tệp, email. Bấm **Gửi tệp** để xác nhận gửi theo cách này. Trạng thái online có độ trễ tối đa khoảng 20 giây; phiên đã bắt đầu truyền chưa tự chuyển giữa chừng.

Lời mời trực tiếp có hiệu lực 14 phút. Nếu tải lại trang hoặc mất phiên, tạo lời mời mới. Chia sẻ nhận sau cho phép người gửi đóng app sau khi báo gửi thành công.

## Người nhận: tải về hoặc lưu riêng

Mở **Đã nhận → Nhận tệp**:

1. **Tải về thiết bị:** nhận bản giải mã để trình duyệt lưu. Không dùng dung lượng kho của bạn. Nếu chưa tải, bấm **Lưu tệp** trong thẻ hiện ra.
2. **Lưu vào Tệp của tôi:** tạo một bản riêng có chủ sở hữu là bạn, dùng dung lượng kho của bạn. Người gửi xóa bản gốc hoặc thu hồi quyền thì bản riêng này vẫn còn. Nếu hết dung lượng, vẫn có thể chọn tải về thiết bị.

Chỉ mở danh sách chưa được tính là đã nhận. Người gửi có xác nhận khi app người nhận đã giải mã và chuẩn bị tệp tải, hoặc đã lưu bản riêng hoàn tất. Xác nhận tải không chứng minh hệ điều hành đã ghi xong tệp xuống đĩa.

## Theo dõi người đã nhận

Bấm chuông **Thông báo**. Xác nhận được lưu lại kể cả khi bạn đóng app và sẽ xuất hiện khi đăng nhập lần sau. Mở **Chia sẻ → Ai có quyền xem** để thấy từng người đang chờ, đã nhận để tải, hay đã lưu vào kho. Có thể **Thu hồi** để chặn những lần tải tiếp; không xóa bản họ đã tải/lưu riêng.

## Thùng rác và dung lượng

Mỗi người mặc định có **100 MiB**, mỗi tệp tối đa **25 MiB**; toàn demo **512 MiB**, tối đa **50 tài khoản**. Admin có thể điều chỉnh hạn mức. Kho tính cả byte bảo vệ của bản mã và phần dung lượng giữ trước cho upload đang chạy.

Tại tệp của bạn, mở dấu **… → Chuyển vào thùng rác**. Hộp xác nhận cho biết bao nhiêu người đã nhận/lưu. Tệp trong Thùng rác vẫn tính dung lượng và có thể **Khôi phục**; quyền chia sẻ chưa thu hồi cũng hoạt động lại.

Muốn giải phóng dung lượng, mở **Thùng rác → Xóa vĩnh viễn**, đọc cảnh báo rồi xác nhận. Không thể khôi phục bản đã xóa vĩnh viễn. Người nhận sẽ mất quyền tải từ bản gốc, nhưng bản họ đã tải về hoặc lưu riêng vẫn còn. Trên điện thoại, mở Thùng rác từ **Tài khoản**.

Chi tiết hai cơ chế mật mã, xác nhận và quyền sở hữu: [Hai cách gửi và nhận](SENDING_AND_RECEIPTS.md).

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
