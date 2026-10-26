import { icon } from "./icons.js";

export const esc = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
export const size = (value) => value < 1024 ? `${value} B` : value < 1048576 ? `${(value / 1024).toFixed(1)} KiB` : `${(value / 1048576).toFixed(1)} MiB`;
export const date = (value) => new Intl.DateTimeFormat("vi", { dateStyle: "short", timeStyle: "short" }).format(value);
export const short = (value) => String(value || "").length > 28 ? String(value).slice(0, 14) + "…" + String(value).slice(-12) : value;
const peer = (state, id) => state.remote.users.find((user) => user.id === id);
const pinned = (state, user) => user && state.remote.contacts.some((contact) => contact.peer_id === user.id && contact.fingerprint === user.public.fingerprint);
const initials = (name) => name.split(" ").filter(Boolean).slice(-2).map((word) => word[0]).join("").toUpperCase();
const avatar = (user, large = false) => `<span class="avatar ${large ? "large" : ""}">${esc(initials(user.name))}</span>`;
const button = (title, action, extra = "", primary = false, symbol = "") => `<button type="button" class="button ${primary ? "primary" : "ghost"}" data-action="${action}" ${extra}>${symbol ? icon(symbol) : ""}<span>${title}</span></button>`;
const brand = () => `<div class="brand-lockup"><span class="brand-mark">${icon("vault")}</span><span class="brand-title">Secret<span>Vault</span><small>YOUR PRIVATE SPACE</small></span></div>`;

export function fileKind(file) {
  const name = file.manifest?.name || file.name;
  const ext = name.split(".").pop().toLowerCase();
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "avif", "bmp"].includes(ext)) {
    return "image";
  }
  if (["pdf", "doc", "docx", "txt", "md", "rtf", "ppt", "pptx", "xls", "xlsx", "csv", "json"].includes(ext)) {
    return "document";
  }
  return "other";
}

function fileBadge(file, large = false) {
  const name = file.manifest?.name || file.name;
  const ext = name.includes(".") ? name.split(".").pop().toUpperCase().slice(0, 5) : "FILE";
  const kind = fileKind(file);
  const sheet = ["XLS", "XLSX", "CSV"].includes(ext);
  const tone = ext === "PDF" ? "rose" : kind === "image" ? "blue" : sheet ? "green" : ["ZIP", "RAR", "7Z"].includes(ext) ? "amber" : "violet";
  const glyph = kind === "image" ? "image" : sheet ? "sheet" : ["ZIP", "RAR", "7Z"].includes(ext) ? "archive" : "file";
  return `<span class="file-badge ${tone} ${large ? "large" : ""}">${icon(glyph)}<span>${esc(ext)}</span></span>`;
}

export function authView(state) {
  const register = state.authMode === "register";
  return `
    <main class="auth-layout">
      <section class="auth-story">
        ${brand()}
        <div class="auth-copy">
          <span class="label-pill">${icon("shield")} KHÔNG GIAN CỦA RIÊNG BẠN</span>
          <h1>Riêng tư từ đầu.<br>An tâm mỗi lần<br><em>chia sẻ.</em></h1>
          <p>Lưu những điều quan trọng. Chia sẻ với đúng người.<br>Khóa của bạn, quyền kiểm soát của bạn.</p>
        </div>
        <div class="auth-illustration"><img src="/assets/vault-art.svg" alt="Minh họa két lưu trữ riêng tư" width="440" height="300" /><div class="art-caption">${icon("lock")} Mã hóa ngay trên thiết bị</div></div>
        <div class="auth-feature-row"><span>${icon("key")} Danh tính riêng</span><span>${icon("live")} Gửi live</span><span>${icon("share")} Chia sẻ offline</span></div>
      </section>
      <section class="auth-form-side">
        <div class="auth-top-note">Được thiết kế cho quyền riêng tư ${icon("shield")}</div>
        <div class="auth-card">
          <div class="auth-icon">${icon(register ? "key" : "lock")}</div>
          <p class="eyebrow">${register ? "BẮT ĐẦU VỚI SECRET VAULT" : "CHÀO MỪNG BẠN TRỞ LẠI"}</p>
          <h2>${register ? "Tạo tài khoản" : "Mở khóa vault"}</h2>
          <p class="muted">${register ? "Một không gian riêng cho tài liệu và những người bạn tin tưởng." : "Tài liệu của bạn đang chờ. Đăng nhập để tiếp tục."}</p>
          <div class="auth-tabs" role="group" aria-label="Chọn đăng nhập hoặc đăng ký">
            <button type="button" class="${register ? "" : "active"}" data-action="auth-mode" data-mode="login">Đăng nhập</button>
            <button type="button" class="${register ? "active" : ""}" data-action="auth-mode" data-mode="register">Đăng ký</button>
          </div>
          <form data-form="auth" class="form-grid">
            ${register ? `<div><label class="field-label" for="auth-name">Tên hiển thị</label><input class="field-input" id="auth-name" autocomplete="name" placeholder="Tên của bạn" maxlength="80" required /></div>` : ""}
            <div><label class="field-label" for="auth-email">Email</label><input class="field-input" id="auth-email" type="email" autocomplete="username" placeholder="ban@example.com" value="${esc(state.loginEmail)}" required /></div>
            <div><label class="field-label" for="auth-password">Mật khẩu</label><input class="field-input" id="auth-password" type="password" autocomplete="${register ? "new-password" : "current-password"}" placeholder="Nhập mật khẩu của bạn" minlength="10" maxlength="200" required /><p class="form-hint">Tối thiểu 10 ký tự. Mật khẩu bảo vệ khóa riêng của bạn.</p></div>
            ${register ? `<div><label class="field-label" for="auth-confirm">Nhập lại mật khẩu</label><input class="field-input" id="auth-confirm" type="password" autocomplete="new-password" placeholder="Xác nhận mật khẩu" required /></div>` : ""}
            <button type="submit" class="button primary auth-submit" ${state.busy ? "disabled" : ""}>${state.busy || (register ? "Tạo tài khoản & sinh khóa →" : "Đăng nhập & mở khóa →")}</button>
          </form>
          <p class="auth-switch">${register ? "Đã có tài khoản?" : "Bạn mới dùng SecretVault?"} <button type="button" class="section-link" data-action="auth-mode">${register ? "Đăng nhập" : "Tạo tài khoản"}</button></p>
          <div class="auth-server">${icon("server")}<span>${esc(location.origin)}</span><span class="status-dot"></span></div>
          <p class="auth-note">Khóa riêng được mở trên trình duyệt của bạn.<br>Dùng Chrome/Edge qua localhost hoặc HTTPS.</p>
        </div>
        <footer class="auth-footer">SecretVault · Không gian mã hóa cá nhân <span>02 / DUAL-MODE SHARING</span></footer>
      </section>
    </main>`;
}

export function shell(state) {
  const user = state.user;
  const own = state.remote.files.filter((file) => file.ownerId === user.id);
  const shared = state.remote.files.filter((file) => file.ownerId !== user.id);
  const nav = [
    ["vault", "folder", "Vault của tôi", own.length],
    ["shared", "share", "Được chia sẻ", shared.length],
    ["live", "live", "Gửi trực tiếp", ""],
    ["contacts", "contacts", "Danh bạ", state.remote.contacts.length],
  ];
  const title = [...nav, ["settings", "settings", "Tài khoản & kết nối"]].find(([view]) => view === state.view)?.[2] || "Vault của tôi";
  return `
    <div class="app-shell">
      <aside class="sidebar">
        ${brand()}
        ${button("Tải tệp lên", "upload", "", true, "plus")}
        <div class="nav-group"><p class="nav-label">KHÔNG GIAN LÀM VIỆC</p><nav class="nav-list" aria-label="Điều hướng chính">
          ${nav.map(([view, glyph, label, count]) => `<button type="button" class="nav-item ${state.view === view ? "active" : ""}" data-view="${view}" ${state.view === view ? 'aria-current="page"' : ""}>${icon(glyph)}<span>${label}</span>${count ? `<span class="nav-count">${count}</span>` : ""}</button>`).join("")}
          <button type="button" class="nav-item mobile-settings ${state.view === "settings" ? "active" : ""}" data-view="settings">${icon("settings")}<span>Tài khoản</span></button>
        </nav></div>
        <div class="sidebar-bottom">
          <div class="privacy-card"><span class="privacy-icon">${icon("shield")}</span><strong>Quyền riêng tư trước tiên.</strong><p>Tài liệu được mã hóa trước khi rời thiết bị của bạn.</p><span>${icon("lock")} Khóa đang mở trong phiên</span></div>
          <button type="button" class="nav-item ${state.view === "settings" ? "active" : ""}" data-view="settings">${icon("settings")}<span>Tài khoản & kết nối</span></button>
          <button type="button" class="sidebar-user" data-view="settings">${avatar(user)}<span><strong>${esc(user.name)}</strong><small>Tài khoản cá nhân</small></span>${icon("chevron")}</button>
        </div>
      </aside>
      <div class="workspace">
        <header class="topbar">
          <div class="breadcrumb"><span>Không gian riêng</span>${icon("chevron")}<strong>${title}</strong></div>
          <div class="topbar-right"><label class="search-box">${icon("search")}<input id="search" type="search" aria-label="Tìm tệp" placeholder="Tìm trong vault…" value="${esc(state.search)}" /><kbd>⌕</kbd></label><span class="connection ${state.connected ? "" : "offline"}" title="${esc(location.origin)}"><span class="status-dot"></span>${state.connected ? "Đã kết nối" : "Mất kết nối"}</span><button type="button" class="icon-button" title="Khóa & đăng xuất" aria-label="Đăng xuất" data-action="logout">${icon("logout")}</button></div>
        </header>
        <main class="page ${state.remote.files.length ? "has-files" : ""}">${page(state)}</main>
        <footer class="workspace-footer"><span>${icon("shield")} Riêng tư theo cách của bạn.</span><span>SecretVault · Public key / DH / ElGamal</span></footer>
      </div>
    </div>
    <input class="hidden-input" id="upload-input" type="file" /><input class="hidden-input" id="live-input" type="file" />
    <div class="drop-overlay">${icon("cloud")}<strong>Thả tệp để mã hóa</strong><span>Tệp được mã hóa trước khi tải lên vault.</span></div>
    ${modal(state)}`;
}

function hero(eyebrow, title, description, actions = "") {
  return `<section class="hero"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1><p>${description}</p></div><div class="button-row">${actions}</div></section>`;
}

function page(state) {
  if (state.view === "vault" || state.view === "shared") return vault(state);
  if (state.view === "contacts") return contacts(state);
  if (state.view === "live") return live(state);
  return settings(state);
}

function vault(state) {
  const shared = state.view === "shared";
  const own = state.remote.files.filter((file) => file.ownerId === state.user.id);
  let files = state.remote.files.filter((file) => (file.ownerId !== state.user.id) === shared && file.manifest.name.toLowerCase().includes(state.search.toLowerCase()));
  if (state.fileType !== "all") files = files.filter((file) => fileKind(file) === state.fileType);
  files.sort((a, b) => state.sort === "name" ? a.manifest.name.localeCompare(b.manifest.name, "vi") : state.sort === "size" ? b.manifest.size - a.manifest.size : b.manifest.created - a.manifest.created);
  const total = own.reduce((sum, file) => sum + file.manifest.size, 0);
  const shares = state.remote.shares.filter((item) => item.senderId === state.user.id && !item.revoked).length;
  const filters = [["all", "Tất cả tệp"], ["document", "Tài liệu"], ["image", "Hình ảnh"], ["other", "Khác"]];
  return `
    ${hero(shared ? "CHIA SẺ RIÊNG TƯ" : "MỘT NƠI CHO NHỮNG ĐIỀU QUAN TRỌNG", shared ? "Dành riêng cho bạn" : "Vault của tôi", shared ? "Tệp từ những người bạn tin tưởng, với khóa dành riêng cho bạn." : "Tài liệu gọn gàng. Quyền riêng tư trọn vẹn.", button("Mã hóa tệp mới", "upload", "", true, "upload"))}
    <section class="welcome-banner ${shared ? "shared-banner" : ""}"><div class="welcome-copy"><span class="label-pill">${icon("lock")} KHÔNG GIAN ĐƯỢC MÃ HÓA</span><h2>${shared ? "Một lời chia sẻ.<br>Chỉ mình bạn mở được." : "Tệp của bạn.<br><em>Quyền kiểm soát của bạn.</em>"}</h2><p>${shared ? "Người gửi có thể offline. Envelope vẫn ở đây khi bạn cần." : "Lưu riêng tư, gửi trực tiếp hoặc chia sẻ để người nhận mở sau."}</p><div class="banner-tags"><span>${icon("shield")} Mã hóa trên thiết bị</span><span>${icon("key")} Khóa riêng cho bạn</span></div></div><img src="/assets/vault-art.svg" alt="" width="440" height="300" /></section>
    <div class="summary-strip">${[["folder", "Tệp trong vault", own.length], ["archive", "Đang lưu trữ", size(total)], ["share", "Chia sẻ đang mở", shares], ["contacts", "Liên hệ đã ghim", state.remote.contacts.length]].map(([glyph, label, value]) => `<div class="summary-item"><span>${icon(glyph)}</span><div><small>${label}</small><strong>${value}</strong></div></div>`).join("")}</div>
    <div class="vault-layout"><section class="files-section">
      <div class="section-head"><h2>${shared ? "Tệp được chia sẻ" : "Tệp của tôi"} <span class="count-badge">${files.length}</span></h2><div class="table-tools"><select id="file-sort" aria-label="Sắp xếp tệp"><option value="newest" ${state.sort === "newest" ? "selected" : ""}>Mới nhất</option><option value="name" ${state.sort === "name" ? "selected" : ""}>Theo tên</option><option value="size" ${state.sort === "size" ? "selected" : ""}>Dung lượng</option></select><div class="view-switch" role="group" aria-label="Kiểu hiển thị"><button type="button" class="${state.layout === "list" ? "active" : ""}" data-action="layout" data-layout="list" aria-label="Dạng danh sách" aria-pressed="${state.layout === "list"}">${icon("list")}</button><button type="button" class="${state.layout === "grid" ? "active" : ""}" data-action="layout" data-layout="grid" aria-label="Dạng lưới" aria-pressed="${state.layout === "grid"}">${icon("grid")}</button></div><button type="button" class="icon-button" data-action="refresh" aria-label="Làm mới">${icon("refresh")}</button></div></div>
      <div class="filter-tabs" role="group" aria-label="Lọc loại tệp">${filters.map(([value, label]) => `<button type="button" class="${state.fileType === value ? "active" : ""}" data-action="filter" data-filter="${value}" aria-pressed="${state.fileType === value}">${label}</button>`).join("")}</div>
      ${files.length ? `<div class="file-table ${state.layout === "grid" ? "file-grid" : ""}">${state.layout === "list" ? '<div class="table-head"><span>Tên tệp</span><span>Kích thước</span><span>Trạng thái</span><span>Ngày thêm</span><span></span></div>' : ""}${files.map((file) => fileRow(state, file)).join("")}</div>` : `<div class="empty-state"><span class="empty-illustration">${icon(state.search || state.fileType !== "all" ? "search" : "folder")}</span><h3>${state.search || state.fileType !== "all" ? "Chưa tìm thấy tệp phù hợp" : shared ? "Chưa có tệp gửi đến bạn" : "Những điều quan trọng bắt đầu ở đây"}</h3><p>${state.search || state.fileType !== "all" ? "Thử từ khóa hoặc loại tệp khác." : shared ? "Khi một liên hệ chia sẻ tệp, bạn sẽ thấy envelope dành cho mình tại đây." : "Thêm tài liệu đầu tiên. SecretVault sẽ mã hóa trước khi lưu."}</p>${!shared && !state.search ? button("Chọn tệp đầu tiên", "upload", "", true, "plus") : ""}</div>`}
      ${!shared ? `<button type="button" class="upload-zone" data-action="upload">${icon("cloud")}<span><strong>Kéo thả tệp vào không gian này</strong><small>hoặc <b>chọn từ thiết bị</b> · tối đa 256 MiB / tệp</small></span><span class="upload-zone-lock">${icon("lock")}</span></button>` : ""}
    </section>
    <aside class="vault-aside"><section class="quick-share-card"><span class="aside-label">CHIA SẺ THEO CÁCH CỦA BẠN</span><button type="button" class="mode-option" data-view="live"><span class="mode-icon violet">${icon("live")}</span><span><strong>Gửi trực tiếp</strong><small>Cả hai cùng online</small></span>${icon("chevron")}</button><button type="button" class="mode-option" data-action="share-first"><span class="mode-icon peach">${icon("share")}</span><span><strong>Chia sẻ offline</strong><small>Người nhận mở bất cứ lúc nào</small></span>${icon("chevron")}</button><div class="mode-note">${icon("shield")} Hai cách gửi. Cùng một quyền riêng tư.</div></section>
      <section class="recent-activity"><div class="section-head"><h3>Hoạt động gần đây</h3>${icon("clock")}</div>${state.remote.activity.length ? state.remote.activity.slice(0, 4).map((item) => `<div class="activity-item"><span class="activity-symbol">${icon("check")}</span><div><strong>${esc(item.message)}</strong><small>${date(item.created)}</small></div></div>`).join("") : `<div class="activity-empty">${icon("activity")}<p>Mỗi lần lưu và chia sẻ tệp sẽ được ghi lại ở đây.</p></div>`}</section>
    </aside></div>`;
}

function fileRow(state, file) {
  const manifest = file.manifest;
  const verified = state.verified.get(file.id);
  const valid = state.signatures.get(file.id);
  const own = file.ownerId === state.user.id;
  const signatureFailed = state.signatures.has(file.id) && !valid;
  const status = verified ? "Đã kiểm tra" : valid ? "Đã ký xác thực" : signatureFailed ? "Chữ ký lỗi" : "Chờ kiểm tra";
  return `<article class="file-row"><div class="file-main">${fileBadge(file)}<div class="file-name-wrap"><strong class="file-name" title="${esc(manifest.name)}">${esc(manifest.name)}</strong><span class="file-subline">${own ? "Chỉ bạn và người được cấp quyền" : "Từ " + esc(peer(state, file.ownerId)?.name || "liên hệ")}</span></div></div><span class="cell-muted file-size">${size(manifest.size)}</span><span class="${verified ? "security-chip" : valid ? "protocol-chip" : signatureFailed ? "status-chip danger" : "status-chip pending"}">${icon(verified ? "circleCheck" : valid ? "shield" : "clock")}${status}</span><time class="cell-muted file-date">${date(manifest.created)}</time><div class="row-actions"><button type="button" class="icon-button" aria-label="Kiểm tra mật mã" title="Crypto Inspector" data-action="inspect" data-id="${file.id}">${icon("shield")}</button><button type="button" class="icon-button" aria-label="Giải mã và tải" title="Giải mã & tải" data-action="download" data-id="${file.id}">${icon("download")}</button>${own ? `<button type="button" class="icon-button" aria-label="Chia sẻ offline" title="Chia sẻ offline" data-action="share" data-id="${file.id}">${icon("share")}</button>` : ""}</div></article>`;
}

function contacts(state) {
  const list = state.remote.contacts.map((contact) => peer(state, contact.peer_id)).filter(Boolean);
  return `${hero("DANH TÍNH KHÓA CÔNG KHAI", "Những người bạn tin tưởng", "Kết nối bằng email. Xác minh fingerprint. Chia sẻ an tâm.")}
    <section class="contact-search-card"><span class="contact-search-icon">${icon("contacts")}</span><form data-form="contact" class="contact-search"><div><label for="contact-email" class="field-label">Thêm một liên hệ</label><input id="contact-email" class="field-input" type="email" placeholder="Nhập email tài khoản trên cùng host" required /></div><button type="submit" class="button primary">${icon("search")} Tìm public key →</button></form></section>
    ${state.candidate ? `<section class="candidate-card"><div class="contact-main">${avatar(state.candidate, true)}<div><h2>${esc(state.candidate.name)}</h2><span>${esc(state.candidate.email)}</span></div><span class="protocol-chip">${icon("key")} Khóa công khai</span></div><label class="field-label">Fingerprint · SHA-256</label><code class="fingerprint">${esc(state.candidate.public.fingerprint)}</code><p class="form-hint">Đối chiếu fingerprint với người đó qua một kênh độc lập trước khi ghim. Ghim lần đầu (TOFU) chưa thay thế chứng chỉ CA.</p><div class="button-row">${button("Ghim public key này", "pin-candidate", "", true, "shield")}</div></section>` : ""}
    <section class="section"><div class="section-head"><h2>Danh bạ của bạn <span class="count-badge">${list.length}</span></h2><span class="muted">Khóa đã ghim không bị tự động thay thế.</span></div><div class="contacts-grid">${list.length ? list.map((user) => `<article class="contact-card"><div class="contact-main">${avatar(user, true)}<div><h3>${esc(user.name)}</h3><span>${esc(user.email)}</span></div><span class="online-label ${user.online ? "" : "offline"}"><span class="status-dot"></span>${user.online ? "Online" : "Offline"}</span></div><div class="contact-fingerprint"><span>${icon("key")} Fingerprint</span><code>${esc(short(user.public.fingerprint))}</code></div><div class="contact-card-foot"><span class="security-chip">${icon("shield")} Đã ghim public key</span><span class="muted">ElGamal · 3072 bit</span></div></article>`).join("") : `<div class="empty-state"><span class="empty-illustration">${icon("contacts")}</span><h3>Chia sẻ bắt đầu bằng một kết nối</h3><p>Tìm email của người nhận ở phía trên để thêm public key vào danh bạ.</p></div>`}</div></section>`;
}

function live(state) {
  const contacts = state.remote.contacts.map((contact) => peer(state, contact.peer_id)).filter(Boolean);
  const labels = { offered: "Chờ người nhận", accepted: "Đã trao khóa", sent: "Chờ giải mã", complete: "Người nhận đã xác minh", expired: "Hết hạn · gửi lại", rejected: "Đã từ chối" };
  return `${hero("LIVE TRANSFER · DIFFIE–HELLMAN", "Một kết nối. Một khóa phiên riêng.", "Gửi tệp trực tiếp khi bạn và người nhận cùng mở SecretVault.", button("Mở tab tài khoản khác ↗", "new-tab", "", false, "arrowUp"))}
    <div class="live-layout"><section class="process-card live-form-card"><div class="card-title"><span class="card-title-icon">${icon("live")}</span><div><h2>Bắt đầu phiên gửi</h2><p>Một khóa phiên mới cho mỗi lần chia sẻ.</p></div><span class="protocol-chip">Diffie–Hellman</span></div><form data-form="live" class="form-grid"><div><label class="field-label">Tệp cần gửi</label><button type="button" class="live-file-picker ${state.liveFile ? "has-file" : ""}" data-action="choose-live">${state.liveFile ? fileBadge(state.liveFile, true) : `<span class="upload-circle">${icon("upload")}</span>`}<strong>${state.liveFile ? esc(state.liveFile.name) : "Chọn tệp để gửi"}</strong><small>${state.liveFile ? size(state.liveFile.size) + " · Chọn tệp khác" : "Từ thiết bị của bạn · tối đa 256 MiB"}</small></button></div><div><label class="field-label" for="live-recipient">Gửi đến</label><select id="live-recipient" class="field-select" required><option value="">Chọn liên hệ đã ghim khóa</option>${contacts.map((user) => `<option value="${user.id}">${esc(user.name)} · ${user.online ? "Online" : "Offline"}</option>`).join("")}</select></div><button type="submit" class="button primary live-submit" ${state.busy ? "disabled" : ""}>${icon("lock")}${state.busy || "Gửi lời mời an toàn →"}</button><p class="form-hint centered">${icon("shield")} Tệp chỉ được gửi sau khi người nhận xác nhận.</p></form></section>
    <aside class="live-guide"><h2>Riêng tư trong từng bước.</h2><p>Khóa phiên được tạo giữa hai thiết bị của bạn.</p><div class="step-list">${[["key", "Xác thực đúng người", "Public key DH được ký và kiểm tra với khóa đã ghim."], ["live", "Tạo khóa phiên chung", "Hai phía dùng DH và HKDF để tạo khóa AES-GCM mới."], ["shield", "Kiểm tra trước khi nhận", "Chữ ký, hash và tag mã hóa đều phải hợp lệ."]].map(([glyph, title, description], index) => `<div class="step-item"><span class="step-number">${icon(glyph)}</span><div><small>0${index + 1}</small><strong>${title}</strong><p>${description}</p></div></div>`).join("")}</div><div class="guide-note">${icon("clock")} Phiên có hiệu lực tối đa 15 phút. Nếu tải lại tab, hãy tạo lời mời mới.</div></aside></div>
    <section class="section"><div class="section-head"><h2>Phiên live của bạn <span class="count-badge">${state.remote.live.length}</span></h2><span class="muted">Mã hóa giữa hai phía · Python chuyển tiếp ciphertext</span></div><div class="transfer-stack">${state.remote.live.length ? state.remote.live.map((item) => {
      const receiver = item.recipientId === state.user.id;
      const user = peer(state, receiver ? item.senderId : item.recipientId);
      const memory = receiver ? state.incoming.get(item.id) : state.outgoing.get(item.id);
      const ready = item.state === "sent" && receiver && memory;
      return `<article class="transfer-card"><div class="transfer-head"><div class="transfer-title">${fileBadge({ name: item.offer.name })}<div><strong>${esc(item.offer.name)}</strong><span>${receiver ? "Từ " : "Đến "}${esc(user?.name || "liên hệ")} · ${size(item.offer.size)}</span></div></div><span class="status-chip ${item.state === "complete" ? "success" : "info"}">${icon(item.state === "complete" ? "circleCheck" : "clock")}${labels[item.state]}</span></div><div class="transfer-meta"><span class="protocol-chip">DH-3072</span><span class="security-chip">${icon("lock")} Phiên được mã hóa</span><div class="button-row">${receiver && item.state === "offered" ? button("Nhận an toàn", "accept-live", `data-id="${item.id}"`, true, "check") + button("Từ chối", "reject-live", `data-id="${item.id}"`) : ""}${ready ? button("Xác minh, giải mã & tải", "receive-live", `data-id="${item.id}"`, true, "download") : ""}</div>${receiver && item.state === "sent" && !memory ? '<p class="form-hint">Khóa tạm không còn trong tab. Yêu cầu người gửi tạo phiên mới.</p>' : ""}</div></article>`;
    }).join("") : `<div class="empty-state"><span class="empty-illustration">${icon("live")}</span><h3>Chưa có phiên live</h3><p>Mời một liên hệ online để bắt đầu kết nối đầu tiên.</p></div>`}</div></section>`;
}

function settings(state) {
  return `${hero("TÀI KHOẢN & KẾT NỐI", "Một danh tính. Một không gian riêng.", "Quản lý khóa công khai và địa chỉ máy chủ của bạn.")}
    <div class="settings-layout"><section class="key-card"><div class="contact-main">${avatar(state.user, true)}<div><h2>${esc(state.user.name)}</h2><span>${esc(state.user.email)}</span></div><span class="security-chip">${icon("shield")} Khóa đã mở</span></div><label class="field-label">Fingerprint khóa công khai của bạn</label><code class="fingerprint">${esc(state.user.public.fingerprint)}</code><div class="key-line"><span>Danh tính xác thực</span><strong>Ed25519</strong></div><div class="key-line"><span>Chia sẻ offline</span><strong>ElGamal Hybrid · MODP3072</strong></div><div class="key-line"><span>Bảo vệ private key</span><strong>Mã hóa bằng mật khẩu</strong></div><div class="settings-actions">${button("Sao lưu gói khóa mã hóa", "backup-keys", "", true, "download")}${button("Khóa & đăng xuất", "logout", "", false, "logout")}</div><p class="form-hint">Backup vẫn cần mật khẩu. Gói khóa không thay thế bản sao các tệp trên máy chủ.</p></section><section class="process-card host-card"><span class="card-title-icon">${icon("server")}</span><h2>Máy chủ đang kết nối</h2><code class="server-address">${esc(location.origin)}</code><p>Trên cùng PC, mở hai tab để dùng hai tài khoản. Trên hai PC, đăng nhập cùng một địa chỉ host HTTPS.</p>${button("Mở tab đăng nhập thứ hai", "new-tab", "", false, "arrowUp")}<div class="guide-note">${icon("info")} Đóng bảng điều khiển PC sẽ dừng server do bảng đó khởi chạy.</div></section></div>
    <details class="technical-details section"><summary>${icon("info")} Thông tin bảo mật & giới hạn ${icon("chevronDown")}</summary><div><p>Private bundle dùng PBKDF2-SHA256 600.000 vòng và AES-GCM. Tên tệp, kích thước, email và thời gian là metadata server có thể thấy.</p><p>Ghim fingerprint dùng TOFU, chưa thay thế CA/PKI. Thu hồi chia sẻ chặn lần tải tiếp, không xóa bản đã giải mã của người nhận. Mã BigInt của đồ án chưa qua kiểm toán bảo mật hoặc timing chuyên dụng.</p></div></details>`;
}

function modal(state) {
  if (!state.modal) return "";
  const file = state.remote.files.find((item) => item.id === state.modal.id);
  if (!file) return "";
  const owner = peer(state, file.ownerId);
  const own = file.ownerId === state.user.id;
  const inspecting = state.modal.type === "inspect";
  let content;
  if (!inspecting) {
    const contacts = state.remote.contacts.map((contact) => peer(state, contact.peer_id)).filter(Boolean);
    const shares = state.remote.shares.filter((item) => item.fileId === file.id && !item.revoked && item.senderId === state.user.id);
    content = `<div class="modal-symbol">${icon("share")}</div><p class="eyebrow">ELGAMAL · OFFLINE SHARE</p><h2 id="modal-title">Chia sẻ offline</h2><p class="modal-description">Một envelope riêng. Dành đúng người nhận.</p><div class="modal-file">${fileBadge(file)}<div><strong>${esc(file.manifest.name)}</strong><span>${size(file.manifest.size)} · Đã mã hóa trong vault</span></div>${icon("lock")}</div><form class="form-grid" data-form="share" data-id="${file.id}"><div><label class="field-label" for="share-recipient">Chia sẻ với</label><select id="share-recipient" class="field-select" required><option value="">Chọn liên hệ đã ghim khóa</option>${contacts.map((user) => `<option value="${user.id}">${esc(user.name)} · ${esc(user.email)}</option>`).join("")}</select></div><div class="share-note">${icon("shield")}<p>Người nhận mở tệp bằng private key của họ. Bạn có thể offline sau khi tạo envelope.</p></div><button type="submit" class="button primary" ${state.busy ? "disabled" : ""}>${icon("share")}${state.busy || "Tạo envelope & ký →"}</button></form>${!contacts.length ? '<p class="form-hint">Thêm người nhận vào danh bạ trước khi chia sẻ.</p>' : ""}${shares.length ? `<section class="section"><h3>Đang có quyền truy cập</h3>${shares.map((share) => `<div class="key-line"><span>${esc(peer(state, share.recipientId)?.name)}</span>${button("Thu hồi quyền tải tiếp", "revoke", `data-id="${share.id}"`)}</div>`).join("")}</section>` : ""}<p class="form-hint">Thu hồi không xóa bản sao người nhận đã giải mã.</p>`;
  } else {
    const checked = !!state.verified.get(file.id);
    const signed = !!state.signatures.get(file.id);
    const evidence = { fileId: file.id, manifestHash: file.manifestHash, algorithm: file.manifest.algorithm, chunkCount: file.manifest.chunks.length, chunk0: file.manifest.chunks[0], signature: file.signature, keyEnvelope: file.share?.payload.envelope || "AES-GCM owner wrap", signatureChecked: !!state.signatures.get(file.id), contentChecked: checked };
    content = `<div class="inspector-title"><span class="card-title-icon">${icon("shield")}</span><div><p class="eyebrow">CRYPTO INSPECTOR</p><h2 id="modal-title">Bên trong lớp bảo vệ</h2></div></div><div class="modal-file">${fileBadge(file)}<div><strong>${esc(file.manifest.name)}</strong><span>${size(file.manifest.size)} · ${file.manifest.chunks.length} khối mã hóa</span></div></div><div class="integrity-callout ${checked ? "checked" : ""}">${icon(checked ? "circleCheck" : "shield")}<div><strong>${checked ? "Đã kiểm tra toàn bộ" : signed ? "Chữ ký đã được kiểm tra" : "Chữ ký chưa hợp lệ"}</strong><p>${checked ? "Mọi khối dữ liệu đều vượt qua xác minh hash và tag AES-GCM." : "Kiểm tra toàn bộ để xác minh thêm nội dung và tag AES-GCM."}</p></div></div><div class="inspector-facts">${[["Chủ sở hữu", owner?.name], ["Mã hóa nội dung", "AES-256-GCM"], ["Chuyển khóa", own ? "Khóa vault riêng" : "ElGamal Hybrid + HKDF"], ["Chữ ký manifest", state.signatures.get(file.id) ? "Đã xác minh Ed25519" : "Chưa hợp lệ"], ["Khóa người gửi", own || pinned(state, owner) ? "Đã xác minh / ghim" : "Chưa ghim fingerprint"]].map(([label, value]) => `<div><span>${label}</span><strong>${esc(value)}</strong></div>`).join("")}</div><details class="technical-details"><summary>${icon("code")} Thông số mật mã ${icon("chevronDown")}</summary><pre class="code-block">${esc(JSON.stringify(evidence, null, 2))}</pre></details><div class="inspector-actions">${!own && !pinned(state, owner) ? button("Xem & ghim khóa người gửi", "trust-sender", `data-id="${owner.id}"`, false, "key") : ""}${button("Kiểm tra toàn bộ nội dung", "verify-file", `data-id="${file.id}"`, true, "shield")}${button("Tải bằng chứng JSON", "evidence", `data-id="${file.id}"`, false, "download")}</div>`;
  }
  return `<div class="modal-layer ${inspecting ? "drawer-layer" : ""}" data-action="close-modal"><section class="modal ${inspecting ? "inspector-drawer" : ""}" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button type="button" class="icon-button modal-close" data-action="close-modal" aria-label="Đóng">${icon("close")}</button>${content}</section></div>`;
}
