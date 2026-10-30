# SecretVault Online 3.0.1

Ứng dụng lưu trữ và chia sẻ tệp mã hóa với backend Python. Bản bàn giao hiện tại dùng chung dịch vụ online cho web, điện thoại và Windows. Không cần cùng Wi-Fi, mở cổng router hay cài Python trên máy người dùng.

## Dùng ngay

- **Web:** https://secretvault-online.vercel.app
- **Quản trị:** https://secretvault-online.vercel.app/admin
- **Windows x64:** bộ cài duy nhất trong `release/SecretVault-Online-Setup-3.0.1-x64.exe`.
- **Gói bàn giao:** `deliverables/SecretVault_Online/`; tài liệu và slide nằm trong `Tai_lieu/`.

Đăng ký bằng email và mật khẩu ít nhất 10 ký tự. Tải tệp vào **Tệp của tôi**, chọn **Chia sẻ**, nhập email tài khoản người nhận. Người nhận mở **Đã nhận** trên web hoặc app Windows. Gửi trực tiếp cần cả hai giữ app mở; chọn tệp và nhập email ngay trong màn hình gửi, không cần thêm danh bạ trước.

Giao diện mới ngày 30/10 tập trung vào Tải tệp → Chia sẻ → Đã nhận. Menu **…** chứa tải xuống/thùng rác; bộ lọc nằm cạnh ô tìm kiếm. App Windows Online đang cài tự tải giao diện mới khi mở lại.

Mỗi tệp tối đa **25 MiB**, mỗi tài khoản mặc định **100 MiB**, toàn bộ demo **512 MiB** và **50 tài khoản**. Thùng rác vẫn tính dung lượng; khôi phục mở lại quyền chia sẻ chưa thu hồi. Chưa có khôi phục mật khẩu.

## Tài liệu hiện hành

- [Hướng dẫn người dùng](docs/HUONG_DAN_SU_DUNG.md)
- [Vận hành và kiến trúc Online](docs/CLOUD_ONLINE.md)
- [Trạng thái và bằng chứng kiểm thử](docs/CLOUD_STATUS.md)
- [Các thay đổi 3.0.1](docs/CHANGELOG.md)
- [Đối chiếu nội dung môn học](docs/DOI_CHIEU_SLIDE.md)

Phạm vi đồ án giữ nguyên: **khóa công khai, Diffie–Hellman cho gửi trực tiếp và ElGamal Hybrid cho chia sẻ khi người nhận mở sau**. AES-GCM, HKDF, chữ ký và hàm băm hỗ trợ các luồng này. Giao diện người dùng không yêu cầu thao tác với khóa.

## Mã nguồn

| Thành phần | Vị trí |
|---|---|
| Web online tiếng Việt | `web/` |
| API Python và lưu trữ bền vững | `cloudserver/` |
| Nền tảng API, ACL và kiểm tra mật mã | `vaultserver/` |
| App Windows online | `cloud_client_app.py` |
| Build app Windows | `packaging/build-cloud-client.ps1` |
| Kiểm thử API, mật mã và hồi quy web | `tests/` |
| Bằng chứng các đợt kiểm thử | `audit/` |

Web được phát hành trên Vercel; API chạy Render; bucket Hugging Face riêng lưu bản mã và snapshot metadata. Chỉ **một instance** được ghi vào bucket. Frontend và app không chứa token hạ tầng hay mã kích hoạt quản trị.

## Phát triển local

```powershell
py -3.11 -m venv .venv-cloud
.venv-cloud\Scripts\python.exe -m pip install -r hosting/render-requirements.txt
$env:SV_LOCAL_WEB='1'
$env:PORT='8787'
$env:SV_RUNTIME_DIR='audit/runtime-dev/local'
$env:SV_PERSISTENT_DIR='audit/runtime-dev/persistent'
.venv-cloud\Scripts\python.exe -m cloudserver.main
```

Mở http://127.0.0.1:8787. Hai đường dẫn dữ liệu phải dành riêng cho phát triển. Không dùng DB LAN thật hay bucket production làm fixture. Môi trường local mặc định không kết nối bucket online.

```powershell
node hosting/build-web.mjs
node tests/web-regressions.mjs
$env:SV_TEST_URL='http://127.0.0.1:8787'
node tests/integration.mjs
```

Build bộ cài bằng PowerShell 7, Python build environment và Inno Setup 6: `pwsh -File packaging/build-cloud-client.ps1`. Bộ cài chưa ký số.

## Lưu trữ bản cũ

`app.py`, `host_app.py`, `client_app.py`, `public/` và tài liệu LAN phục vụ các phiên bản 2.x. Chúng được giữ để bảo toàn nguồn và tài khoản LAN cũ. Người dùng bản Online chỉ cần bộ cài Online hoặc link web phía trên. Các bộ cài cũ được chuyển khỏi thư mục phát hành hiện hành.

Render miễn phí có thể ngủ khi không hoạt động, nên lần đầu mở cần chờ máy chủ. Đây là bản demo đồ án đã kiểm thử chức năng, chưa qua kiểm toán mật mã độc lập và chưa có cam kết luôn sẵn sàng.
