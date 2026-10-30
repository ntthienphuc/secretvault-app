import { icon } from "./icons.js";

export const esc = (v) => String(v ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
export const size = (v = 0) => v < 1024 ? `${v} B` : v < 1048576 ? `${(v / 1024).toFixed(1)} KiB` : `${(v / 1048576).toFixed(1)} MiB`;
const date = (v) => new Intl.DateTimeFormat("vi", { dateStyle: "short", timeStyle: "short" }).format(v);
const peer = (s, id) => s.remote.users.find((u) => u.id === id);
const initials = (name) => (name || "SV").split(" ").filter(Boolean).slice(-2).map((w) => w[0]).join("").toUpperCase();
const avatar = (user) => `<span class="avatar">${esc(initials(user.name))}</span>`;
const btn = (label, action, extra = "", primary = false, glyph = "") => `<button type="button" class="button ${primary ? "primary" : "secondary"}" data-action="${action}" ${extra}>${glyph ? icon(glyph) : ""}<span>${label}</span></button>`;
const brand = () => `<a class="brand" href="/" aria-label="SecretVault"><span class="brand-mark">${icon("vault")}</span><span>Secret<span class="brand-light">Vault</span></span></a>`;
const badge = (name = "file") => {
  const ext = name.includes(".") ? name.split(".").pop().slice(0, 5).toUpperCase() : "FILE";
  const image = /^(PNG|JPG|JPEG|WEBP|GIF|SVG)$/.test(ext);
  return `<span class="file-badge ${image ? "blue" : ext === "PDF" ? "rose" : "violet"}">${icon(image ? "image" : "file")}<small>${esc(ext)}</small></span>`;
};
const empty = (glyph, title, text, action = "") => `<div class="empty-state"><span class="empty-symbol">${icon(glyph)}</span><h3>${title}</h3><p>${text}</p>${action}</div>`;
const title = (eyebrow, headline, text, actions = "") => `<div class="page-title"><div><p class="eyebrow">${eyebrow}</p><h1>${headline}</h1><p class="muted">${text}</p></div><div class="title-actions">${actions}</div></div>`;

export function authView(s) {
  const register = s.authMode === "register";
  return `<main class="auth-layout" id="main-content"><section class="auth-story">${brand()}<div class="auth-copy"><span class="label-pill">${icon("shield")} KHÔNG GIAN CỦA RIÊNG BẠN</span><h1>Tệp của bạn.<br><em>Đúng người nhận.</em></h1><p>Lưu một nơi. Chia sẻ dễ dàng.<br>Mở trên máy tính hoặc điện thoại.</p></div><div class="auth-art"><img src="/assets/vault-art.svg" width="440" height="300" alt="Két tài liệu SecretVault"/><span class="art-note">${icon("circleCheck")} Bảo vệ tự động trên thiết bị</span></div><div class="auth-features"><span>${icon("folder")} Lưu trữ riêng</span><span>${icon("share")} Chia sẻ linh hoạt</span><span>${icon("live")} Gửi trực tiếp</span></div><p class="story-footer">Từ máy tính đến điện thoại. Luôn là không gian của bạn.</p></section><section class="auth-form-side"><div class="auth-top">${icon("shield")} Riêng tư trong từng lần chia sẻ</div><div class="auth-card"><div class="auth-symbol">${icon(register ? "contacts" : "lock")}</div><p class="eyebrow">${register ? "KHỞI ĐẦU THẬT ĐƠN GIẢN" : "CHÀO MỪNG BẠN TRỞ LẠI"}</p><h2>${register ? "Tạo không gian của bạn" : "Đăng nhập SecretVault"}</h2><p class="muted">${register ? "Chỉ vài bước để bắt đầu lưu trữ và chia sẻ." : "Tiếp tục với tài liệu và những kết nối của bạn."}</p><div class="auth-tabs"><button type="button" data-action="auth-mode" data-mode="login" class="${register ? "" : "active"}">Đăng nhập</button><button type="button" data-action="auth-mode" data-mode="register" class="${register ? "active" : ""}">Tạo tài khoản</button></div><form data-form="auth" class="form-grid">${register ? '<label class="field-label" for="auth-name">Tên của bạn<input id="auth-name" class="field-input" autocomplete="name" placeholder="Tên hiển thị" maxlength="80" required/></label>' : ""}<label class="field-label" for="auth-email">Email<input id="auth-email" class="field-input" type="email" autocomplete="username" placeholder="ban@example.com" value="${esc(s.loginEmail)}" required/></label><div class="field-label password-field"><label for="auth-password">Mật khẩu</label><input id="auth-password" class="field-input" type="password" autocomplete="${register ? "new-password" : "current-password"}" placeholder="Tối thiểu 10 ký tự" minlength="10" maxlength="200" required/><button type="button" class="password-toggle" data-action="toggle-password" data-target="auth-password" aria-label="Hiện hoặc ẩn mật khẩu" aria-pressed="false">Hiện</button></div>${register ? '<label class="field-label" for="auth-confirm">Nhập lại mật khẩu<input id="auth-confirm" class="field-input" type="password" autocomplete="new-password" placeholder="Xác nhận mật khẩu" maxlength="200" required/></label><p class="form-hint">Hãy giữ mật khẩu ở nơi an toàn. Bản hiện tại chưa hỗ trợ khôi phục mật khẩu.</p>' : ""}<button class="button primary auth-submit" type="submit" ${s.busy || s.service !== "ready" ? "disabled" : ""}>${s.busy || (register ? "Tạo tài khoản" : "Đăng nhập")}${icon("chevron")}</button></form><div id="service-status" role="status" class="service-status ${s.service}">${s.service === "ready" ? "Đã kết nối an toàn" : s.service === "connecting" ? "Đang kết nối máy chủ… Lần mở đầu có thể cần một phút." : 'Máy chủ chưa sẵn sàng. <button type="button" data-action="check-service">Kết nối lại</button>'}</div><div class="auth-assurance">${icon("shield")} Tài liệu được bảo vệ trước khi rời thiết bị.</div></div><footer class="auth-footer">SecretVault <span>Không gian riêng. Chia sẻ dễ dàng.</span></footer></section></main>`;
}

const navButton = (view, glyph, label, current, count = 0) => `<button type="button" data-view="${view}" class="nav-item ${current === view ? "active" : ""}" ${current === view ? 'aria-current="page"' : ""}>${icon(glyph)}<span>${label}</span>${count ? `<small>${count}</small>` : ""}</button>`;
const contactOptions = (s, id) => `<datalist id="${id}">${s.remote.contacts.map(c => peer(s, c.peer_id)).filter(Boolean).map(u => `<option value="${esc(u.email)}">${esc(u.name)}</option>`).join("")}</datalist>`;
const invitations = (s) => s.remote.live.filter(x => x.recipientId === s.user.id && ["offered", "accepted", "sent"].includes(x.state));

export function shell(s) {
  const shared = s.remote.files.filter(f => f.ownerId !== s.user.id);
  const pending = invitations(s);
  const account = s.remote.account || { used: 0, quota: 104857600 };
  const percent = Math.min(100, account.used / Math.max(account.quota, 1) * 100);
  const mainNav = [["vault", "folder", "Tệp của tôi", 0], ["shared", "download", "Đã nhận", shared.length], ["live", "live", "Gửi trực tiếp", pending.length]];
  return `<div class="app-shell">
    <aside class="sidebar">
      ${brand()}
      <div class="sidebar-navigation"><p class="nav-label">KHÔNG GIAN CỦA BẠN</p>
        <nav class="nav-list" aria-label="Điều hướng chính">${mainNav.map(([v,g,l,n]) => navButton(v,g,l,s.view,n)).join("")}</nav>
        <div class="nav-secondary">${navButton("contacts","contacts","Danh bạ",s.view)}${navButton("trash","trash","Thùng rác",s.view)}</div>
      </div>
      <div class="sidebar-bottom">
        ${s.user.role === "admin" ? navButton("admin","shield","Quản trị",s.view) : ""}
        <div class="storage-card"><div><span>Dung lượng</span><strong>${Math.round(percent)}%</strong></div><div class="meter" role="meter" aria-label="Dung lượng đã sử dụng" aria-valuenow="${Math.round(percent)}" aria-valuemin="0" aria-valuemax="100"><span style="width:${percent}%"></span></div><small>${size(account.used)} / ${size(account.quota)}</small></div>
        <button type="button" class="sidebar-user ${s.view === "settings" ? "active" : ""}" data-view="settings" aria-label="Tài khoản của ${esc(s.user.name)}">${avatar(s.user)}<span><strong>${esc(s.user.name)}</strong><small>Tài khoản</small></span>${icon("chevron")}</button>
      </div>
    </aside>
    <div class="workspace">
      <header class="topbar"><span class="workspace-label">${icon("shield")} Không gian riêng tư</span><span class="mobile-brand">SecretVault</span><div class="topbar-right"><span class="connection ${s.connected ? "" : "offline"}"><i></i>${s.connected ? "Đã kết nối" : "Đang kết nối lại…"}</span></div></header>
      <main class="page" id="main-content" tabindex="-1">
        ${pending.length && s.view !== "live" ? `<aside class="incoming-banner" role="status"><span class="incoming-symbol">${icon("download")}</span><div><strong>Bạn có ${pending.length} lời mời nhận tệp</strong><span>Mở để xác nhận và tải tệp từ người gửi.</span></div><button type="button" class="button secondary" data-view="live">Xem lời mời ${icon("chevron")}</button></aside>` : ""}
        ${page(s)}
      </main>
      <footer class="workspace-footer">${icon("lock")} Nội dung được bảo vệ trên thiết bị của bạn.</footer>
    </div>
    <nav class="mobile-nav" aria-label="Điều hướng di động">${[...mainNav, ["settings","settings","Tài khoản",0]].map(([v,g,l,n])=>`<button type="button" data-view="${v}" class="${s.view===v?"active":""}" ${s.view===v?'aria-current="page"':""}>${icon(g)}<span>${v==="vault"?"Tệp của tôi":l}</span>${n?'<i class="nav-dot" aria-label="Có tệp hoặc lời mời"></i>':""}</button>`).join("")}</nav>
    </div><input id="upload-input" type="file" hidden multiple/><input id="live-input" type="file" hidden/>${modal(s)}`;
}

function page(s) {
  if (s.view === "trash") return trash(s);
  if (s.view === "contacts") return contacts(s);
  if (s.view === "live") return live(s);
  if (s.view === "settings") return settings(s);
  if (s.view === "admin") return admin(s);
  if (s.view === "setup") return setup(s);
  return files(s);
}

function uploadHero(s) {
  const recent = s.remote.files.find(f => f.id === s.recentUploadId && f.ownerId === s.user.id);
  return recent ? `<section class="upload-hero upload-complete" aria-label="Tệp vừa tải lên">
    <span class="hero-symbol success">${icon("circleCheck")}</span><div class="hero-copy"><span class="eyebrow">ĐÃ LƯU VÀO KHÔNG GIAN RIÊNG</span><h2>${esc(recent.manifest.name)}</h2><p>Chỉ bạn xem được. Gửi cho người khác khi bạn sẵn sàng.</p></div>
    <div class="hero-actions">${btn("Chia sẻ tệp", "share", `data-id="${recent.id}"`,true,"share")}<button type="button" class="text-button" data-action="upload">Tải thêm tệp</button></div>
  </section>` : `<section class="upload-hero" aria-label="Tải tệp lên">
    <span class="hero-symbol">${icon("upload")}</span><div class="hero-copy"><span class="eyebrow">LƯU RIÊNG. CHIA SẺ DỄ DÀNG.</span><h2>${s.remote.files.some(f => f.ownerId === s.user.id) ? "Tải lên. Sẵn sàng chia sẻ." : "Bắt đầu bằng một tệp."}</h2><p>Kéo thả vào đây, hoặc chọn từ thiết bị của bạn.</p><small>Tối đa 25 MiB mỗi tệp · Chỉ chia sẻ khi bạn cho phép</small></div>
    <div class="hero-actions">${btn("Tải tệp lên","upload","",true,"plus")}</div>
  </section>`;
}

function files(s) {
  const shared = s.view === "shared";
  const all = s.remote.files.filter(f => (f.ownerId !== s.user.id) === shared);
  const filtered = !!s.search.trim() || s.fileType !== "all";
  let list = all.filter(f => f.manifest.name.toLowerCase().includes(s.search.trim().toLowerCase()));
  if (s.fileType === "document") list = list.filter(f => /\.(pdf|docx?|txt|pptx?|xlsx?|csv|md)$/i.test(f.manifest.name));
  if (s.fileType === "image") list = list.filter(f => /\.(png|jpe?g|webp|gif|svg)$/i.test(f.manifest.name));
  list.sort((a,b) => s.sort === "name" ? a.manifest.name.localeCompare(b.manifest.name) : b.manifest.created-a.manifest.created);
  return `${title("",shared ? "Tệp được gửi cho bạn" : "Tệp của tôi",shared ? "Mở và tải xuống. Người gửi không cần đang online." : `Chào ${esc(s.user.name.split(" ").pop())}, tài liệu của bạn ở đây.`)}
    ${!shared ? uploadHero(s) : ""}
    <section class="panel files-panel" aria-label="Danh sách tệp">
      <div class="files-toolbar"><h2>${shared ? "Đã nhận" : "Tất cả tệp"}<span class="count-badge">${all.length}</span></h2>
        <div class="file-tools"><label class="search-box">${icon("search")}<input id="search" type="search" aria-label="Tìm tệp" placeholder="Tìm tên tệp…" value="${esc(s.search)}"/></label>
          <details class="filter-menu" id="file-options"><summary id="file-options-toggle" class="icon-button ${filtered ? "is-filtered" : ""}" aria-label="Lọc và sắp xếp">${icon("filter")}</summary><div class="options-popover"><label class="field-label" for="file-type">Loại tệp<select id="file-type" class="field-input">${[["all","Tất cả"],["document","Tài liệu"],["image","Hình ảnh"]].map(([v,l])=>`<option value="${v}" ${s.fileType===v?"selected":""}>${l}</option>`).join("")}</select></label><label class="field-label" for="file-sort">Sắp xếp<select id="file-sort" class="field-input"><option value="newest" ${s.sort === "newest" ? "selected" : ""}>Mới nhất</option><option value="name" ${s.sort === "name" ? "selected" : ""}>Tên A–Z</option></select></label></div></details>
        </div>
      </div>
      ${filtered ? `<div class="filter-summary"><span>${list.length} kết quả${s.search.trim()?` cho “${esc(s.search.trim())}”`:""}${s.fileType!=="all"?` · ${s.fileType==="image"?"Hình ảnh":"Tài liệu"}`:""}</span><button type="button" class="text-button" data-action="clear-filters">Xóa bộ lọc ${icon("close")}</button></div>` : ""}
      ${list.length ? `<div class="file-table"><div class="file-row table-header"><span>Tên tệp</span><span>${shared?"Người gửi":"Cập nhật"}</span><span>Dung lượng</span><span></span></div>${list.map(f => fileRow(s,f,shared)).join("")}</div>` : empty(shared?"download":"folder", filtered ? "Chưa tìm thấy tệp" : shared ? "Bạn chưa nhận tệp nào" : "Không gian cho tài liệu của bạn", filtered ? "Thử tên khác hoặc xóa bộ lọc để xem tất cả." : shared ? "Người gửi chỉ cần nhập email tài khoản của bạn. Tệp sẽ xuất hiện ở đây." : "Tải tệp ở phía trên. Sau đó chọn Chia sẻ để gửi cho người khác.")}
    </section><p class="page-note">${icon("info")}${shared?"Tệp được cập nhật tự động khi có người chia sẻ với bạn.":"Tệp đã chia sẻ vẫn ở đây. Bạn có thể thu hồi quyền truy cập bất cứ lúc nào."}</p>`;
}

function fileRow(s,f,shared) {
  const count = s.remote.shares.filter(x=>x.fileId===f.id&&!x.revoked&&x.senderId===s.user.id).length;
  const status = s.signatures.get(f.id) === false ? "Cần kiểm tra lại tệp" : shared ? `Từ ${esc(peer(s,f.ownerId)?.name||"Người gửi")}` : count ? `Đã chia sẻ · ${count} người` : "Chỉ mình bạn";
  return `<article class="file-row ${s.recentUploadId===f.id?"recent-file":""}">
    <div class="file-name">${badge(f.manifest.name)}<div><strong title="${esc(f.manifest.name)}">${esc(f.manifest.name)}</strong><small><span class="mobile-file-size">${size(f.manifest.size)} · </span>${status}</small></div></div>
    <span class="file-date">${shared?esc(peer(s,f.ownerId)?.name||"Người gửi"):date(f.manifest.created)}</span><span class="file-size">${size(f.manifest.size)}</span>
    <div class="file-actions">${shared ? btn("Tải xuống","download",`data-id="${f.id}" aria-label="Tải ${esc(f.manifest.name)}"`,false,"download") : `${btn("Chia sẻ","share",`data-id="${f.id}" aria-label="Chia sẻ ${esc(f.manifest.name)}"`,false,"share")}
      <details class="file-menu" id="menu-${f.id}"><summary id="menu-toggle-${f.id}" class="icon-button" aria-label="Thêm thao tác với ${esc(f.manifest.name)}">${icon("more")}</summary><div class="options-popover file-popover"><button type="button" data-action="download" data-id="${f.id}">${icon("download")} Tải xuống</button><button type="button" class="danger-text" data-action="trash-file" data-id="${f.id}">${icon("trash")} Chuyển vào thùng rác</button></div></details>`}</div>
  </article>`;
}

function contacts(s) {
  const users = s.remote.contacts.map(c=>peer(s,c.peer_id)).filter(Boolean);
  return `${title("","Danh bạ","Những người bạn đã kết nối. Bạn cũng có thể gửi trực tiếp bằng email.")}
    <div class="two-col"><section class="panel form-panel"><h2>Thêm người nhận</h2><p class="muted">Dùng email đã đăng ký SecretVault.</p><form data-form="contact" class="form-grid"><label class="field-label" for="contact-email">Email<input class="field-input" id="contact-email" type="email" placeholder="ban@example.com" required/></label><button class="button primary" ${s.busy?"disabled":""}>${icon("plus")} Thêm liên hệ</button></form></section>
    <section class="panel"><div class="section-head"><h2>Liên hệ<span class="count-badge">${users.length}</span></h2></div>${users.length?`<div class="contact-list">${users.map(u=>`<article class="contact-row">${avatar(u)}<div><strong>${esc(u.name)}</strong><small>${esc(u.email)}</small></div><span class="status-chip ${u.online?"success":""}">${u.online?"Đang online":"Ngoại tuyến"}</span></article>`).join("")}</div>`:empty("contacts","Chưa có liên hệ","Người nhận sẽ được thêm tự động khi bạn chia sẻ tệp.")}</section></div>`;
}

function transferCard(s,item) {
  const receiver = item.recipientId === s.user.id;
  const user = peer(s,receiver?item.senderId:item.recipientId);
  const memory = receiver?s.incoming.get(item.id):s.outgoing.get(item.id);
  const labels={offered:"Chờ xác nhận",accepted:"Đang gửi",sent:"Sẵn sàng tải",complete:"Đã nhận",rejected:"Đã từ chối",expired:"Đã hết hạn"};
  return `<article class="panel transfer-card ${receiver&&item.state==="offered"?"needs-action":""}"><div class="transfer-title">${badge(item.offer.name)}<div><strong>${esc(item.offer.name)}</strong><small>${receiver?"Từ":"Gửi đến"} ${esc(user?.name||"Người dùng")} · ${size(item.offer.size)}</small></div><span class="status-chip ${item.state==="complete"?"success":""}">${labels[item.state]||esc(item.state)}</span></div><div class="transfer-bottom"><span class="muted">${item.expires>Date.now()&&!["complete","rejected"].includes(item.state)?`Giữ trang mở · Hết hạn ${new Date(item.expires).toLocaleTimeString("vi",{hour:"2-digit",minute:"2-digit"})}`:"Phiên đã kết thúc"}</span><div class="button-row">${receiver&&item.state==="offered"?btn("Từ chối","reject-live",`data-id="${item.id}"`)+btn("Nhận tệp","accept-live",`data-id="${item.id}"`,true,"check"):""}${receiver&&item.state==="sent"&&memory?btn("Tải xuống","receive-live",`data-id="${item.id}"`,true,"download"):""}${(receiver?["accepted","sent"].includes(item.state):item.state==="accepted")&&!memory?'<small class="form-hint">Phiên trên thiết bị này đã đóng. Hãy tạo lời mời mới.</small>':""}</div></div></article>`;
}

function live(s) {
  const active = s.remote.live.filter(x=>["offered","accepted","sent"].includes(x.state)).sort((a,b)=>Number(b.recipientId===s.user.id)-Number(a.recipientId===s.user.id));
  const history = s.remote.live.filter(x=>!["offered","accepted","sent"].includes(x.state));
  return `${title("","Gửi trực tiếp","Cả hai cùng mở SecretVault. Người nhận xác nhận trước khi bạn gửi.")}
    ${active.length?`<section class="active-transfers" aria-label="Phiên đang diễn ra"><h2>Đang diễn ra<span class="count-badge">${active.length}</span></h2><div class="transfer-stack">${active.map(x=>transferCard(s,x)).join("")}</div></section>`:""}
    <section class="panel send-panel"><div class="send-panel-heading"><span class="section-symbol">${icon("live")}</span><div><h2>Gửi một tệp mới</h2><p class="muted">Chọn tệp, nhập email, gửi lời mời.</p></div></div>
      <form data-form="live" class="form-grid">
        <div class="step-label"><span>1</span> Chọn tệp</div><button class="drop-zone ${s.liveFile?"has-file":""}" type="button" data-action="choose-live"><span>${icon(s.liveFile?"file":"upload")}</span><strong>${s.liveFile?esc(s.liveFile.name):"Chọn tệp từ thiết bị"}</strong><small>${s.liveFile?size(s.liveFile.size)+" · Bấm để đổi tệp":"Hoặc kéo thả vào đây · Tối đa 25 MiB"}</small></button>
        <label class="field-label" for="live-email"><span class="step-label"><span>2</span> Người nhận</span><input id="live-email" class="field-input" type="email" list="live-contacts" placeholder="nguoinhan@example.com" required/></label>${contactOptions(s,"live-contacts")}
        <button type="submit" class="button primary send-submit" ${s.busy||!s.liveFile?"disabled":""}>${icon("live")} Gửi lời mời</button>
        <p class="form-hint">Người nhận cần đang online. Giữ trang mở cho đến khi hiện “Đã nhận”.</p>
      </form>
    </section>
    <aside class="live-alternative">${icon("clock")}<div><strong>Người nhận sẽ mở sau?</strong><p>Tải tệp vào Tệp của tôi, rồi chọn Chia sẻ.</p></div><button type="button" class="text-button" data-view="vault">Về tệp của tôi ${icon("chevron")}</button></aside>
    ${history.length?`<details class="transfer-history" id="transfer-history"><summary>Phiên trước đây <span class="count-badge">${history.length}</span>${icon("chevron")}</summary><div class="transfer-stack">${history.map(x=>transferCard(s,x)).join("")}</div></details>`:""}`;
}

function settings(s) {
  const account=s.remote.account||{used:0,quota:104857600};
  return `${title("","Tài khoản","Thông tin của bạn và dung lượng lưu trữ.")}
    <div class="two-col"><section class="panel form-panel"><div class="profile-heading">${avatar(s.user)}<div><h2>${esc(s.user.name)}</h2><p class="muted">${esc(s.user.email)}</p></div></div><div class="account-fact"><span>Đã sử dụng</span><strong>${size(account.used)} / ${size(account.quota)}</strong></div><div class="account-fact"><span>Mỗi tệp</span><strong>Tối đa 25 MiB</strong></div><div class="settings-links">${navButton("contacts","contacts","Danh bạ",s.view)}${navButton("trash","trash","Thùng rác",s.view)}${s.user.role==="admin"?navButton("admin","shield","Quản trị",s.view):""}</div><p class="form-hint">Dùng cùng tài khoản trên web và app Windows. Nhớ đăng xuất khi dùng máy chung.</p><div class="button-row">${btn("Đăng xuất","logout","",false,"logout")}</div></section>
    <section class="panel"><div class="section-head"><h2>Hoạt động gần đây</h2></div><div class="activity-list">${s.remote.activity.length?s.remote.activity.map(a=>`<div>${icon("circleCheck")}<p>${esc(a.message)}<small>${date(a.created)}</small></p></div>`).join(""): '<p class="muted">Các lần tải lên, chia sẻ và nhận tệp sẽ xuất hiện ở đây.</p>'}</div></section></div>`;
}

function trash(s) {
  return `${title("","Thùng rác","Tệp ở đây vẫn tính vào dung lượng. Khôi phục cũng mở lại các quyền chia sẻ chưa thu hồi.")}
    <section class="panel">${s.trash===null?empty("trash","Đang mở thùng rác","Danh sách sẽ xuất hiện trong giây lát."):s.trash.length?`<div class="panel-padding trash-list">${s.trash.map(f=>`<div class="trash-row">${badge(f.name)}<span><strong>${esc(f.name)}</strong><small>${size(f.size)}</small></span>${btn("Khôi phục","restore-file",`data-id="${f.id}"`,false,"refresh")}</div>`).join("")}</div>`:empty("trash","Thùng rác đang trống","Tệp bạn chuyển vào thùng rác sẽ xuất hiện tại đây.",'<button type="button" class="button secondary" data-view="vault">Về tệp của tôi</button>')}</section>`;
}

function modal(s) {
  if (!s.modal) return "";
  const f=s.remote.files.find(f=>f.id===s.modal.id);
  if (!f) return "";
  const shares=s.remote.shares.filter(x=>x.fileId===f.id&&!x.revoked&&x.senderId===s.user.id);
  const sent=s.modal.type === "sent";
  return `<div class="modal-layer" data-action="close-modal"><section class="modal ${sent?"share-sent":""}" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button type="button" class="icon-button modal-close" data-action="close-modal" aria-label="Đóng">${icon("close")}</button>
    <span class="section-symbol ${sent?"success":""}">${icon(sent?"circleCheck":"share")}</span><h2 id="modal-title">${sent?"Đã chia sẻ tệp":"Bạn muốn gửi cho ai?"}</h2>
    <p class="muted">${sent?`${esc(s.modal.recipient.name)} có thể mở tệp trong mục <strong>Đã nhận</strong>.`:'Người nhận mở tệp bất cứ lúc nào, kể cả khi bạn offline.'}</p>
    <div class="modal-file">${badge(f.manifest.name)}<div><strong>${esc(f.manifest.name)}</strong><small>${size(f.manifest.size)}</small></div></div>
    ${sent?`<p class="sent-recipient">${icon("contacts")}${esc(s.modal.recipient.email)}</p><button type="button" class="button primary full-width" data-action="close-modal">Xong</button>`:`<form data-form="share" data-id="${f.id}" class="form-grid"><input id="share-recipient" type="hidden" value=""/><label class="field-label" for="share-email">Email người nhận<input class="field-input" id="share-email" type="email" list="share-contacts" placeholder="nguoinhan@example.com" required data-autofocus/></label>${contactOptions(s,"share-contacts")}<p class="form-hint">Nhập email đã đăng ký SecretVault. Không cần thêm danh bạ trước.</p><button type="submit" class="button primary" ${s.busy?"disabled":""}>${icon("share")} Gửi tệp</button></form>
      ${shares.length?`<details class="share-access" id="share-access"><summary>Ai có quyền xem <span class="count-badge">${shares.length}</span>${icon("chevron")}</summary>${shares.map(x=>`<div><span><strong>${esc(peer(s,x.recipientId)?.name||"Người nhận")}</strong><small>${esc(peer(s,x.recipientId)?.email||"")}</small></span>${btn("Thu hồi","revoke",`data-id="${x.id}"`)}</div>`).join("")}<p class="form-hint">Thu hồi chặn lần tải tiếp theo. Người nhận vẫn giữ được bản đã tải.</p></details>`:""}`}
  </section></div>`;
}

function admin(s) {
  if(s.user.role!=="admin") return empty("shield","Khu vực dành cho quản trị viên","Tài khoản của bạn không có quyền truy cập bảng điều khiển này.",'<button class="button primary" data-view="vault">Về không gian của tôi</button>');
  const a=s.admin;
  if(!a) return `${title("SECRET VAULT ADMIN","Tổng quan vận hành.","Đang tải dữ liệu hệ thống…",btn("Tải dữ liệu","admin-refresh","",true,"refresh"))}`;
  const kinds={"account.created":"Tạo tài khoản","account.login":"Đăng nhập","admin.activated":"Kích hoạt quản trị","account.updated":"Cập nhật tài khoản","file.uploaded":"Tải tệp lên","file.restored":"Khôi phục tệp","transfer.invited":"Gửi lời mời","transfer.accept":"Chấp nhận lời mời","transfer.finish":"Đã chuyển tệp","transfer.ack":"Người nhận đã nhận","transfer.reject":"Từ chối lời mời"};
  return `${title("SECRET VAULT ADMIN","Tổng quan vận hành.","Theo dõi tài khoản, lưu trữ và quá trình chuyển tệp.",btn("Cập nhật","admin-refresh","",true,"refresh"))}<div class="admin-stats">${[["contacts","Tài khoản",a.summary.users,`${a.summary.online} đang online`],["folder","Tệp sẵn sàng",a.summary.files,`${a.summary.shares} quyền chia sẻ`],["live","Phiên đang mở",a.summary.activeTransfers,"Lời mời và tệp đang chuyển"],["server","Dung lượng đã lưu",size(a.storage.used),`Giới hạn ${size(a.storage.quota)}`]].map(([g,l,v,t])=>`<article class="panel stat-card"><span>${icon(g)}</span><small>${l}</small><strong>${v}</strong><p>${t}</p></article>`).join("")}</div><section class="panel section"><div class="section-head"><h2>Tài khoản & hạn mức</h2><span class="status-chip success">${icon("shield")} Quyền được kiểm tra tại server</span></div><div class="table-scroll"><table class="admin-table"><thead><tr><th>Người dùng</th><th>Trạng thái</th><th>Lưu trữ</th><th>Hạn mức</th><th>Quản lý</th></tr></thead><tbody>${a.users.map(u=>`<tr><td><strong>${esc(u.name)} ${u.role==="admin"?'<span class="mini-badge">Admin</span>':""}</strong><small>${esc(u.email)}</small></td><td><span class="status-chip ${u.enabled?"success":""}">${u.enabled?u.online?"Đang online":"Hoạt động":"Tạm dừng"}</span></td><td>${size(u.used)}<small>${u.reserved?size(u.reserved)+" đang tải":""}</small></td><td><form data-form="admin-quota" data-id="${u.id}" class="inline-form"><select id="quota-${u.id}" aria-label="Hạn mức ${esc(u.name)}">${[...new Set([u.quota/1048576,25,50,100,200,512])].sort((a,b)=>a-b).map(n=>`<option value="${n*1048576}" ${u.quota===n*1048576?"selected":""}>${n} MiB</option>`).join("")}</select><button class="icon-button" aria-label="Lưu hạn mức ${esc(u.name)}">${icon("check")}</button></form></td><td>${u.id!==s.user.id?btn(u.enabled?"Tạm dừng":"Mở lại","admin-toggle",`data-id="${u.id}" data-enabled="${!u.enabled}"`):'<span class="muted">Bạn</span>'}</td></tr>`).join("")}</tbody></table></div></section><div class="two-col section"><section class="panel"><div class="section-head"><h2>Quá trình xử lý gần đây</h2></div><div class="admin-events">${a.events.length?a.events.map(e=>`<article><span class="event-dot"></span><div><strong>${kinds[e.kind]||esc(e.kind)}</strong><p>${esc(e.actor||"Hệ thống")} · ${esc(e.subject)}</p><small>${date(e.created)}${e.detail?" · "+esc(e.detail):""}</small></div></article>`).join(""):'<p class="muted">Chưa có hoạt động.</p>'}</div></section><section class="panel"><div class="section-head"><h2>Tệp & tiến độ</h2></div><div class="admin-file-list">${a.files.length?a.files.map(f=>`<article>${badge(f.name)}<div><strong>${esc(f.name)}</strong><small>${esc(f.owner)} · ${size(f.size)}</small></div><span class="status-chip ${f.state==="ready"?"success":""}">${f.state==="ready"?"Sẵn sàng":f.state==="trash"?"Thùng rác":`${Math.min(99,Math.round(f.stored/Math.max(f.size,1)*100))}%`}</span></article>`).join(""):empty("folder","Chưa có tệp","Tệp mới sẽ xuất hiện sau khi tải lên.")}</div></section></div><div class="service-strip">${icon("server")} Backend Python · v${esc(a.service.version)}<span>${esc(a.service.persistence)}</span><span>Tối đa ${a.service.maxUsers} tài khoản · ${size(a.service.maxFileSize)}/tệp</span></div>`;
}

function setup(s) {
  return `${title("THIẾT LẬP CHỦ SỞ HỮU","Kích hoạt quyền quản trị.","Chỉ chủ ứng dụng có mã kích hoạt được cung cấp riêng.")}<section class="panel form-panel setup-card"><form data-form="claim" class="form-grid"><label class="field-label" for="claim-code">Mã kích hoạt<input id="claim-code" class="field-input" type="password" autocomplete="off" value="${esc(s.ownerCode)}" required/></label><button class="button primary" ${s.busy?"disabled":""}>Kích hoạt cho tài khoản hiện tại</button><p class="form-hint">Tài khoản: ${esc(s.user.email)}. Mã chỉ dùng một lần cho toàn hệ thống.</p></form></section>`;
}
