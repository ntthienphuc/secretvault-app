import * as api from "./api.js";
import * as C from "./crypto.js";
import { authView, shell, esc } from "./view.js";

const root = document.getElementById("app");
const state = {
  authMode: "login", loginEmail: "", user: null, identity: null, encryptedBundle: null,
  service: "connecting",
  ownerCode: new URLSearchParams(location.hash.slice(1)).get("owner") || "",
  remote: { users: [], contacts: [], files: [], shares: [], live: [], activity: [] },
  view: location.pathname === "/admin" ? "admin" : location.pathname === "/setup" ? "setup" : "vault", search: "", busy: "", modal: null, candidate: null, admin: null, trash: null,
  liveFile: null, connected: true, remoteHash: "", signatures: new Map(), verified: new Map(),
  incoming: new Map(), outgoing: new Map(), sending: new Set(), polling: false,
  fileType: "all", layout: localStorage.getItem("sv2-layout") || "list", sort: "newest",
};

function render() {
  const focusedId = document.activeElement?.id;
  const selection = document.activeElement?.selectionStart;
  const values = new Map();
  for (const input of root.querySelectorAll("input[id],select[id]")) {
    if (!["password", "file"].includes(input.type)) {
      values.set(input.id, input.value);
    }
  }
  root.innerHTML = state.user ? shell(state) : authView(state);
  for (const [id, value] of values) {
    const input = document.getElementById(id);
    if (input && input.type !== "file" && input.type !== "password") {
      input.value = value;
    }
  }
  const focused = focusedId && document.getElementById(focusedId);
  if (focused) {
    focused.focus();
    if (typeof selection === "number" && ["text", "search", "email"].includes(focused.type)) {
      try {
        focused.setSelectionRange(selection, selection);
      } catch {
        // Email fields do not expose selection in all browsers.
      }
    }
  }
}

function toast(message, error = false) {
  const holder = document.getElementById("toast-host");
  const item = document.createElement("div");
  item.className = "toast " + (error ? "error" : "success");
  item.textContent = message;
  holder.appendChild(item);
  setTimeout(() => item.remove(), 6500);
}

function progress(label = "") {
  state.busy = label;
  const holder = document.getElementById("progress-host");
  holder.innerHTML = label ? `<div class="busy-bar" role="status"><span class="status-dot"></span>${esc(label)}</div>` : "";
  if (!label) {
    render();
  }
}

function fail(error) {
  progress();
  let message = error.message || String(error);
  if (/fingerprint|public key|private key|AES|GCM|SHA|HKDF|ElGamal|transcript|manifest|envelope|chữ ký|khóa|chunk|IV|DH/i.test(message)) {
    message = "Không xác minh được tính an toàn của tệp hoặc kết nối. Thao tác đã dừng; vui lòng thử lại hoặc liên hệ quản trị viên.";
  }
  if (error.name === "NotSupportedError") message = "Hãy cập nhật Chrome, Edge hoặc Safari để dùng SecretVault trên thiết bị này.";
  toast(message, true);
  render();
}

const ownFile = (id) => state.remote.files.find((file) => file.id === id);
const userById = (id) => state.remote.users.find((user) => user.id === id);
const liveById = (id) => state.remote.live.find((item) => item.id === id);

function pinCacheKey(user) {
  return "sv2-pin:" + state.user.email + ":" + user.email;
}

async function checkPinned(user) {
  C.assert(user, "Không tìm thấy liên hệ");
  C.assert(await C.publicFingerprint(user.public) === user.public.fingerprint, "Danh tính liên hệ không hợp lệ");
  C.validateGroupKey(user.public.elgamal);
  const cached = localStorage.getItem(pinCacheKey(user));
  C.assert(!cached || cached === user.public.fingerprint, "Danh tính liên hệ đã thay đổi. Liên hệ quản trị viên để xác minh.");
  const existing = state.remote.contacts.find((item) => item.peer_id === user.id);
  C.assert(!existing || existing.fingerprint === user.public.fingerprint, "Danh tính liên hệ đã thay đổi. Liên hệ quản trị viên để xác minh.");
  const pinned = state.remote.contacts.some((item) => item.peer_id === user.id && item.fingerprint === user.public.fingerprint);
  if (!pinned) {
    await api.post("/api/contacts", { peerId: user.id, fingerprint: user.public.fingerprint });
    state.remote.contacts.push({ owner_id: state.user.id, peer_id: user.id, fingerprint: user.public.fingerprint });
  }
  localStorage.setItem(pinCacheKey(user), user.public.fingerprint);
}

async function refresh(force = false) {
  if (!state.user) {
    return;
  }
  const remote = await api.get("/api/bootstrap");
  const remoteHash = await C.objectHash(remote);
  const changed = remoteHash !== state.remoteHash;
  state.remote = remote;
  state.user = remote.user;
  state.connected = true;
  if (changed || force) {
    state.remoteHash = remoteHash;
    for (const file of remote.files) {
      if (!state.signatures.has(file.id)) {
        try {
          const signer = remote.users.find((user) => user.id === file.ownerId);
          C.assert(await C.objectHash(file.manifest) === file.manifestHash, "Hash manifest sai");
          C.assert(file.manifest.id === file.id && file.manifest.ownerId === file.ownerId, "Danh tính manifest sai");
          await C.verify(signer.public, file.manifest, file.signature);
          state.signatures.set(file.id, true);
        } catch {
          state.signatures.set(file.id, false);
        }
      }
    }
    render();
  }
  for (const session of remote.live) {
    if (session.senderId === state.user.id && session.state === "accepted" && state.outgoing.has(session.id) && !state.sending.has(session.id)) {
      state.sending.add(session.id);
      sendLivePayload(session).catch(fail).finally(() => state.sending.delete(session.id));
    }
  }
}

async function auth(form) {
  const email = form.querySelector("#auth-email").value.trim().toLowerCase();
  const password = form.querySelector("#auth-password").value;
  const register = state.authMode === "register";
  C.assert(state.service === "ready", "Máy chủ đang kết nối. Vui lòng chờ hoặc bấm Kết nối lại.");
  const name = form.querySelector("#auth-name")?.value.trim();
  if (register) {
    C.assert(name && name.length <= 80, "Nhập tên hiển thị từ 1 đến 80 ký tự");
    C.assert(password === form.querySelector("#auth-confirm").value, "Hai mật khẩu chưa trùng nhau");
  }
  C.assert(password.length >= 10, "Mật khẩu tối thiểu 10 ký tự");
  C.assert(window.isSecureContext && crypto.subtle, "Mở bằng localhost hoặc HTTPS để dùng Web Crypto");
  document.getElementById("toast-host").replaceChildren();
  progress(register ? "Đang tạo không gian của bạn…" : "Đang đăng nhập…");
  // Reflect the busy state immediately; submit/click handlers already block duplicates.
  render();
  let response;
  let identity;
  const authProof = await C.authProof(email, password);
  if (register) {
    const account = await C.makeAccount(email, password);
    const proof = await C.sign(account.identity, { purpose: "register-v2", email, public: account.public });
    response = await api.post("/api/register", { email, authProof, name, public: account.public, bundle: account.bundle, proof });
    identity = account.identity;
  } else {
    response = await api.post("/api/login", { email, authProof });
    identity = await C.unlockAccount(email, password, response.bundle, response.user.public);
  }
  api.setToken(response.token);
  state.user = response.user;
  state.identity = identity;
  state.encryptedBundle = response.bundle;
  state.loginEmail = email;
  state.signatures.clear();
  state.verified.clear();
  state.view = location.pathname === "/admin" ? "admin" : location.pathname === "/setup" ? "setup" : "vault";
  state.authMode = "login";
  await refresh(true);
  if (state.view === "admin" && state.user.role === "admin") await loadAdmin();
  progress();
  toast(register ? "Không gian của bạn đã sẵn sàng." : "Chào mừng bạn trở lại SecretVault.");
}

async function logout() {
  await api.post("/api/logout", {}).catch(() => {});
  api.setToken("");
  if (state.identity?.vaultKey) {
    state.identity.vaultKey.fill(0);
  }
  for (const session of state.outgoing.values()) {
    session.key?.fill(0);
  }
  for (const session of state.incoming.values()) {
    session.key?.fill(0);
  }
  state.user = null;
  state.identity = null;
  state.encryptedBundle = null;
  state.modal = null;
  state.candidate = null;
  state.admin = null;
  state.trash = null;
  state.remoteHash = "";
  state.incoming.clear();
  state.outgoing.clear();
  state.liveFile = null;
  state.authMode = "login";
  progress();
  render();
}

async function upload(file) {
  if (!file) {
    return;
  }
  C.assert(file.size <= (state.remote.limits?.maxFileSize || 25 * 1048576), "Mỗi tệp tối đa 25 MiB");
  C.assert(file.name.length <= 240, "Tên tệp quá dài, hãy đổi tên ngắn hơn.");
  const fileId = C.id("f");
  const ownerId = state.user.id;
  const key = C.randomBytes(32);
  const prefix = C.randomBytes(8);
  const total = Math.max(1, Math.ceil(file.size / C.CHUNK_SIZE));
  progress("Đang chuẩn bị tải lên · " + file.name);
  const chunks = [];
  try {
    await api.post("/api/files", { id: fileId, name: file.name, size: file.size });
    for (let index = 0; index < total; index += 1) {
      progress(`Đang tải lên ${Math.round(index / total * 100)}% · ${file.name}`);
      const plaintext = new Uint8Array(await file.slice(index * C.CHUNK_SIZE, (index + 1) * C.CHUNK_SIZE).arrayBuffer());
      const envelope = await C.encrypt(key, plaintext, C.fileAad(fileId, ownerId, index, total, file.size), C.chunkIv(prefix, index));
      const raw = C.unb64(envelope.data);
      const chunkHash = await C.hash(raw);
      const result = await uploadChunk(`/api/files/${fileId}/chunks/${index}`, raw);
      C.assert(result.hash === chunkHash, "Hash sau tải lên không khớp");
      chunks.push({ index, iv: envelope.iv, hash: chunkHash, plainSize: plaintext.length });
      plaintext.fill(0);
    }
    const manifest = {
      version: 2, algorithm: "AES-256-GCM-chunked", id: fileId, ownerId,
      name: file.name, size: file.size, mime: file.type || "application/octet-stream",
      created: Date.now(), chunkSize: C.CHUNK_SIZE, chunks,
    };
    await api.post(`/api/files/${fileId}/commit`, {
      manifest, signature: await C.sign(state.identity, manifest),
      ownerWrap: await C.wrapOwner(state.identity, fileId, ownerId, key),
    });
    await refresh(true);
    toast("Đã tải lên " + file.name);
  } finally {
    key.fill(0);
    progress();
  }
}

async function fileKey(file) {
  C.assert(await C.objectHash(file.manifest) === file.manifestHash, "Manifest đã bị thay đổi");
  const owner = userById(file.ownerId);
  await C.verify(owner.public, file.manifest, file.signature);
  if (file.ownerId === state.user.id) {
    return C.unwrapOwner(state.identity, file);
  }
  await checkPinned(owner);
  const share = file.share;
  C.assert(share && !share.revoked, "Quyền tải tệp đã bị thu hồi");
  const payload = share.payload;
  C.assert(payload.purpose === "offline-v2" && payload.fileId === file.id && payload.senderId === owner.id && payload.recipientId === state.user.id && payload.manifestHash === file.manifestHash && payload.recipientFingerprint === state.user.public.fingerprint, "Envelope không dành cho tệp / người nhận này");
  await C.verify(owner.public, payload, share.signature);
  return C.unwrapElgamal(state.identity, payload.envelope, C.shareContext(payload));
}

function download(bytes, name, type = "application/octet-stream") {
  const blob = bytes instanceof Blob ? bytes : new Blob([bytes], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.className = "button primary";
  anchor.textContent = "Lưu tệp: " + name;
  const holder = document.getElementById("download-host");
  holder.replaceChildren(anchor);
  anchor.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    anchor.remove();
  }, 120000);
}

async function openFile(fileId, save) {
  const file = ownFile(fileId);
  C.assert(file, "Tệp không còn khả dụng; làm mới vault");
  const key = await fileKey(file);
  const plaintext = [];
  const manifest = file.manifest;
  let totalSize = 0;
  try {
    C.assert(manifest.chunks.length === Math.max(1, Math.ceil(manifest.size / C.CHUNK_SIZE)), "Sai số chunk");
    const ivs = new Set();
    for (let index = 0; index < manifest.chunks.length; index += 1) {
      progress(`Đang chuẩn bị tải xuống ${Math.round(index / manifest.chunks.length * 100)}% · ${manifest.name}`);
      const meta = manifest.chunks[index];
      C.assert(meta.index === index && !ivs.has(meta.iv), "Chunk bị xáo trộn hoặc tái dùng IV");
      ivs.add(meta.iv);
      const ciphertext = await api.request(`/api/files/${fileId}/chunks/${index}`, { binary: true });
      C.assert(await C.hash(ciphertext) === meta.hash, "SHA-256 không khớp ở chunk " + index);
      const raw = await C.decrypt(key, { iv: meta.iv, data: C.b64(ciphertext) }, C.fileAad(fileId, file.ownerId, index, manifest.chunks.length, manifest.size));
      C.assert(raw.length === meta.plainSize, "Độ dài sau giải mã không khớp");
      totalSize += raw.length;
      if (save) {
        plaintext.push(raw);
      } else {
        raw.fill(0);
      }
    }
    C.assert(totalSize === manifest.size, "Tệp bị thiếu nội dung");
    state.verified.set(fileId, Date.now());
    if (save) {
      download(new Blob(plaintext, { type: manifest.mime }), manifest.name);
    }
    toast(save ? "Tệp đã sẵn sàng: " + manifest.name : "Tệp đã được kiểm tra thành công.");
  } finally {
    key.fill(0);
    progress();
    render();
  }
}

async function shareFile(form) {
  const file = ownFile(form.dataset.id);
  let recipient = userById(form.querySelector("#share-recipient").value);
  const email = form.querySelector("#share-email")?.value.trim().toLowerCase();
  if (email) {
    recipient = await api.get("/api/directory?email=" + encodeURIComponent(email));
    if (!userById(recipient.id)) state.remote.users.push(recipient);
  }
  C.assert(recipient, "Chọn người nhận trước");
  C.assert(recipient.id !== state.user.id, "Đây là tài khoản của bạn");
  progress("Đang chia sẻ tệp…");
  await checkPinned(recipient);
  const key = await fileKey(file);
  try {
    const context = {
      purpose: "offline-v2", fileId: file.id, senderId: state.user.id, recipientId: recipient.id,
      recipientFingerprint: recipient.public.fingerprint, manifestHash: file.manifestHash,
    };
    const envelope = await C.wrapElgamal(key, recipient.public.elgamal, context);
    const payload = { ...context, envelope, created: Date.now() };
    await api.post("/api/shares", { payload, signature: await C.sign(state.identity, payload) });
    state.modal = null;
    await refresh(true);
    toast("Đã chia sẻ với " + recipient.name + ". Người nhận có thể mở tệp bất cứ lúc nào.");
  } finally {
    key.fill(0);
    progress();
  }
}

async function pinCandidate() {
  const candidate = state.candidate;
  C.assert(candidate, "Không tìm thấy liên hệ");
  progress("Đang thêm liên hệ…");
  await checkPinned(candidate);
  state.candidate = null;
  await refresh(true);
  progress();
  toast("Đã thêm " + candidate.name + " vào danh bạ.");
}

async function startLive(form) {
  const file = state.liveFile;
  const recipient = userById(form.querySelector("#live-recipient").value);
  C.assert(file && recipient, "Chọn tệp và người nhận");
  C.assert(file.size <= (state.remote.limits?.maxFileSize || 25 * 1048576), "Mỗi tệp tối đa 25 MiB");
  C.assert(recipient.online, "Người nhận đang ngoại tuyến. Chia sẻ từ Tệp của tôi để họ mở sau, hoặc chờ họ online.");
  progress("Đang chuẩn bị lời mời…");
  await checkPinned(recipient);
  const pair = C.ephemeral();
  const offer = {
    purpose: "live-offer-v2", id: C.id("l"), group: C.GROUP,
    senderId: state.user.id, recipientId: recipient.id, recipientFingerprint: recipient.public.fingerprint,
    publicKey: pair.publicKey, nonce: C.b64(C.randomBytes(32)), expires: Date.now() + 14 * 60000,
    name: file.name, size: file.size, mime: file.type || "application/octet-stream",
    total: Math.max(1, Math.ceil(file.size / C.CHUNK_SIZE)),
  };
  state.outgoing.set(offer.id, { privateKey: pair.privateKey, file });
  await api.post("/api/live", { payload: offer, signature: await C.sign(state.identity, offer) });
  state.liveFile = null;
  await refresh(true);
  progress();
  toast("Đã gửi lời mời. Chờ " + recipient.name + " xác nhận.");
}

async function acceptLive(liveId) {
  const session = liveById(liveId);
  const sender = userById(session.senderId);
  progress("Đang kết nối với người gửi…");
  await checkPinned(sender);
  C.assert(session.offer.recipientFingerprint === state.user.public.fingerprint && session.offer.recipientId === state.user.id && session.offer.id === session.id && session.offer.expires > Date.now(), "Sai người nhận hoặc phiên hết hạn");
  await C.verify(sender.public, session.offer, session.offerSignature);
  C.validateGroupKey(session.offer.publicKey);
  const pair = C.ephemeral();
  const acceptance = {
    purpose: "live-accept-v2", id: liveId, recipientId: state.user.id,
    offerHash: await C.objectHash(session.offer), publicKey: pair.publicKey,
    nonce: C.b64(C.randomBytes(32)),
  };
  const derived = await C.sessionKey(pair.privateKey, session.offer.publicKey, session.offer, acceptance);
  state.incoming.set(liveId, derived);
  await api.post(`/api/live/${liveId}/accept`, { payload: acceptance, signature: await C.sign(state.identity, acceptance) });
  await refresh(true);
  progress();
  toast("Đã chấp nhận. Tệp đang được chuyển đến bạn.");
}

async function sendLivePayload(session) {
  const memory = state.outgoing.get(session.id);
  const recipient = userById(session.recipientId);
  await checkPinned(recipient);
  await C.verify(recipient.public, session.acceptance, session.acceptSignature);
  C.assert(session.acceptance.id === session.id && session.acceptance.recipientId === recipient.id && session.acceptance.offerHash === await C.objectHash(session.offer), "Acceptance không ràng buộc đúng offer");
  const derived = await C.sessionKey(memory.privateKey, session.acceptance.publicKey, session.offer, session.acceptance);
  memory.privateKey = null;
  memory.key = derived.key;
  const prefix = C.randomBytes(8);
  const hashes = [];
  try {
    for (let index = 0; index < session.offer.total; index += 1) {
      progress(`Đang gửi ${Math.round(index / session.offer.total * 100)}% · ${memory.file.name}`);
      const raw = new Uint8Array(await memory.file.slice(index * C.CHUNK_SIZE, (index + 1) * C.CHUNK_SIZE).arrayBuffer());
      const envelope = await C.encrypt(derived.key, raw, C.liveAad(derived.transcriptHash, index, session.offer.total), C.chunkIv(prefix, index));
      const hash = await C.hash(C.unb64(envelope.data));
      await api.post(`/api/live/${session.id}/chunk`, { index, ...envelope, hash });
      hashes.push(hash);
      raw.fill(0);
    }
    const payload = { purpose: "live-finish-v2", id: session.id, transcriptHash: derived.transcriptHash, hashes };
    await api.post(`/api/live/${session.id}/finish`, { payload, signature: await C.sign(state.identity, payload) });
    state.outgoing.delete(session.id);
    progress();
    await refresh(true);
    toast("Tệp đã chuyển xong. Người nhận có thể tải xuống.");
  } finally {
    derived.key.fill(0);
    memory.key = null;
    progress();
  }
}

async function receiveLive(liveId) {
  const session = liveById(liveId);
  const memory = state.incoming.get(liveId);
  C.assert(memory && session?.completion, "Phiên này đã đóng trên thiết bị. Hãy yêu cầu người gửi tạo lời mời mới.");
  await checkPinned(userById(session.senderId));
  const completion = session.completion;
  await C.verify(userById(session.senderId).public, completion.payload, completion.signature);
  C.assert(completion.payload.transcriptHash === memory.transcriptHash && completion.payload.id === liveId && completion.payload.hashes.length === session.offer.total, "Completion của phiên khác");
  const output = [];
  const ivs = new Set();
  let bytes = 0;
  for (let index = 0; index < session.offer.total; index += 1) {
    progress(`Đang nhận ${Math.round(index / session.offer.total * 100)}% · ${session.offer.name}`);
    const envelope = await api.get(`/api/live/${liveId}/chunks/${index}`);
    C.assert(envelope.index === index && !ivs.has(envelope.iv), "Sai thứ tự chunk hoặc lặp IV");
    ivs.add(envelope.iv);
    C.assert(await C.hash(C.unb64(envelope.data)) === completion.payload.hashes[index], "Hash live payload không khớp chữ ký");
    const raw = await C.decrypt(memory.key, envelope, C.liveAad(memory.transcriptHash, index, session.offer.total));
    output.push(raw);
    bytes += raw.length;
  }
  C.assert(bytes === session.offer.size, "Kích thước live payload không khớp");
  download(new Blob(output, { type: session.offer.mime }), session.offer.name);
  memory.key.fill(0);
  state.incoming.delete(liveId);
  await api.post(`/api/live/${liveId}/ack`, {});
  progress();
  await refresh(true);
  toast("Đã nhận " + session.offer.name);
}

async function uploadChunk(path, raw) {
  // Retry the exact encrypted bytes; do not re-encrypt with a reused IV.
  for (let attempt = 0; ; attempt++) {
    try { return await api.post(path, raw); }
    catch (error) {
      if (attempt >= 2 || (error.status && error.status < 500)) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
}

async function loadAdmin() {
  state.admin = await api.get("/api/admin/overview");
  render();
}

async function action(event) {
  const nav = event.target.closest("[data-view]");
  if (nav) {
    state.view = nav.dataset.view;
    state.modal = null;
    history.replaceState({}, "", state.view === "admin" ? "/admin" : state.view === "setup" ? "/setup" : "/");
    render();
    if (state.view === "admin" && state.user.role === "admin") await loadAdmin();
    return;
  }
  const element = event.target.closest("[data-action]");
  if (!element) {
    return;
  }
  const { action, id } = element.dataset;
  if (action === "close-modal") {
    if (element.classList.contains("modal-layer") && event.target !== element) {
      return;
    }
    state.modal = null;
    render();
    return;
  }
  if (state.busy && !["close-modal"].includes(action)) {
    toast("Chờ thao tác hiện tại hoàn tất.");
    return;
  }
  if (action === "auth-mode") {
    state.authMode = element.dataset.mode || (state.authMode === "login" ? "register" : "login");
    render();
  } else if (action === "check-service") {
    await checkService();
  } else if (action === "logout") {
    await logout();
  } else if (action === "upload") {
    document.getElementById("upload-input").click();
  } else if (action === "layout") {
    state.layout = element.dataset.layout;
    localStorage.setItem("sv2-layout", state.layout);
    render();
  } else if (action === "filter") {
    state.fileType = element.dataset.filter;
    render();
  } else if (action === "share-first") {
    const file = state.remote.files.find((item) => item.ownerId === state.user.id);
    if (file) {
      state.modal = { type: "share", id: file.id };
      render();
    } else {
      document.getElementById("upload-input").click();
    }
  } else if (action === "choose-live") {
    event.preventDefault();
    document.getElementById("live-input").click();
  } else if (action === "inspect" || action === "share") {
    state.modal = { type: action, id };
    render();
  } else if (action === "download" || action === "verify-file") {
    await openFile(id, action === "download");
  } else if (action === "refresh") {
    await refresh(true);
    toast("Vault đã được cập nhật.");
  } else if (action === "to-contacts") {
    state.view = "contacts";
    render();
  } else if (action === "pin-candidate") {
    await pinCandidate();
  } else if (action === "trust-sender") {
    state.candidate = userById(id);
    state.view = "contacts";
    state.modal = null;
    render();
  } else if (action === "revoke") {
    await api.remove("/api/shares/" + id);
    await refresh(true);
    toast("Đã thu hồi quyền tải tiếp theo.");
  } else if (action === "accept-live") {
    await acceptLive(id);
  } else if (action === "reject-live") {
    await api.post(`/api/live/${id}/reject`, {});
    await refresh(true);
  } else if (action === "receive-live") {
    await receiveLive(id);
  } else if (action === "new-tab") {
    window.open(location.origin, "_blank", "noopener");
  } else if (action === "trash-file") {
    await api.remove("/api/files/" + id);
    await refresh(true);
    toast("Đã chuyển vào thùng rác. Bạn có thể khôi phục trong Tài khoản.");
  } else if (action === "load-trash") {
    state.trash = (await api.get("/api/trash")).files;
    render();
  } else if (action === "restore-file") {
    await api.post(`/api/files/${id}/restore`, {});
    state.trash = (await api.get("/api/trash")).files;
    await refresh(true);
    toast("Đã khôi phục tệp.");
  } else if (action === "admin-refresh") {
    await loadAdmin();
  } else if (action === "admin-toggle") {
    await api.post("/api/admin/user", { userId: id, enabled: element.dataset.enabled === "true" });
    await loadAdmin();
  }
}

root.addEventListener("click", (event) => action(event).catch(fail));
root.addEventListener("submit", (event) => {
  event.preventDefault();
  if (state.busy) {
    return;
  }
  const form = event.target;
  const task = async () => {
    if (form.dataset.form === "auth") {
      await auth(form);
    } else if (form.dataset.form === "contact") {
      state.candidate = await api.get("/api/directory?email=" + encodeURIComponent(form.querySelector("#contact-email").value.trim().toLowerCase()));
      C.assert(state.candidate.id !== state.user.id, "Đây là tài khoản của bạn");
      if (!userById(state.candidate.id)) state.remote.users.push(state.candidate);
      await pinCandidate();
    } else if (form.dataset.form === "share") {
      await shareFile(form);
    } else if (form.dataset.form === "live") {
      await startLive(form);
    } else if (form.dataset.form === "claim") {
      const code = form.querySelector("#claim-code").value;
      progress("Đang kích hoạt…");
      await api.post("/api/admin/claim", { code });
      state.ownerCode = "";
      state.view = "admin";
      history.replaceState({}, "", "/admin");
      await refresh(true);
      await loadAdmin();
      progress();
      toast("Đã kích hoạt quản trị viên.");
    } else if (form.dataset.form === "admin-quota") {
      await api.post("/api/admin/user", { userId: form.dataset.id, quota: Number(form.querySelector("select").value) });
      await loadAdmin();
      toast("Đã cập nhật hạn mức.");
    }
  };
  task().catch(fail);
});
root.addEventListener("change", (event) => {
  if (event.target.id === "file-sort") {
    state.sort = event.target.value;
    render();
  }
  if (event.target.id === "upload-input") {
    const selected = Array.from(event.target.files);
    (async () => { for (const file of selected) await upload(file); })().catch(fail);
  }
  if (event.target.id === "live-input") {
    state.liveFile = event.target.files[0];
    render();
  }
});

root.addEventListener("dragover", (event) => {
  if (state.user && event.dataTransfer?.types.includes("Files")) {
    event.preventDefault();
    root.classList.add("is-dragging");
  }
});
root.addEventListener("dragleave", (event) => {
  if (!root.contains(event.relatedTarget)) {
    root.classList.remove("is-dragging");
  }
});
root.addEventListener("drop", (event) => {
  if (!state.user) {
    return;
  }
  event.preventDefault();
  root.classList.remove("is-dragging");
  if (state.busy) {
    toast("Chờ thao tác hiện tại hoàn tất.");
    return;
  }
  const files = Array.from(event.dataTransfer?.files || []);
  if (files.length > 1) {
    toast("Đang tải lần lượt " + files.length + " tệp.");
  }
  (async () => { for (const file of files) await upload(file); })().catch(fail);
});
root.addEventListener("input", (event) => {
  if (event.target.id === "search") {
    state.search = event.target.value;
    render();
  }
});

// Reloading closes the local unlocked session and requires a normal sign-in.
api.setToken("");
if (state.ownerCode) history.replaceState({}, "", location.pathname);
render();
async function checkService() {
  state.service = "connecting";
  updateService();
  try {
    await api.get("/api/health");
    state.service = "ready";
  } catch {
    state.service = "unavailable";
  }
  updateService();
}
function updateService() {
  const status = document.getElementById("service-status");
  if (status) {
    status.className = "service-status " + state.service;
    status.innerHTML = state.service === "ready" ? "Đã kết nối an toàn" : state.service === "connecting" ? "Đang kết nối máy chủ… Lần mở đầu có thể cần một phút." : 'Máy chủ chưa sẵn sàng. <button type="button" data-action="check-service">Kết nối lại</button>';
  }
  const submit = root.querySelector('form[data-form="auth"] button[type="submit"]');
  if (submit) submit.disabled = state.service !== "ready" || !!state.busy;
}
checkService();
document.addEventListener("keydown", (event) => { if (event.key === "Escape" && state.modal) { state.modal = null; render(); } });
setInterval(async () => {
  if (!state.user || state.polling) {
    return;
  }
  state.polling = true;
  try {
    await refresh();
    if (state.view === "admin" && state.user?.role === "admin") await loadAdmin();
  } catch (error) {
    if (state.connected) {
      state.connected = false;
      toast(error.message, true);
      render();
    }
    if (error.status === 401) {
      await logout();
    }
  } finally {
    state.polling = false;
  }
}, 3000);
