# SecretVault Online 3.0.1 — trạng thái bàn giao

Cập nhật ngày 30/10/2026, múi giờ Việt Nam.

## Dịch vụ đang dùng

- Web: https://secretvault-online.vercel.app
- Quản trị: https://secretvault-online.vercel.app/admin
- Python API: https://secretvault-api-thienphuc.onrender.com
- Nguồn: https://github.com/ntthienphuc/secretvault-app
- Vercel phục vụ web đã cập nhật từ commit `5ca2c3b`; tám tài nguyên web khớp mã nguồn sau chuẩn hóa xuống dòng.
- Render Free, Singapore, một instance; tự deploy đang tắt. Backend giữ phiên bản API 3.0.0 và commit runtime `cce9f743c9e570f4ea616b72bb71959052d14162`. Đợt polish này không đổi backend.
- Bucket HF riêng `thienphuc12339/secretvault-api-storage` giữ bản mã và snapshot. Token chỉ nằm ở secret của Render. Space thử nghiệm cũ vẫn dừng; không chạy hai writer cùng bucket.

## Bộ cài và tài khoản quản trị

Bộ cài hiện hành duy nhất: `release/SecretVault-Online-Setup-3.0.1-x64.exe`. Gói dùng ngay và báo cáo/slide: `deliverables/SecretVault_Online/`. App dùng Edge WebView2 để mở cùng web và dữ liệu online; máy client không cần Python, host LAN hay chứng chỉ nội bộ.

Đã build, cài vào thư mục QA, chạy chẩn đoán, gỡ QA và cập nhật app tại máy Windows hiện có. Sau đó đăng nhập, tải tệp đã upload từ Chrome và lưu qua Save As thật; bản lưu 107 byte khớp SHA-256 với bản gốc. Đây không phải kiểm thử trên Windows sạch. Bộ cài chưa ký số.

Chủ hệ thống vẫn cần kích hoạt quản trị một lần bằng shortcut riêng `.local/Kich-hoat-quan-tri.url`. Tạo hoặc đăng nhập tài khoản của chính chủ rồi kích hoạt. Mã không nằm trong bộ cài hay gói chia sẻ. Đăng ký thông thường không cấp quyền admin; tài khoản QA không được dùng để chiếm quyền chủ production.

Kho LAN cũ và dữ liệu tài khoản thật được giữ riêng, không di chuyển vào kho online.

## Kiểm chứng ngày 30/10/2026

| Nhóm | Kết quả | Bằng chứng trong `audit/review-20261030/` |
|---|---|---|
| Tích hợp API và mật mã online | 41/41 | `integration-live.json` |
| Đọc lại fixture đã lưu trước đây | 5/5 | `readback-live.json` |
| Endpoint, ACL và CORS online | 11/11 | `endpoints.json` |
| Tài nguyên web trùng nguồn | 8/8 | `web-and-health.json` |
| Tích hợp local | 41/41 | `integration-local.json` |
| Admin và quota local | 12/12 | `policy-local.json` |
| Thùng rác và quyền local | 8/8 | `trash-policy.json` |
| Persistence, bucket và availability | 5 + 5 + 5 | `cloud-*-results.json` |
| Hồi quy vòng đời phiên và UI | 11/11 | `web-regressions.json` |
| Cài đặt và tải xuống Windows | Đạt tại máy hiện có | `installer-flow.json`, `windows-download.json` |

Có 65 lượt kiểm tra online và 87 lượt local; một số tình huống lặp giữa môi trường nên không cộng thành số ca bảo mật độc lập. Các lỗi bucket được mô phỏng có kiểm soát ở local. Đợt này không restart Render; bằng chứng restart thật của đợt trước ở `audit/cloud-production-restart-results.json`.

Chrome đã được thao tác thực tế: đăng ký, xác nhận mật khẩu sai, đăng nhập đúng/sai, chọn tệp từ ổ đĩa, chia sẻ, người gửi đăng xuất, người nhận mở tệp, thùng rác/khôi phục, gửi trực tiếp đến trạng thái Đã nhận, dashboard admin local. Viewport 390 × 844 không tràn ngang; chưa thử điện thoại vật lý. App Windows hoàn tất tải tệp và lưu xuống đĩa.

10 yêu cầu health khi dịch vụ đã hoạt động có trung vị 84.04 ms, khoảng 78.41–254.92 ms. Đây không phải benchmark upload hay nhiều người dùng đồng thời.

## Giới hạn vận hành

25 MiB/tệp, mặc định 100 MiB/tài khoản, 512 MiB toàn ứng dụng và tối đa 50 tài khoản. Thùng rác vẫn tính quota. Đây là giới hạn do ứng dụng đặt, không phải dung lượng nhà cung cấp cam kết.

Render Free có thể ngủ sau 15 phút không hoạt động và cần khoảng một phút để thức dậy: https://render.com/docs/free. Ghi bucket có thể mất thêm vài giây. Bản này phù hợp demo đồ án; chưa có xác minh email, khôi phục mật khẩu, kiểm toán mật mã độc lập, kiểm thử tải lớn đồng thời hoặc SLA luôn sẵn sàng.
