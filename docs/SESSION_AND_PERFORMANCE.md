# Phiên đăng nhập và tốc độ — 30/10/2026

Web/API và launcher Windows Online 3.2.0. Bộ cài mới dùng hồ sơ WebView2 bền vững cho lựa chọn ghi nhớ; bản 3.0.1 cũ vẫn chạy riêng tư và không giữ dữ liệu sau khi đóng app.

## F5 và ghi nhớ thiết bị

- Phiên mặc định giữ qua F5 trong tab hiện tại, hết hạn tối đa 12 giờ. Đóng tab kết thúc khả năng tự mở lại thông thường; trình duyệt có chức năng khôi phục phiên có thể khôi phục cả tab.
- Chọn **Ghi nhớ trên thiết bị này trong 7 ngày** khi đăng nhập/đăng ký để mở lại trong cùng hồ sơ trình duyệt, kể cả sau khi server ngủ/khởi động lại. Mốc hết hạn cố định, không tự kéo dài sau mỗi F5.
- App không ghi mật khẩu hoặc authProof vào browser storage. IndexedDB lưu khóa AES thiết bị không xuất được qua Web Crypto, dữ liệu mở kho/token được bọc AES-GCM, và signing CryptoKey không xuất được. Tab thường cần thêm mã ngẫu nhiên trong sessionStorage; chế độ ghi nhớ mới có mục dùng chung giữa các tab.
- Đây là tin cậy hồ sơ trình duyệt, không phải chứng minh ràng buộc phần cứng hay chống mọi XSS. Ai sử dụng được hồ sơ đã mở khóa có thể mở kho. Dùng máy chung thì không chọn ghi nhớ và đăng xuất khi xong.
- Đăng xuất xóa cache thiết bị, gửi thu hồi token lên server, báo các tab cùng tài khoản khóa lại. Server chỉ lưu hash của token nhớ thiết bị. Tài khoản tạm dừng hoặc token hết hạn không thể khôi phục. Nếu đang mất mạng, truy cập tại thiết bị vẫn được xóa ngay; server chỉ thu hồi được khi nhận yêu cầu.
- Chỉ giữ được tệp đã lưu; F5 không khôi phục bí mật của phiên DH trực tiếp hoặc upload đang dở.

Snapshot v3 bổ sung remembered_sessions, đọc được snapshot v1/v2. Không rollback về API 3.1/3.0 sau khi ghi v3. Một writer duy nhất cho bucket.

## Vì sao chậm và phần đã tối ưu

Render Free hiện là 0.1 CPU, RAM 512 MB; filesystem tạm thời. Bản mã và metadata bền vững nằm ở bucket Hugging Face riêng. RAM 512 MB khác với giới hạn lưu tệp 512 MiB do app đặt.

Trước tối ưu, một phép đo production ghi nhận health đầu tiên 42.548 giây (cold start), login 7.398 giây, bootstrap 0.130 giây. Tệp 256 KiB mất 5.858 giây tạo upload + 9.364 giây lưu chunk + 6.121 giây commit = 21.343 giây, chưa tính thao tác người dùng. Đây là một mẫu đo, không phải SLA hoặc benchmark tải đồng thời.

Mỗi ghi dữ liệu phải hoàn tất upload và kiểm chứng snapshot từ bucket. Phiên được khôi phục dùng bootstrap, không cần lại password KDF hoặc snapshot login. Dọn snapshot cũ được chuyển khỏi đường chờ của request; không list toàn thư mục metadata mỗi lần ghi. Vẫn giữ kiểm chứng bền vững trước trả thành công; worker chỉ dọn bản cũ đã được thay bởi ít nhất ba snapshot mới hơn. Dọn thất bại được thử lại sau commit/khi khởi động.

Các lượt ghi upload vẫn cần đi đến HF; nâng CPU đơn lẻ không loại bỏ độ trễ mạng này. Nếu cần nhanh rõ rệt và ổn định cho demo, ưu tiên compute luôn chạy và lưu trữ gần backend (persistent disk/database), có quy trình di chuyển và backup trước khi đổi.

## Giới hạn và giá đã đối chiếu

Hạn mức ứng dụng: 25 MiB/tệp, mặc định 100 MiB/người, tổng 512 MiB, tối đa 50 tài khoản. Không tăng các hạn mức này trong đợt tối ưu.

- Render Free $0, ngủ sau 15 phút không có traffic; thức dậy khoảng một phút: https://render.com/docs/free
- Render 0.5c-512mb (tên cũ Starter): $7/tháng, 0.5 CPU / 512 MB RAM. 1c-2g: $25/tháng, 1 CPU / 2 GB RAM. Đã nhìn thấy trực tiếp ở Compute của dịch vụ hiện tại. Persistent disk $0.25/GB/tháng: https://render.com/pricing
- Phương án 0.5c-512mb + disk 5 GB: $8.25/tháng trước thuế/phí băng thông vượt mức; cần chuyển dữ liệu sang disk, không tự nhanh chỉ nhờ gắn disk.
- Vercel Hobby $0 phù hợp web demo tĩnh; Pro $20/tháng nhưng không làm Python Render hay ghi HF nhanh hơn: https://vercel.com/pricing
- HF Free có 100 GB private storage cấp tài khoản, dùng chung các repo/bucket; không phải hạn mức riêng được cấp thêm cho SecretVault. Xem https://huggingface.co/docs/hub/storage-limits . Không đổi quyền hoặc gói HF.

Giá USD đã kiểm tra ngày 30/10/2026; chi phí thực tế phụ thuộc thuế và usage. Không mua hoặc nâng cấp gói trả phí trong đợt này.

## Đo sau tối ưu

Một mẫu tương tự trên production 3.2: login 7.272 giây; upload 256 KiB 5.632 + 9.059 + 5.694 = 20.385 giây, so với 21.343 giây trước đó. Chênh khoảng 4.5% ở mẫu này, chưa đủ để khẳng định cải thiện ổn định. Bootstrap 0.156 giây; khôi phục phiên tránh phải login lại và thực hiện KDF. Hai mẫu không kiểm soát tải HF/Render nên không dùng làm benchmark so sánh chính thức. Điểm chậm chính vẫn là ghi/kiểm chứng qua HF.
