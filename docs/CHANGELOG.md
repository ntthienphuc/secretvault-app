# Thay đổi SecretVault

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
