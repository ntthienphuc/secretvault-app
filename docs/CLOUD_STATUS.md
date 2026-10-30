# SecretVault web/API 3.2 — trạng thái bàn giao

Cập nhật ngày 30/10/2026, múi giờ Việt Nam.

## Dịch vụ đang dùng

- Web: https://secretvault-online.vercel.app
- Quản trị: https://secretvault-online.vercel.app/admin
- Python API: https://secretvault-api-thienphuc.onrender.com
- Nguồn: https://github.com/ntthienphuc/secretvault-app
- Vercel phục vụ giao diện hai tab gửi từ commit `d3f2a5a`; cả năm tài nguyên thay đổi khớp mã nguồn sau chuẩn hóa xuống dòng.
- Render Free, Singapore, một instance; tự deploy đang tắt. Backend API 3.2.0, commit runtime `82cabb4`, đã deploy thành công và kiểm tra health ngày 30/10/2026. Backend đọc được snapshot cũ; sau khi có snapshot v2 không quay về runtime 3.0.0.
- Bucket HF riêng `thienphuc12339/secretvault-api-storage` giữ bản mã và snapshot. Token chỉ nằm ở secret của Render. Space thử nghiệm cũ vẫn dừng; không chạy hai writer cùng bucket.

## Cập nhật phiên đăng nhập 3.2

F5 giữ phiên trong tab; tùy chọn nhớ thiết bị 7 ngày khôi phục qua restart. Ghi nhớ không lưu mật khẩu, dùng cache bọc mã trên hồ sơ trình duyệt. Snapshot v3 đọc v1/v2; không rollback về 3.1/3.0. Đã chạy 109 lượt kiểm thử local, gồm 16 kiểm tra mới về cache và session, 4 kiểm tra retention nền; đây là lượt kiểm thử chứ không phải 109 chứng minh bảo mật độc lập. Bằng chứng ở audit/review-session-20261030/.

Chrome local đã thử F5 ở cả hai chế độ, tab mới, nhớ qua restart server, tải lên sau khôi phục khóa và đăng xuất đồng bộ hai tab. Production đã thử F5, khôi phục Alice QA, giải mã tệp cũ và đăng xuất rồi F5 không tự mở lại. Render deploy `dep-dbi35kqjnfac73cmdep0` xác nhận Live.

Hai mẫu đo upload 256 KiB: 21.343 giây trước, 20.385 giây sau; login 7.398 và 7.272 giây. Chênh nhỏ, không cam kết cải thiện ổn định. Resume qua bootstrap tránh login lại. Chưa nâng cấp gói trả phí. Xem SESSION_AND_PERFORMANCE.md để biết nguyên nhân, giới hạn, chi phí và cách nâng cấp có tác dụng.

## Bộ cài và tài khoản quản trị

Bộ cài hiện hành duy nhất: `release/SecretVault-Online-Setup-3.2.0-x64.exe`. Gói dùng ngay và báo cáo/slide: `deliverables/SecretVault_Online/`. App dùng Edge WebView2 để mở cùng web và dữ liệu online; máy client không cần Python, host LAN hay chứng chỉ nội bộ.

Bản 3.2.0 đã cài thử thành công, chẩn đoán web/API 200; GUI Windows đã đăng nhập Bob QA, xác nhận tùy chọn nhớ 7 ngày, đóng hẳn rồi mở lại tự vào kho, sau đó đăng xuất. Đã cập nhật bản cài chính tại `%LOCALAPPDATA%\Programs\SecretVaultOnline`, registry hiển thị 3.2.0 và chẩn đoán đạt. Thử nghiệm trên máy Windows hiện có, chưa phải Windows sạch hoặc tải nhiều người đồng thời. Bộ cài trước được lưu trong archive; báo cáo/slide 3.0.1 được giữ làm bản xuất lịch sử và hướng dẫn mới mô tả 3.2.

Ở đợt 3.0.1 đã build, cài vào thư mục QA, chạy chẩn đoán, gỡ QA và cập nhật app tại máy Windows hiện có. Sau đó đăng nhập, tải tệp đã upload từ Chrome và lưu qua Save As thật; bản lưu 107 byte khớp SHA-256 với bản gốc. Đây không phải kiểm thử trên Windows sạch. Bộ cài chưa ký số.

Chủ hệ thống vẫn cần kích hoạt quản trị một lần bằng shortcut riêng `.local/Kich-hoat-quan-tri.url`. Tạo hoặc đăng nhập tài khoản của chính chủ rồi kích hoạt. Mã không nằm trong bộ cài hay gói chia sẻ. Đăng ký thông thường không cấp quyền admin; tài khoản QA không được dùng để chiếm quyền chủ production.

Kho LAN cũ và dữ liệu tài khoản thật được giữ riêng, không di chuyển vào kho online.

## Đợt hai tab gửi và xác nhận nhận tệp, 30/10/2026

Gửi trực tiếp dùng Diffie–Hellman tạm thời; gửi để nhận sau dùng ElGamal Hybrid để bọc khóa AES. UI không hiển thị khóa. Nếu người nhận offline khi gửi lời mời, app giữ tệp/email và chuyển tab; người gửi xác nhận trước khi tải lên kho.

Nhận sau tự lưu vào kho người gửi. Người nhận chọn tải về thiết bị hoặc lưu bản riêng vào kho của mình. Bản riêng có khóa và ID mới, vẫn còn khi bản gốc bị xóa. Chuông thông báo và trạng thái từng người được lưu bền vững. Xác nhận tải có nghĩa client đã giải mã và chuẩn bị tải; không chứng minh hệ điều hành đã ghi xong xuống đĩa. Xóa vĩnh viễn qua Thùng rác giải phóng quota; hàng đợi dọn bản mã sẽ thử lại nếu bucket lỗi.

Đợt này có 84 lượt kiểm tra tự động tại môi trường local: luồng nhận/ACL/quota/xóa 17, tích hợp mật mã 41, hồi quy web 11, migration/receipt persistence 4, persistence nền 5, bucket 6. Bằng chứng ở `audit/review-delivery-20261030/`. Đây là các lượt kiểm thử, không phải 84 chứng minh an toàn mật mã độc lập.

Đã thao tác hai tài khoản trên Chrome: tạo tài khoản, offline fallback giữ tệp/email, gửi và tự lưu vào kho, tải tệp nhận, lưu bản riêng, hai thông báo cho người gửi, thùng rác và tải bản riêng sau khi bản gốc vào thùng rác, gửi trực tiếp đến trạng thái đã nhận. Xóa vĩnh viễn được kiểm thử qua API ở dữ liệu QA cô lập; không bấm xóa dữ liệu production. Viewport 390 × 844 và popover thông báo không tràn ngang; chưa thử điện thoại vật lý.

Production API đạt 8/8 kiểm tra trong `production.json`: health 3.1, đăng nhập và mở khóa tài khoản cũ, giải mã fixture ba chunk trước migration đúng từng byte, đọc fixture mới từ bucket, ElGamal cho đúng người nhận, xác nhận tải idempotent, lưu bản riêng có mã hóa mới và thông báo, đọc lại bản riêng và không nhân đôi khi lưu lại. Script QA ban đầu dùng sai tên trường liên kết notification; đã sửa assertion sang `file_id` và chạy lại đạt. Không xóa dữ liệu production; chỉ thêm fixture QA rất nhỏ. Năm tài nguyên web đã thay đổi được so khớp 5/5 (`web-parity.json`).

Hướng dẫn hành vi hiện hành: `docs/SENDING_AND_RECEIPTS.md`, `docs/HUONG_DAN_SU_DUNG.md`. Bộ cài Windows vẫn là launcher Online 3.0.1, tải giao diện mới từ web; đợt này không build/cài lại launcher. Báo cáo và slide 3.0.1 trong gói bàn giao là bản xuất trước khi thêm receipts và bản sao riêng; dùng hướng dẫn bổ sung mới để đọc các thay đổi.

## Kiểm chứng đợt trước trong ngày 30/10/2026 (mốc 3.0.1)

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
