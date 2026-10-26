export const esc = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
export const size = (value) => value < 1024 ? `${value} B` : value < 1048576 ? `${(value / 1024).toFixed(1)} KiB` : `${(value / 1048576).toFixed(1)} MiB`;
export const date = (value) => new Intl.DateTimeFormat("vi", { dateStyle: "short", timeStyle: "short" }).format(value);
export const short = (value) => String(value || "").length > 28 ? String(value).slice(0, 14) + "…" + String(value).slice(-12) : value;
const initials = (name) => name.split(" ").filter(Boolean).slice(-2).map((word) => word[0]).join("").toUpperCase();
const avatar = (user) => `<span class="avatar">${esc(initials(user.name))}</span>`;
const button = (title, action, extra = "", primary = false) => `<button class="button ${primary ? "primary" : "ghost"}" data-action="${action}" ${extra}>${title}</button>`;
const peer = (state, id) => state.remote.users.find((user) => user.id === id);
const pinned = (state, user) => state.remote.contacts.some((contact) => contact.peer_id === user.id && contact.fingerprint === user.public.fingerprint);

export function authView(state) {
  const register = state.authMode === "register";
  return `
    <main class="auth-layout">
      <section class="auth-story">
        <div class="brand-lockup"><span class="brand-shield">SV</span><div><div class="brand-title">SecretVault</div><div class="brand-caption">Your files. Your keys.</div></div></div>
        <div class="auth-copy"><p class="eyebrow">KHÔNG GIAN LÀM VIỆC MÃ HÓA</p><h1>Giữ riêng tư.<br>Chia sẻ tự tin.</h1><p>Một vault riêng, hai cách gửi an toàn. Gửi live khi cùng online, hoặc để người nhận mở lại bất cứ lúc nào.</p></div>
        <div class="protocol-tiles"><article><span>01 / PRIVATE VAULT</span><strong>AES-256-GCM</strong><p>Mã hóa tệp ngay trên thiết bị của bạn.</p></article><article><span>02 / LIVE TRANSFER</span><strong>Diffie–Hellman</strong><p>Khóa phiên mới, xác thực bằng Ed25519.</p></article><article><span>03 / OFFLINE SHARE</span><strong>ElGamal Hybrid</strong><p>Phong bì khóa riêng cho mỗi người nhận.</p></article></div>
        <p class="muted">COM608 · Khóa công khai, DH & ElGamal · Phiên bản 2.0</p>
      </section>
      <section class="auth-card panel">
        <p class="eyebrow">${register ? "BẮT ĐẦU VỚI KHÓA RIÊNG" : "CHÀO MỪNG BẠN TRỞ LẠI"}</p>
        <h2>${register ? "Tạo tài khoản" : "Mở khóa vault"}</h2>
        <p class="muted">${register ? "Khóa được sinh trên trình duyệt và bảo vệ bằng mật khẩu của bạn." : "Đăng nhập để giải mã gói khóa của bạn ngay trên thiết bị này."}</p>
        <form data-form="auth" class="form-grid">
          ${register ? `<div><label class="field-label" for="auth-name">Tên hiển thị</label><input class="field-input" id="auth-name" autocomplete="name" maxlength="80" required /></div>` : ""}
          <div><label class="field-label" for="auth-email">Email</label><input class="field-input" id="auth-email" type="email" autocomplete="username" value="${esc(state.loginEmail)}" required /></div>
          <div><label class="field-label" for="auth-password">Mật khẩu</label><input class="field-input" id="auth-password" type="password" autocomplete="${register ? "new-password" : "current-password"}" minlength="10" maxlength="200" required /><p class="form-hint">Tối thiểu 10 ký tự. Cần mật khẩu để mở lại khóa trên thiết bị khác.</p></div>
          ${register ? `<div><label class="field-label" for="auth-confirm">Nhập lại mật khẩu</label><input class="field-input" id="auth-confirm" type="password" autocomplete="new-password" required /></div>` : ""}
          <button class="button primary" ${state.busy ? "disabled" : ""}>${state.busy || (register ? "Tạo tài khoản & sinh khóa →" : "Đăng nhập & mở khóa →")}</button>
        </form>
        <p class="auth-switch">${register ? "Đã có tài khoản?" : "Lần đầu dùng SecretVault?"} <button class="section-link" data-action="auth-mode">${register ? "Đăng nhập" : "Tạo tài khoản"}</button></p>
        <div class="auth-server"><span class="status-dot"></span><span>${esc(location.origin)}</span></div>
        <p class="form-hint">Trình duyệt cần hỗ trợ Web Crypto Ed25519. Dùng localhost trên PC hoặc HTTPS khi kết nối host.</p>
      </section>
    </main>`;
}

export function shell(state) {
  const user = state.user;
  const ownFiles = state.remote.files.filter((file) => file.ownerId === user.id);
  const shared = state.remote.files.filter((file) => file.ownerId !== user.id);
  const nav = [["vault", "▣", "Vault của tôi", ownFiles.length], ["shared", "↗", "Được chia sẻ", shared.length], ["live", "↔", "Gửi trực tiếp", ""], ["contacts", "◎", "Danh bạ", state.remote.contacts.length], ["settings", "⚙", "Tài khoản & kết nối", ""]];
  return `
    <div class="app-shell"><aside class="sidebar">
      <div class="brand-lockup"><span class="brand-shield">SV</span><div><div class="brand-title">SecretVault</div><div class="brand-caption">Your files. Your keys.</div></div></div>
      <div><p class="nav-label">KHÔNG GIAN LÀM VIỆC</p><nav class="nav-list">${nav.map(([view, icon, title, count]) => `<button class="nav-item ${state.view === view ? "active" : ""}" data-view="${view}"><span class="nav-icon">${icon}</span>${title}${count ? `<span class="nav-count">${count}</span>` : ""}</button>`).join("")}</nav></div>
      <div class="sidebar-footer"><div class="mini-title"><span class="status-dot"></span> Khóa đang mở trên thiết bị</div><p>Máy chủ lưu ciphertext. Đăng xuất để khóa lại phiên làm việc.</p>${button("Khóa & đăng xuất", "logout")}</div>
    </aside><div class="workspace"><header class="topbar"><div class="topbar-left"><label class="search-box"><span>⌕</span><input id="search" placeholder="Tìm tệp trong vault…" value="${esc(state.search)}" /></label></div><div class="topbar-right"><span class="status-pill"><span class="status-dot"></span>${state.connected ? "Đã kết nối host" : "Mất kết nối"}</span><span class="profile-chip">${avatar(user)}<span>${esc(user.name)}</span></span><button class="icon-button" title="Khóa & đăng xuất" aria-label="Đăng xuất" data-action="logout">↪</button></div></header>
      <main class="page">${page(state)}</main>
    </div></div><input class="hidden-input" id="upload-input" type="file" /><input class="hidden-input" id="live-input" type="file" />${modal(state)}`;
}

function hero(eyebrow, title, description, actions = "") {
  return `<section class="hero"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1><p>${description}</p></div><div class="button-row">${actions}</div></section>`;
}

function page(state) {
  if (state.view === "vault" || state.view === "shared") {
    return vault(state);
  }
  if (state.view === "contacts") {
    return contacts(state);
  }
  if (state.view === "live") {
    return live(state);
  }
  return settings(state);
}

function vault(state) {
  const shared = state.view === "shared";
  const files = state.remote.files.filter((file) => (file.ownerId !== state.user.id) === shared && file.manifest.name.toLowerCase().includes(state.search.toLowerCase()));
  const own = state.remote.files.filter((file) => file.ownerId === state.user.id);
  const total = own.reduce((sum, file) => sum + file.manifest.size, 0);
  const activeShares = state.remote.shares.filter((share) => share.senderId === state.user.id && !share.revoked).length;
  return hero(shared ? "OFFLINE SHARE / ELGAMAL HYBRID" : "PRIVATE VAULT / AES-256-GCM", shared ? "Dành riêng cho bạn" : "Không gian mã hóa của bạn", shared ? "Mở tệp bằng private key của bạn. Người gửi có thể offline sau khi hoàn tất chia sẻ." : "Tải tệp lên, mã hóa trên trình duyệt và chọn cách chia sẻ phù hợp.", button("＋ Mã hóa tệp", "upload", "", true)) + `
    <div class="stats-grid">${[["Tệp riêng", own.length, "Đã ký Ed25519"], ["Dung lượng", size(total), "Mã hóa theo khối 1 MiB"], ["Liên hệ đã ghim", state.remote.contacts.length, "Fingerprint được lưu"], ["Chia sẻ đang mở", activeShares, "ElGamal Hybrid"]].map(([title, value, detail]) => `<article class="stat-card"><div class="stat-top"><span class="stat-label">${title}</span><span class="stat-icon">◈</span></div><div class="stat-value">${value}</div><div class="stat-meta">${detail}</div></article>`).join("")}</div>
    <div class="section-head"><div><h2>${shared ? "Tệp được chia sẻ" : "Tệp của tôi"}</h2><p>Chữ ký kiểm tra metadata; AES-GCM xác minh nội dung khi mở.</p></div>${button("Làm mới", "refresh")}</div>
    <div class="panel file-table">${files.length ? `<div class="table-head"><span>Tệp</span><span>Kích thước</span><span>Xác minh</span><span>Ngày tạo</span><span></span></div>${files.map((file) => fileRow(state, file)).join("")}` : `<div class="empty-state"><div><div class="empty-icon">▣</div><strong>${shared ? "Chưa có tệp gửi tới bạn" : "Bắt đầu vault đầu tiên"}</strong><p>${shared ? "Người gửi thêm email của bạn vào danh bạ, ghim khóa và tạo một chia sẻ offline." : "Chọn PDF, ảnh, tài liệu hoặc bất kỳ tệp nào. Giới hạn mỗi tệp 256 MiB."}</p>${shared ? button("Xem danh bạ", "to-contacts") : button("＋ Chọn tệp để mã hóa", "upload", "", true)}</div></div>`}</div>
    ${!shared ? `<section class="section"><div class="section-head"><div><h2>Hoạt động gần đây</h2></div></div><div class="process-card activity-list">${state.remote.activity.length ? state.remote.activity.slice(0, 5).map((item) => `<div class="activity-item"><span class="activity-dot"></span><div><strong>${esc(item.message)}</strong><span>${date(item.created)}</span></div></div>`).join("") : `<p class="muted">Hoạt động mã hóa và chia sẻ của bạn sẽ xuất hiện ở đây.</p>`}</div></section>` : ""}`;
}

function fileRow(state, file) {
  const manifest = file.manifest;
  const status = state.verified.get(file.id);
  const owner = peer(state, file.ownerId);
  const own = file.ownerId === state.user.id;
  const valid = state.signatures.get(file.id);
  return `<div class="file-row"><div class="file-main"><span class="file-icon">${esc(manifest.name.split(".").pop().toUpperCase().slice(0, 4))}</span><div class="file-name-wrap"><div class="file-name">${esc(manifest.name)}</div><div class="file-subline">${own ? "Chỉ bạn và người được cấp quyền" : "Từ " + esc(owner?.name || "người gửi")}</div></div></div><div class="cell-muted">${size(manifest.size)}</div><div><span class="${status ? "security-chip" : valid ? "protocol-chip" : "status-chip pending"}">${status ? "✓ Nội dung hợp lệ" : valid ? "✓ Chữ ký hợp lệ" : "Chờ kiểm tra"}</span></div><div class="cell-muted">${date(manifest.created)}</div><div class="row-actions"><button class="icon-button" aria-label="Kiểm tra mật mã" title="Crypto Inspector" data-action="inspect" data-id="${file.id}">◌</button><button class="icon-button" aria-label="Giải mã và tải" title="Giải mã & tải" data-action="download" data-id="${file.id}">↓</button>${own ? `<button class="icon-button" aria-label="Chia sẻ offline" title="Chia sẻ offline" data-action="share" data-id="${file.id}">↗</button>` : ""}</div></div>`;
}

function contacts(state) {
  const list = state.remote.contacts.map((contact) => peer(state, contact.peer_id)).filter(Boolean);
  return hero("PUBLIC IDENTITY / PINNED FINGERPRINT", "Danh bạ tin cậy", "Thêm email và đối chiếu fingerprint qua một kênh độc lập trước khi ghim khóa.") + `
    <section class="process-card"><form data-form="contact" class="contact-search"><div><label for="contact-email" class="field-label">Email tài khoản trên cùng host</label><input id="contact-email" class="field-input" type="email" placeholder="bob@example.com" required /></div><button class="button primary">Tìm public key →</button></form></section>
    ${state.candidate ? `<section class="section key-card"><div class="card-title">${avatar(state.candidate)}<div><h2>${esc(state.candidate.name)}</h2><p>${esc(state.candidate.email)}</p></div></div><label class="field-label">Fingerprint SHA-256</label><code class="fingerprint">${esc(state.candidate.public.fingerprint)}</code><p class="form-hint">Ghim lần đầu (TOFU). Việc này chưa thay thế chứng chỉ CA/PKI. Hãy đối chiếu trực tiếp với người nhận.</p><div class="button-row">${button("Ghim public key này", "pin-candidate", "", true)}</div></section>` : ""}
    <section class="section"><div class="section-head"><div><h2>Liên hệ của bạn</h2><p>Khóa thay đổi sẽ bị chặn, không tự ghi đè.</p></div></div><div class="contacts-grid">${list.length ? list.map((user) => `<article class="contact-card"><div class="contact-main">${avatar(user)}<div><strong>${esc(user.name)}</strong><span>${esc(user.email)}</span></div><span class="contact-status">${user.online ? "● Online" : "○ Offline"}</span></div><div class="key-line"><span>Ed25519</span><span>${esc(short(user.public.fingerprint))}</span></div><div class="key-line"><span>ElGamal</span><span>MODP 3072 bit</span></div><span class="security-chip">✓ Đã ghim fingerprint</span></article>`).join("") : `<div class="panel empty-state"><div><strong>Chưa có liên hệ</strong><p>Tạo tài khoản thứ hai hoặc nhờ người nhận đăng ký trên cùng host rồi tìm bằng email.</p></div></div>`}</div></section>`;
}

function live(state) {
  const list = state.remote.contacts.map((contact) => peer(state, contact.peer_id)).filter(Boolean);
  const labels = { offered: "Chờ người nhận", accepted: "Đã trao khóa", sent: "Chờ giải mã", complete: "Người nhận đã xác minh", expired: "Hết hạn · gửi lại", rejected: "Đã từ chối" };
  return hero("AUTHENTICATED DH / EPHEMERAL SESSION", "Gửi trực tiếp", "Cả hai cùng mở app. Mỗi phiên sinh khóa DH tạm thời riêng, ký hai public key và dẫn xuất khóa phiên bằng HKDF.", button("Mở tab tài khoản khác ↗", "new-tab")) + `
    <div class="live-layout"><section class="process-card"><div class="card-title"><span class="card-title-icon">↔</span><div><h2>Bắt đầu phiên gửi</h2><p>Chọn tệp và người nhận đã ghim khóa.</p></div></div><form data-form="live" class="form-grid"><div><label class="field-label">Tệp cần gửi</label>${button("Chọn tệp…", "choose-live")}<p class="form-hint">${state.liveFile ? esc(state.liveFile.name) + " · " + size(state.liveFile.size) : "Tối đa 256 MiB · mã hóa theo khối 1 MiB"}</p></div><div><label class="field-label" for="live-recipient">Người nhận</label><select id="live-recipient" class="field-select" required><option value="">Chọn liên hệ</option>${list.map((user) => `<option value="${user.id}">${esc(user.name)} · ${user.online ? "Online" : "Offline"}</option>`).join("")}</select></div><button class="button primary" ${state.busy ? "disabled" : ""}>${state.busy || "Gửi lời mời an toàn →"}</button></form></section>
    <section class="process-card"><div class="card-title"><span class="card-title-icon">◇</span><div><h2>Chuỗi giao thức</h2><p>Liên hệ với trang 33–35 của slide</p></div></div><div class="step-list">${[["1", "Ký public key DH", "Ed25519 ràng buộc danh tính, người nhận, nonce và thời hạn."], ["2", "Hai phía tính gᵃᵇ mod p", "Nhóm MODP 3072 bit; kiểm tra public key thuộc nhóm con."], ["3", "HKDF-SHA256 → AES-GCM", "Salt và ngữ cảnh lấy từ transcript có chữ ký của cả hai phía."], ["4", "Xác minh trước khi nhận", "Chữ ký, SHA-256 và tag AES-GCM phải cùng hợp lệ."]].map(([number, title, description]) => `<div class="step-item"><span class="step-number">${number}</span><div><strong>${title}</strong><p>${description}</p></div></div>`).join("")}</div></section></div>
    <section class="section"><div class="section-head"><div><h2>Phiên live</h2><p>Thời hạn tối đa 15 phút. Tải lại tab giữa phiên cần gửi lại lời mời.</p></div></div><div class="transfer-stack">${state.remote.live.length ? state.remote.live.map((item) => {
      const receiver = item.recipientId === state.user.id;
      const contact = peer(state, receiver ? item.senderId : item.recipientId);
      const memory = receiver ? state.incoming.get(item.id) : state.outgoing.get(item.id);
      const payloadReady = item.state === "sent" && receiver && memory;
      const canAccept = receiver && item.state === "offered";
      return `<article class="transfer-card"><div class="transfer-head"><div class="transfer-title"><span class="file-icon teal">↔</span><div><strong>${esc(item.offer.name)}</strong><span>${receiver ? "Từ " : "Đến "}${esc(contact?.name || "liên hệ")} · ${size(item.offer.size)}</span></div></div><span class="status-chip ${item.state === "complete" ? "success" : "info"}">${labels[item.state]}</span></div><div class="transfer-meta"><span class="protocol-chip">DH-3072 + Ed25519</span><span class="security-chip">HKDF → AES-GCM</span>${canAccept ? button("Nhận an toàn", "accept-live", `data-id="${item.id}"`, true) + button("Từ chối", "reject-live", `data-id="${item.id}"`) : ""}${payloadReady ? button("Xác minh, giải mã & tải", "receive-live", `data-id="${item.id}"`, true) : ""}${receiver && item.state === "sent" && !memory ? `<span class="muted">Khóa tạm không còn trong tab; yêu cầu người gửi tạo phiên mới.</span>` : ""}</div></article>`;
    }).join("") : `<div class="panel empty-state"><div><div class="empty-icon">↔</div><strong>Chưa có phiên live</strong><p>Mở app trên hai tab hoặc hai PC cùng host rồi gửi lời mời.</p></div></div>`}</div></section>`;
}

function settings(state) {
  return hero("ACCOUNT / SERVER CONNECTION", "Tài khoản & kết nối", "Một tài khoản trên một host. Bạn có thể đăng nhập lại từ thiết bị khác bằng cùng email và mật khẩu.") + `
    <div class="page-grid-two"><section class="key-card"><div class="contact-main">${avatar(state.user)}<div><strong>${esc(state.user.name)}</strong><span>${esc(state.user.email)}</span></div></div><label class="field-label">Fingerprint khóa công khai của bạn</label><code class="fingerprint">${esc(state.user.public.fingerprint)}</code><div class="key-line"><span>Ký / xác minh</span><span>Ed25519</span></div><div class="key-line"><span>Mã hóa offline</span><span>ElGamal Hybrid · MODP3072</span></div><div class="key-line"><span>Bảo vệ private key</span><span>PBKDF2-SHA256 600.000 + AES-GCM</span></div><div class="button-row">${button("Tải bản sao gói khóa mã hóa", "backup-keys")}${button("Khóa & đăng xuất", "logout")}</div><p class="form-hint">Backup chứa gói khóa đã mã hóa. Vẫn cần mật khẩu; không có chức năng đặt lại mật khẩu làm mất khóa cũ.</p></section>
    <section class="process-card"><h2>Host hiện tại</h2><code class="fingerprint">${esc(location.origin)}</code><p class="muted">Cùng PC: mở hai tab và đăng nhập hai tài khoản riêng. Mỗi tab giữ phiên riêng.</p><p class="muted">Hai PC: kết nối cùng URL HTTPS của server. Không gửi địa chỉ 127.0.0.1 của bạn cho máy khác.</p><p class="muted">App PC quản lý server cục bộ và sao lưu SQLite/ciphertext. Đóng bảng điều khiển sẽ dừng server do bảng đó khởi chạy.</p><p class="form-hint">Tên tệp, kích thước, email và thời gian là metadata server có thể thấy. Nội dung và private key được mã hóa.</p>${button("Mở tab đăng nhập thứ hai", "new-tab")}</section></div>
    <section class="section process-card"><h2>Giới hạn của đồ án</h2><p class="muted">Fingerprint dùng cơ chế TOFU do người dùng ghim, chưa có chứng chỉ CA. Thu hồi chia sẻ chặn lần tải tiếp theo; người nhận vẫn giữ được bản đã giải mã. Khối ElGamal/DH tự cài đặt BigInt để học công thức, chưa qua kiểm toán bảo mật hay kiểm tra timing chuyên dụng.</p></section>`;
}

function modal(state) {
  if (!state.modal) {
    return "";
  }
  const file = state.remote.files.find((item) => item.id === state.modal.id);
  if (!file) {
    return "";
  }
  const owner = peer(state, file.ownerId);
  const own = file.ownerId === state.user.id;
  let content;
  if (state.modal.type === "share") {
    const contacts = state.remote.contacts.map((contact) => peer(state, contact.peer_id)).filter(Boolean);
    const shares = state.remote.shares.filter((item) => item.fileId === file.id && !item.revoked && item.senderId === state.user.id);
    content = `<h2 id="modal-title">Chia sẻ offline</h2><p class="muted">${esc(file.manifest.name)}</p><p class="form-hint">Bọc khóa tệp bằng public key người nhận; họ có thể mở khi bạn offline.</p><form class="form-grid" data-form="share" data-id="${file.id}"><div><label class="field-label" for="share-recipient">Người nhận</label><select id="share-recipient" class="field-select" required><option value="">Chọn liên hệ đã ghim khóa</option>${contacts.map((user) => `<option value="${user.id}">${esc(user.name)} · ${esc(user.email)}</option>`).join("")}</select></div><button class="button primary" ${state.busy ? "disabled" : ""}>${state.busy || "Tạo envelope & ký →"}</button></form>${contacts.length ? "" : `<p class="form-hint">Thêm người nhận vào danh bạ trước khi chia sẻ.</p>`}<div class="section">${shares.map((item) => `<div class="key-line"><span>${esc(peer(state, item.recipientId)?.name)}</span><button class="button small ghost" data-action="revoke" data-id="${item.id}">Thu hồi quyền tải tiếp</button></div>`).join("")}</div><p class="form-hint">Thu hồi không xóa bản sao đã giải mã của người nhận.</p>`;
  } else {
    const verified = state.verified.get(file.id);
    const evidence = {
      fileId: file.id, manifestHash: file.manifestHash,
      algorithm: file.manifest.algorithm, chunkCount: file.manifest.chunks.length,
      chunk0: file.manifest.chunks[0], signature: file.signature,
      keyEnvelope: file.share?.payload.envelope || "AES-GCM owner wrap",
      signatureChecked: !!state.signatures.get(file.id),
      contentChecked: !!verified,
    };
    content = `<p class="eyebrow">CRYPTO INSPECTOR</p><h2 id="modal-title">${esc(file.manifest.name)}</h2><div class="detail-grid"><div class="detail-cell"><label>Chủ sở hữu</label><strong>${esc(owner?.name)}</strong></div><div class="detail-cell"><label>Mã hóa nội dung</label><strong>AES-256-GCM</strong></div><div class="detail-cell"><label>Chuyển khóa</label><strong>${own ? "AES-GCM vault key" : "ElGamal Hybrid + HKDF"}</strong></div><div class="detail-cell"><label>Chữ ký manifest</label><strong>${state.signatures.get(file.id) ? "Đã xác minh Ed25519" : "Chưa hợp lệ"}</strong></div><div class="detail-cell"><label>Nội dung / tag GCM</label><strong>${verified ? "Đã kiểm tra toàn bộ" : "Chưa tải để kiểm tra"}</strong></div><div class="detail-cell"><label>Khóa người gửi</label><strong>${own || pinned(state, owner) ? "Đã xác minh / ghim" : "Chưa ghim fingerprint"}</strong></div></div><pre class="code-block">${esc(JSON.stringify(evidence, null, 2))}</pre><div class="modal-foot">${!own && !pinned(state, owner) ? button("Xem & ghim khóa người gửi", "trust-sender", `data-id="${owner.id}"`) : ""}${button("Tải bằng chứng JSON", "evidence", `data-id="${file.id}"`)}${button("Kiểm tra toàn bộ nội dung", "verify-file", `data-id="${file.id}"`, true)}</div>`;
  }
  return `<div class="modal-layer" data-action="close-modal"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-head"><div></div><button class="icon-button" data-action="close-modal" aria-label="Đóng">×</button></div>${content}</section></div>`;
}
