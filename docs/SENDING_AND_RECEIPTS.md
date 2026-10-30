# Hai cách gửi và xác nhận nhận tệp

Cập nhật 30/10/2026 — API 3.1.0, web mới; app Windows Online 3.0.1 mở cùng web.

## Trải nghiệm người dùng

Vào **Gửi tệp** để chọn một trong hai tab:

| Tab | Khi nào dùng | Tệp nằm ở đâu |
|---|---|---|
| Gửi trực tiếp | Cả hai đang online và giữ trang mở | Chuyển qua vùng relay tạm; không tự thêm vào kho |
| Gửi để nhận sau | Không cần hai người online cùng lúc | Tự lưu bản mã vào Tệp của tôi của người gửi, rồi cấp quyền cho người nhận |

Nếu lúc gửi lời mời người nhận offline, app tự chuyển sang tab nhận sau, giữ nguyên tệp và email. Người dùng bấm **Gửi tệp** để xác nhận lưu vào kho và gửi theo cách này. Trường hợp trạng thái online thay đổi giữa lúc tìm email và gửi lời mời cũng được backend kiểm tra lại. Trạng thái online dựa trên hoạt động phiên trong 20 giây gần nhất, không phải bằng chứng thiết bị luôn có kết nối.

Tab nhận sau cũng cho chọn tệp đã có trong Tệp của tôi để tránh tải trùng. Nếu tệp đã tải xong nhưng bước chia sẻ lỗi, bản tải lên vẫn ở kho; bản nháp trong trang giữ ID để thử lại. Nếu đóng trang, chọn lại tệp từ kho.

## Người nhận chọn tải hay lưu

Mở **Đã nhận → Nhận tệp**:

- **Tải về thiết bị:** app lấy bản mã, xác minh và giải mã ở thiết bị, tạo liên kết tải. Không dùng dung lượng kho của người nhận. Xác nhận cho người gửi có nghĩa app đã giải mã thành công và chuẩn bị tệp tải, không chứng minh trình duyệt đã ghi xong xuống ổ đĩa.
- **Lưu vào Tệp của tôi:** app giải mã tại thiết bị, tạo khóa tệp mới và mã hóa lại vào một tệp mới do người nhận sở hữu. Chỉ sau khi commit bản sao bền vững, server ghi xác nhận đã lưu. Bản riêng vẫn dùng được khi người gửi thu hồi quyền hoặc xóa bản gốc.

Chỉ nhìn danh sách hay mở hộp nhận tệp chưa tạo xác nhận. Xác nhận là thông báo do ứng dụng khách gửi qua phiên có xác thực; đây không phải bằng chứng chống chối bỏ hay chứng minh người dùng đã đọc nội dung. API chỉ cho người nhận đúng lượt chia sẻ xác nhận. Trạng thái đã lưu chỉ do quy trình commit bản sao tạo ra.

Người gửi xem chuông **Thông báo** và trạng thái từng người trong **Chia sẻ → Ai có quyền xem**. Đánh dấu đã đọc chỉ tác động thông báo của chính tài khoản đó. Gửi lại cùng yêu cầu xác nhận không tạo nhiều thông báo giống nhau.

## Hai cơ chế mật mã trong đồ án

### Trực tiếp: Diffie–Hellman tạm thời

Người gửi sinh bí mật a và công khai A = g^a mod p; người nhận sinh b và B = g^b mod p. Hai bên tự tính cùng bí mật Z = B^a = A^b mod p. App kiểm tra phần tử nhóm trước khi dùng và dẫn xuất khóa phiên bằng HKDF-SHA256, gắn với nội dung bắt tay và nonce của cả hai bên.

Khóa phiên bảo vệ các chunk bằng AES-256-GCM. Lời mời, chấp nhận và thông tin hoàn tất được ký bằng danh tính đã đăng ký. IV theo chunk và dữ liệu xác thực bổ sung ràng buộc tệp với đúng phiên, thứ tự chunk và tổng số chunk. Sau khi người nhận giải mã và xác nhận, relay xóa payload tạm. Hai bí mật a, b không được gửi lên server.

### Nhận sau: ElGamal Hybrid

Tệp được mã hóa bằng một khóa AES ngẫu nhiên K. Người gửi dùng khóa công khai ElGamal y = g^x của người nhận, chọn số ngẫu nhiên r mới, tính c1 = g^r và Z = y^r. HKDF-SHA256 biến Z cùng salt và ngữ cảnh chia sẻ thành khóa để bọc K bằng AES-GCM. Người nhận dùng khóa riêng x tính lại Z = c1^x, mở lớp bọc để lấy K rồi giải mã tệp.

Đây là ElGamal Hybrid (KEM/DEM), không áp dụng công thức nhân ElGamal cổ điển trực tiếp lên toàn bộ byte của tệp. Người nhận không cần online khi người gửi tạo lớp bọc. Ngữ cảnh lớp bọc ràng buộc ID tệp, người gửi, người nhận, dấu vân tay danh tính và hash manifest. Chữ ký bảo vệ manifest và lớp bọc khỏi bị sửa.

Các thuật toán nằm trong `web/src/crypto.js`; luồng xử lý ở `web/src/app.js`. Backend Python lưu bản mã và kiểm tra quyền; không cần nhận khóa giải mã tệp. Tên tệp, kích thước, tài khoản và trạng thái chia sẻ vẫn là metadata server biết. Khóa công khai là thành phần của cả hai cơ chế, không phải một cách gửi thứ ba.

## Dung lượng và xóa

- Tối đa 25 MiB/tệp; mặc định 100 MiB/người. Admin có thể đổi hạn mức. Tổng demo 512 MiB, tối đa 50 tài khoản.
- Kho tính byte bản mã, gồm tag xác thực; upload đang chạy giữ trước phần dung lượng còn cần để tránh hai upload đồng thời vượt hạn mức.
- Bản gửi nhận sau dùng dung lượng người gửi. Người nhận chỉ dùng dung lượng riêng khi chọn lưu vào kho.
- Lưu lại cùng lượt chia sẻ trả về bản sao hiện có, không tạo bản thứ hai. Bản sao trong Thùng rác có thể được khôi phục bởi quy trình lưu lại.
- Chuyển vào Thùng rác tạm dừng quyền tải từ bản gốc và vẫn tính dung lượng. **Xóa vĩnh viễn** trong Thùng rác mới giải phóng hạn mức; thao tác có hộp xác nhận.
- Xóa bản của người gửi không thể xóa bản người khác đã tải hoặc lưu riêng. Nếu người nhận chưa giữ bản riêng, việc xóa/thu hồi sẽ chặn tải tiếp.
- Backend ghi việc xóa metadata và hàng đợi dọn bản mã bền vững trước. Nếu bucket lỗi khi dọn vật lý, hàng đợi được thử lại ở thao tác ghi sau hoặc lúc khởi động lại; không tuyên bố xóa vật lý tức thì trong mọi trường hợp.

## Vận hành và tương thích

Snapshot metadata v2 bổ sung receipts, copy jobs, notifications và garbage queue. Backend 3.1.0 đọc được snapshot v1 cũ. Sau khi có dữ liệu v2, không quay về backend 3.0.0 vì phiên bản cũ không đọc được schema này. Tiếp tục chỉ chạy một writer với bucket.

API mới: POST `/api/shares/{id}/receipt`, POST `/api/notifications/read`, DELETE `/api/files/{id}/upload` để hủy upload chưa hoàn tất, DELETE `/api/files/{id}/purge` cho tệp của chủ sở hữu đã nằm trong Thùng rác. POST `/api/files` có `sourceShareId` để tạo bản sao của một lượt chia sẻ có quyền truy cập.

Kiểm thử thêm: `tests/delivery.mjs`, `tests/delivery-persistence.py`; bằng chứng đợt này ở `audit/review-delivery-20261030/`. Chưa có email/push notification khi app đóng, tự động chuyển một phiên đã bắt đầu truyền giữa chừng, hoặc resume upload sau khi trang đóng. Xác nhận nhận tệp được lưu lại và hiển thị khi người gửi mở app lần sau.
