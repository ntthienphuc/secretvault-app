# Đối chiếu đúng ba nội dung của SecretVault

Phạm vi người dùng xác nhận: **khóa công khai, Diffie–Hellman cho Live Transfer, ElGamal cho Offline Share**. Slide được dùng để kiểm tra tính đúng; app không triển khai toàn bộ bài giảng và không có màn hình trình diễn các thuật toán khác.

Nguồn: Bài 6 – Hàm băm, Bẫy sập, Khóa công khai và Chữ ký số, TS. Nguyễn Ngọc Trường Minh, COM608, 60 trang. Các số trang dưới đây là số trang PDF, cũng khớp số in trên slide.

| Nội dung | Slide cần đối chiếu | Bản trước | Bản 2.0 |
| --- | --- | --- | --- |
| Khóa công khai | Tr.30: hai khóa; tr.35: cần xác thực; tr.52: khóa phải gắn với đúng người | Chỉ đổi profile; ai gọi API cũng lấy được metadata; private key lưu thô ở localStorage | Đăng ký/đăng nhập thật; server suy danh tính từ session; private bundle mã hóa bằng mật khẩu; danh bạ ghim fingerprint và chặn khóa thay đổi |
| Diffie–Hellman | Tr.33–35: A=g^a, B=g^b, g^(ab), KDF, chống MITM, khóa tạm mỗi phiên | P-256 ECDH hợp lệ về họ DH, nhưng chưa ký handshake; deriveKey AES trực tiếp; UI nói HKDF dù không chạy HKDF | Dùng hữu hạn MODP3072 để bám sát công thức; ký offer và acceptance, kiểm tra public key trong nhóm con; HKDF-SHA256 ràng buộc transcript rồi AES-GCM từng chunk |
| ElGamal | Tr.36–38: y=g^x, r=g^k, t=y^k*m; k mới; nguyên bản không bảo đảm toàn vẹn | Nhóm hữu hạn 256 bit quá nhỏ; chưa kiểm tra nhóm; SHA-256 ghép chuỗi thay KDF; envelope chưa ký | Nhóm RFC3526 3072 bit; CSPRNG và rejection sampling; kiểm tra nhóm; c1=g^k, z=y^k, HKDF rồi AES-GCM bọc khóa file; ký envelope và ràng buộc người nhận/tệp |

## Những thuật toán hỗ trợ nằm bên trong

- AES-GCM mã hóa nội dung tệp và xác minh tag; không mã hóa cả PDF bằng phép ElGamal trực tiếp.
- HKDF-SHA256 chuyển bí mật chung thành khóa AES với ngữ cảnh riêng cho từng giao thức.
- Ed25519 xác thực public key tạm và metadata có hash của ciphertext; không phải một tính năng chữ ký số độc lập của app.
- PBKDF2-SHA256 600.000 vòng, salt 32 byte và AES-GCM bảo vệ gói private key bằng mật khẩu. Browser gửi credential dẫn xuất với domain riêng, không gửi mật khẩu mở khóa thô; server tiếp tục lưu verifier có salt độc lập. Credential là thông tin đăng nhập tương đương mật khẩu và chỉ truyền qua HTTPS/loopback.

## ElGamal Hybrid khác ElGamal cổ điển ở đâu?

Theo slide tr.36, ElGamal cổ điển có c2=m*y^k mod p. SecretVault giữ luồng **ElGamal Hybrid** như đề xuất ban đầu: c1=g^k; z=y^k; HKDF(z) tạo khóa bọc K_file bằng AES-GCM. Không gọi trường data/wrapped key là c2 cổ điển. Đây là giao thức học thuật tự xây trên ý tưởng ElGamal KEM/DEM, không phải HPKE đã chuẩn hóa.

Các vector nhỏ tr.34 và tr.37 chỉ có trong bộ kiểm thử phát triển `tests/classroom-vectors.mjs`, không nằm trong tính năng app: DH p=23,g=5,a=6,b=15 cho A=8,B=19,K=2; ElGamal p=467,g=2,a=127,m=100,k=53 cho y=132,c1=399,c2=308 và giải mã về 100.

## Ràng buộc bảo mật và kết luận

Nhóm hữu hạn 3072 bit không đồng nghĩa an toàn 3072 bit và không biến cả giao thức thành mức an toàn 256 bit chỉ vì AES có khóa 256 bit. RFC3526 cung cấp tham số nhóm; HKDF theo RFC5869. Ghim fingerprint là TOFU với đối chiếu ngoài băng, chưa là chứng chỉ CA/PKI. Public key của danh tính không tự chứng minh danh tính đời thực.

App hiện đủ ba quy trình đề tài: danh tính khóa công khai, Live DH và Offline ElGamal Hybrid. Có xác thực, kiểm tra toàn vẹn và phân quyền thực. Phần BigInt tự cài để thể hiện toán học chưa qua kiểm toán timing/bảo mật; nên trình bày là phần mềm đồ án, không tuyên bố tương đương sản phẩm mật mã đã kiểm toán. Server được tin cậy để cung cấp JavaScript đúng và danh bạ ban đầu; kiểm thử không chứng minh chống một server chủ động phát mã JavaScript độc hại.

Tài liệu đối chiếu: [RFC3526 §4](https://www.rfc-editor.org/rfc/rfc3526#section-4), [RFC5869](https://www.rfc-editor.org/rfc/rfc5869), [RFC8032](https://www.rfc-editor.org/rfc/rfc8032).
