import * as api from "./api.js";
import * as C from "./crypto.js";
import { authView, shell, esc } from "./view.js";

const root = document.getElementById("app");
const state = {
  authMode: "login", loginEmail: "", user: null, identity: null, encryptedBundle: null,
  remote: { users: [], contacts: [], files: [], shares: [], live: [], activity: [] },
  view: "vault", search: "", busy: "", modal: null, candidate: null,
  liveFile: null, connected: true, remoteHash: "", signatures: new Map(), verified: new Map(),
  incoming: new Map(), outgoing: new Map(), sending: new Set(), polling: false,
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
  toast(error.message || String(error), true);
  render();
}

const ownFile = (id) => state.remote.files.find((file) => file.id === id);
const userById = (id) => state.remote.users.find((user) => user.id === id);
const liveById = (id) => state.remote.live.find((item) => item.id === id);

function pinCacheKey(user) {
  return "sv2-pin:" + state.user.email + ":" + user.email;
}

function checkPinned(user) {
  C.assert(user, "Không tìm thấy public key người gửi");
  const cached = localStorage.getItem(pinCacheKey(user));
  C.assert(!cached || cached === user.public.fingerprint, "Fingerprint đã thay đổi so với khóa ghim trên thiết bị. Dừng giao dịch và xác minh lại.");
  const pinned = state.remote.contacts.some((item) => item.peer_id === user.id && item.fingerprint === user.public.fingerprint);
  if (!pinned) {
    state.candidate = user;
    state.modal = null;
    state.view = "contacts";
    render();
    throw new Error("Hãy đối chiếu và ghim public key của " + user.name + " trước khi nhận.");
  }
}

async function refresh(force = false) {
  if (!state.user) {
    return;
  }
  const remote = await api.get("/api/bootstrap");
  const remoteHash = await C.objectHash(remote);
  const changed = remoteHash !== state.remoteHash;
  state.remote = remote;
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
  const name = form.querySelector("#auth-name")?.value.trim();
  if (register) {
    C.assert(password === form.querySelector("#auth-confirm").value, "Hai mật khẩu chưa trùng nhau");
  }
  C.assert(password.length >= 10, "Mật khẩu tối thiểu 10 ký tự");
  C.assert(window.isSecureContext && crypto.subtle, "Mở bằng localhost hoặc HTTPS để dùng Web Crypto");
  progress(register ? "Đang sinh khóa và mã hóa private key…" : "Đang xác thực và mở khóa…");
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
  state.view = "vault";
  state.authMode = "login";
  await refresh(true);
  progress();
  toast(register ? "Tài khoản đã sẵn sàng. Khóa chỉ mở trong phiên này." : "Đã đăng nhập và mở khóa vault.");
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
  C.assert(file.size <= C.MAX_FILE_SIZE, "Mỗi tệp tối đa 256 MiB");
  const fileId = C.id("f");
  const ownerId = state.user.id;
  const key = C.randomBytes(32);
  const prefix = C.randomBytes(8);
  const total = Math.max(1, Math.ceil(file.size / C.CHUNK_SIZE));
  await api.post("/api/files", { id: fileId });
  const chunks = [];
  try {
    for (let index = 0; index < total; index += 1) {
      progress(`Mã hóa & lưu ${index + 1}/${total} khối · ${file.name}`);
      const plaintext = new Uint8Array(await file.slice(index * C.CHUNK_SIZE, (index + 1) * C.CHUNK_SIZE).arrayBuffer());
      const envelope = await C.encrypt(key, plaintext, C.fileAad(fileId, ownerId, index, total, file.size), C.chunkIv(prefix, index));
      const raw = C.unb64(envelope.data);
      const chunkHash = await C.hash(raw);
      const result = await api.post(`/api/files/${fileId}/chunks/${index}`, raw);
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
    toast("Đã mã hóa, ký và lưu " + file.name);
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
  checkPinned(owner);
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
      progress(`Xác minh & giải mã ${index + 1}/${manifest.chunks.length} · ${manifest.name}`);
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
    toast(save ? "Đã xác minh chữ ký, hash, AES-GCM và tải " + manifest.name : "Toàn bộ nội dung hợp lệ: chữ ký + SHA-256 + AES-GCM.");
  } finally {
    key.fill(0);
    progress();
    render();
  }
}

async function shareFile(form) {
  const file = ownFile(form.dataset.id);
  const recipient = userById(form.querySelector("#share-recipient").value);
  C.assert(recipient, "Chọn người nhận trước");
  checkPinned(recipient);
  progress("Đang tạo ElGamal envelope…");
  const key = await fileKey(file);
  try {
    const context = {
      purpose: "offline-v2", fileId: file.id, senderId: state.user.id, recipientId: recipient.id,
      recipientFingerprint: recipient.public.fingerprint, manifestHash: file.manifestHash,
    };
    const envelope = await C.wrapElgamal(key, recipient.public.elgamal, context);
    const payload = { ...context, envelope, created: Date.now() };
    await api.post("/api/shares", { payload, signature: await C.sign(state.identity, payload) });
    await refresh(true);
    toast("Đã cấp envelope riêng cho " + recipient.name + ". Bạn có thể offline.");
  } finally {
    key.fill(0);
    progress();
  }
}

async function pinCandidate() {
  const candidate = state.candidate;
  C.assert(candidate, "Không có khóa để ghim");
  C.assert(await C.publicFingerprint(candidate.public) === candidate.public.fingerprint, "Fingerprint không khớp public key");
  C.validateGroupKey(candidate.public.elgamal);
  const cached = localStorage.getItem(pinCacheKey(candidate));
  C.assert(!cached || cached === candidate.public.fingerprint, "Khóa đã ghim trên thiết bị thay đổi. Không tự thay thế khóa.");
  await api.post("/api/contacts", { peerId: candidate.id, fingerprint: candidate.public.fingerprint });
  localStorage.setItem(pinCacheKey(candidate), candidate.public.fingerprint);
  state.candidate = null;
  await refresh(true);
  toast("Đã ghim fingerprint liên hệ.");
}

async function startLive(form) {
  const file = state.liveFile;
  const recipient = userById(form.querySelector("#live-recipient").value);
  C.assert(file && recipient, "Chọn tệp và người nhận");
  C.assert(file.size <= C.MAX_FILE_SIZE, "Tệp live tối đa 256 MiB");
  checkPinned(recipient);
  C.assert(recipient.online, "Người nhận đang offline. Dùng Offline Share hoặc chờ họ mở app.");
  progress("Đang sinh khóa DH tạm thời…");
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
  toast("Đã gửi lời mời có chữ ký. Chờ " + recipient.name + " xác nhận.");
}

async function acceptLive(liveId) {
  const session = liveById(liveId);
  const sender = userById(session.senderId);
  checkPinned(sender);
  progress("Xác minh chữ ký và sinh khóa DH nhận…");
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
  toast("Đã xác thực người gửi và tạo khóa phiên. Chờ ciphertext.");
}

async function sendLivePayload(session) {
  const memory = state.outgoing.get(session.id);
  const recipient = userById(session.recipientId);
  checkPinned(recipient);
  await C.verify(recipient.public, session.acceptance, session.acceptSignature);
  C.assert(session.acceptance.id === session.id && session.acceptance.recipientId === recipient.id && session.acceptance.offerHash === await C.objectHash(session.offer), "Acceptance không ràng buộc đúng offer");
  const derived = await C.sessionKey(memory.privateKey, session.acceptance.publicKey, session.offer, session.acceptance);
  memory.privateKey = null;
  memory.key = derived.key;
  const prefix = C.randomBytes(8);
  const hashes = [];
  try {
    for (let index = 0; index < session.offer.total; index += 1) {
      progress(`Gửi live ${index + 1}/${session.offer.total} · ${memory.file.name}`);
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
    toast("Đã gửi ciphertext. Người nhận sẽ xác minh trước khi tải.");
  } finally {
    derived.key.fill(0);
    memory.key = null;
    progress();
  }
}

async function receiveLive(liveId) {
  const session = liveById(liveId);
  const memory = state.incoming.get(liveId);
  C.assert(memory && session?.completion, "Khóa tạm không còn; hãy yêu cầu gửi phiên mới");
  checkPinned(userById(session.senderId));
  const completion = session.completion;
  await C.verify(userById(session.senderId).public, completion.payload, completion.signature);
  C.assert(completion.payload.transcriptHash === memory.transcriptHash && completion.payload.id === liveId && completion.payload.hashes.length === session.offer.total, "Completion của phiên khác");
  const output = [];
  const ivs = new Set();
  let bytes = 0;
  for (let index = 0; index < session.offer.total; index += 1) {
    progress(`Nhận & xác minh ${index + 1}/${session.offer.total} · ${session.offer.name}`);
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
  toast("Đã xác minh chữ ký + hash + AES-GCM và tải " + session.offer.name);
}

async function action(event) {
  const nav = event.target.closest("[data-view]");
  if (nav) {
    state.view = nav.dataset.view;
    state.modal = null;
    render();
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
    state.authMode = state.authMode === "login" ? "register" : "login";
    render();
  } else if (action === "logout") {
    await logout();
  } else if (action === "upload") {
    document.getElementById("upload-input").click();
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
  } else if (action === "backup-keys") {
    download(C.utf8(JSON.stringify({ version: 2, email: state.user.email, public: state.user.public, bundle: state.encryptedBundle }, null, 2)), "SecretVault-encrypted-key-backup.json", "application/json");
    toast("Đã tải gói khóa mã hóa. Vẫn cần mật khẩu để giải mã.");
  } else if (action === "evidence") {
    const file = ownFile(id);
    const evidence = { ...file, signatureVerified: !!state.signatures.get(id), contentVerifiedAt: state.verified.get(id) || null };
    delete evidence.ownerWrap;
    download(C.utf8(JSON.stringify(evidence, null, 2)), file.manifest.name + ".crypto-evidence.json", "application/json");
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
      render();
    } else if (form.dataset.form === "share") {
      await shareFile(form);
    } else if (form.dataset.form === "live") {
      await startLive(form);
    }
  };
  task().catch(fail);
});
root.addEventListener("change", (event) => {
  if (event.target.id === "upload-input") {
    upload(event.target.files[0]).catch(fail);
  }
  if (event.target.id === "live-input") {
    state.liveFile = event.target.files[0];
    render();
  }
});
root.addEventListener("input", (event) => {
  if (event.target.id === "search") {
    state.search = event.target.value;
    render();
  }
});

render();
setInterval(async () => {
  if (!state.user || state.polling) {
    return;
  }
  state.polling = true;
  try {
    await refresh();
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
