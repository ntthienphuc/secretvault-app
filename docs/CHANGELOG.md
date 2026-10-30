# Thay đổi SecretVault

## Web/API và Windows Online 3.2.0 ngày 30/10/2026

- Giữ phiên qua F5; tùy chọn nhớ thiết bị tối đa 7 ngày, không lưu mật khẩu.
- IndexedDB bọc dữ liệu mở khóa; đăng xuất xóa cache và khóa các tab cùng tài khoản.
- Hash token nhớ thiết bị được lưu bền vững, hết hạn cố định; snapshot v3 đọc v1/v2.
- Dọn snapshot bucket ở nền, bỏ list metadata khỏi từng request ghi; vẫn xác minh snapshot trước thành công.
- Phân biệt RAM server với quota tệp; giá nâng cấp và giới hạn trong SESSION_AND_PERFORMANCE.md.
- Bộ cài Windows 3.2.0 dùng hồ sơ WebView2 bền vững; đã thử đóng/mở lại sau khi chọn ghi nhớ. Cần cập nhật launcher 3.0.1 để dùng tính năng này qua các lần mở app.

## Web/API 3.1.0 ngày 30/10/2026

- Hai tab gửi trực tiếp và nhận sau; tự chuyển tab khi người nhận offline, giữ tệp/email.
- Gửi nhận sau tự lưu tệp vào kho và có thể tái dùng tệp đã lưu.
- Người nhận chọn tải về hoặc tạo bản riêng có mã hóa mới trong hạn mức của họ.
- Xác nhận nhận/lưu, thông báo bền vững, trạng thái từng người; không xác nhận chỉ vì mở danh sách.
- Xóa vĩnh viễn từ Thùng rác giải phóng quota; dọn bản mã qua hàng đợi bền vững.
- Snapshot v2 đọc được dữ liệu v1 cũ; không rollback về backend 3.0 sau migration.
- App Windows Online vẫn dùng bộ cài 3.0.1 và tải web mới khi mở lại.


## Giao diện web cập nhật 30/10/2026

- Tập trung ba luồng: Tệp của tôi, Đã nhận và Gửi trực tiếp; khu tải tệp nằm ở giữa nội dung và chuyển sang bước chia sẻ khi tải xong.
- Mỗi dòng tệp ưu tiên một nút Chia sẻ hoặc Tải xuống; thao tác còn lại đặt trong dấu …, bộ lọc và sắp xếp thu vào một menu.
- Chia sẻ và gửi trực tiếp bằng email, không bắt buộc thêm danh bạ. Xác nhận rõ tên/email người nhận khi chia sẻ thành công.
- Lời mời nhận tệp xuất hiện trên các trang; ưu tiên phiên đang diễn ra, thu gọn phiên cũ.
- Bố cục, chữ, khoảng cách, trạng thái rỗng, thanh điều hướng điện thoại và hộp thoại được thiết kế lại đồng bộ.
- Đưa focus về nội dung sau đăng nhập, giữ focus bàn phím trong hộp thoại, chặn nút khi đang xử lý và đóng bộ lọc sau khi chọn.
- Bộ cài Windows Online vẫn là 3.0.1, tải giao diện mới từ web; không thay đổi API Python hoặc thuật toán mã hóa.
- Hướng dẫn sử dụng được cập nhật. Báo cáo và slide 3.0.1 đã xuất trước đợt UI này giữ nguyên ảnh minh họa của lần xuất trước.


## Online 3.0.1 ngày 30 tháng 10 năm 2026

- Dọn liên kết và URL chứa bản rõ ngay khi đăng xuất, khi đóng thẻ tải hoặc khi hết hạn.
- Ngăn phản hồi tải lại từ phiên cũ khôi phục trạng thái tài khoản đã đăng xuất.
- Timeout API bao phủ cả thời gian nhận nội dung phản hồi.
- Ngăn thao tác chồng nhau khi ghi dữ liệu; phiên gửi trực tiếp lỗi không tự lặp lại với bí mật phiên đã hủy.
- Thêm Thùng rác ở điều hướng chính, lối mở nhanh và trạng thái rỗng rõ ràng.
- Sửa bộ lọc không có kết quả, bổ sung nút xóa bộ lọc và dung lượng ngay dưới tên tệp trên điện thoại.
- Thêm hiện/ẩn mật khẩu, tăng độ tương phản, làm gọn màn hình đăng nhập điện thoại, giữ focus trong hộp thoại chia sẻ.
- Bộ cài Windows Online 3.0.1 và web dùng chung dịch vụ. API Python giữ phiên bản giao thức 3.0.0.
- Thống nhất tài liệu Online, báo cáo và slide; tách các bộ cài LAN cũ khỏi phần bàn giao.

Tham khảo bằng chứng kiểm thử theo ngày tại `audit/review-20261030/`. Việc đổi giao diện không thay đổi các thuật toán hoặc dữ liệu tài khoản hiện có.
