# SecretVault 2.1 — giao diện tùy biến

> Hồ sơ thiết kế lịch sử của bản LAN 2.1. Bản Online 3.0.1 hiện dùng `web/`, tự xử lý khóa, có dashboard admin riêng và không có Crypto Inspector cho người dùng. Xem [thay đổi hiện hành](CHANGELOG.md), [hướng dẫn sử dụng](HUONG_DAN_SU_DUNG.md) và [kiểm thử ngày 30/10](CLOUD_STATUS.md).

Tham khảo chính: [Proton Drive](https://proton.me/drive), cụ thể hình sản phẩm quản lý tệp trên trang chính thức, được xem ngày 26/10/2026. Điểm tham khảo là nền sáng, tông lavender, sidebar tập trung vào file và cách chuyển giữa bảng/thẻ. Tên, biểu tượng, minh họa, nội dung và mã giao diện thuộc nhận diện SecretVault riêng.

## Những phần được thiết kế lại

- Đăng nhập/đăng ký chia hai vùng: minh họa riêng tư và form rõ ràng.
- Sidebar, breadcrumb, tìm kiếm, số liệu từ vault thật và banner thích ứng khi đã có file.
- Danh sách/lưới, lọc loại tệp, sắp xếp theo tên/thời gian/dung lượng và vùng kéo thả.
- Thẻ danh bạ và bước xác nhận fingerprint.
- Form gửi live, trạng thái phiên và hướng dẫn gọn theo luồng sử dụng.
- Modal chia sẻ offline và Crypto Inspector dạng ngăn bên.
- Tài khoản/kết nối và màu của launcher PC.

Không thêm màn hình hay thuật toán môn học ngoài phạm vi đã chốt: khóa công khai, DH live, ElGamal offline. Logic mã hóa vẫn nằm trong module có sẵn.

## Tài nguyên và hoạt động offline

- `public/src/icons.js`: icon SVG được định nghĩa trong mã nguồn.
- `public/assets/vault-art.svg`: minh họa vector riêng cho SecretVault.
- Font Be Vietnam Pro được tải từ [Google Fonts repository](https://github.com/google/fonts/tree/main/ofl/bevietnampro), kèm `OFL.txt` tại `public/assets/fonts`. Font được đóng gói cùng app, không phụ thuộc CDN khi chạy.
- Không nhúng hình/logo của ứng dụng tham khảo vào bản phát hành.

Source bản trước giao diện được giữ tại `archive/v2_before_ui_refresh`. Installer 2.1 dùng cùng thư mục dữ liệu v2 để cập nhật mà không đổi cấu trúc mật mã.
