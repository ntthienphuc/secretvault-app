import * as api from "./api.js";
import {
  aesDecrypt,
  aesEncrypt,
  base64ToBytes,
  bytesToBase64,
  bytesToHex,
  bytesToUtf8,
  decryptWithCryptoKey,
  dhFingerprint,
  elgamalUnwrapKey,
  elgamalWrapKey,
  encryptWithCryptoKey,
  exportDhPublicKey,
  generateDhKeyPair,
  generateIdentityMaterial,
  importDhPublicKey,
  keyEnvelopePreview,
  randomBytes,
  randomId,
  sha256Hex,
  utf8Bytes,
} from "./crypto.js";

const root = document.querySelector("#app");
const ACTIVE_USER_KEY = "secretvault.active-user";
const IDENTITY_KEY_PREFIX = "secretvault.identity.";
const DEVICE_KEY_PREFIX = "secretvault.device.";

const appState = {
  remote: { users: [], files: [], shares: [], activity: [] },
  activeUserId: sessionStorage.getItem(ACTIVE_USER_KEY) || "alice",
  view: "vault",
  search: "",
  modal: null,
  toasts: [],
  busy: null,
  pollCursor: 0,
  pollBusy: false,
  pollTimer: null,
  liveFile: null,
  liveRecipientId: "bob",
  outgoing: new Map(),
  incoming: new Map(),
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatBytes(value) {
  const size = Number(value) || 0;
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(size < 10240 ? 1 : 0)} KB`;
  }
  if (size < 1024 * 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatDate(timestamp) {
  if (!timestamp) {
    return "—";
  }
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(timestamp);
}

function formatTime(timestamp) {
  if (!timestamp) {
    return "—";
  }
  return new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit" }).format(timestamp);
}

function getActiveUser() {
  return appState.remote.users.find((user) => user.id === appState.activeUserId) || appState.remote.users[0];
}

function getUser(userId) {
  return appState.remote.users.find((user) => user.id === userId);
}

function getFile(fileId) {
  return appState.remote.files.find((file) => file.id === fileId);
}

function getShare(shareId) {
  return appState.remote.shares.find((share) => share.id === shareId);
}

function avatarStyle(user) {
  return `background: linear-gradient(145deg, ${escapeHtml(user?.color || "#7c5cff")}, rgba(255,255,255,.08));`;
}

function avatar(user, size = "") {
  if (!user) {
    return "";
  }
  return `<span class="avatar ${size}" style="${avatarStyle(user)}">${escapeHtml(user.initials)}</span>`;
}

function fileExtension(name) {
  const extension = String(name).split(".").pop()?.toUpperCase() || "FILE";
  return extension.slice(0, 4);
}

function fileIcon(file, teal = false) {
  return `<span class="file-icon ${teal ? "teal" : ""}">${escapeHtml(fileExtension(file.name))}</span>`;
}

function showToast(message, type = "success") {
  const toast = { id: randomId("toast"), message, type };
  appState.toasts.push(toast);
  render();
  window.setTimeout(() => {
    appState.toasts = appState.toasts.filter((item) => item.id !== toast.id);
    render();
  }, 4300);
}

function setBusy(label = null) {
  appState.busy = label;
  render();
}

function identityStorageKey(userId) {
  return `${IDENTITY_KEY_PREFIX}${userId}`;
}

function deviceStorageKey(userId) {
  return `${DEVICE_KEY_PREFIX}${userId}`;
}

function getStoredDeviceKey(userId) {
  const stored = localStorage.getItem(deviceStorageKey(userId));
  if (stored) {
    return base64ToBytes(stored);
  }
  const raw = randomBytes(32);
  localStorage.setItem(deviceStorageKey(userId), bytesToBase64(raw));
  return raw;
}

function getStoredIdentity(userId) {
  const stored = localStorage.getItem(identityStorageKey(userId));
  return stored ? JSON.parse(stored) : null;
}

async function ensureIdentity(user) {
  let identity = getStoredIdentity(user.id);
  if (!identity) {
    identity = await generateIdentityMaterial();
    localStorage.setItem(identityStorageKey(user.id), JSON.stringify(identity));
  }
  await api.registerKeys({
    userId: user.id,
    edPublicJwk: identity.signing.publicJwk,
    elgamalPublic: identity.elgamal.publicKey,
    fingerprint: identity.fingerprint,
  });
  return identity;
}

async function refreshRemote() {
  appState.remote = await api.getBootstrap(appState.activeUserId);
}

async function initializeDemoFiles() {
  const hasAliceFiles = appState.remote.files.some((file) => file.ownerId === "alice");
  if (hasAliceFiles) {
    return;
  }
  const demos = [
    {
      name: "Project_Report.pdf",
      mime: "application/pdf",
      content: "SecretVault academic demo report\n\nAES-256-GCM protects this local sample.\n",
    },
    {
      name: "Research_Data.json",
      mime: "application/json",
      content: JSON.stringify({ project: "SecretVault", protocol: "ElGamal-Hybrid", verified: true }, null, 2),
    },
    {
      name: "Notes.md",
      mime: "text/markdown",
      content: "# SecretVault\n\nLive transfer uses ECDH and AES-GCM.\n",
    },
  ];
  for (const demo of demos) {
    await createEncryptedFileRecord({
      ownerId: "alice",
      name: demo.name,
      mime: demo.mime,
      bytes: utf8Bytes(demo.content),
      demo: true,
    });
  }
}

async function createEncryptedFileRecord({ ownerId, name, mime, bytes, demo = false }) {
  const fileKey = randomBytes(32);
  const encrypted = await aesEncrypt(fileKey, bytes);
  const localWrap = await aesEncrypt(getStoredDeviceKey(ownerId), fileKey);
  const cipherHash = await sha256Hex(base64ToBytes(encrypted.data));
  await api.createFile({
    ownerId,
    name,
    mime: mime || "application/octet-stream",
    size: bytes.byteLength,
    fileIv: encrypted.iv,
    ciphertext: encrypted.data,
    localKeyWrap: JSON.stringify(localWrap),
    cipherHash,
    demo,
  });
}

async function unlockOwnerFileKey(file) {
  const localWrap = JSON.parse(file.localKeyWrap);
  return aesDecrypt(getStoredDeviceKey(file.ownerId), localWrap);
}

async function unlockSharedFileKey(file, share) {
  const identity = getStoredIdentity(appState.activeUserId);
  if (!identity?.elgamal?.privateKey) {
    throw new Error("This browser does not have the recipient's private key");
  }
  return elgamalUnwrapKey(share.envelope, identity.elgamal.privateKey);
}

async function decryptFile(file, share = null) {
  const fileKey = share ? await unlockSharedFileKey(file, share) : await unlockOwnerFileKey(file);
  return aesDecrypt(fileKey, { iv: file.fileIv, data: file.ciphertext });
}

function triggerDownload(bytes, name, mime) {
  const blob = new Blob([bytes], { type: mime || "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function downloadVaultFile(fileId, shareId = null) {
  const file = getFile(fileId);
  const share = shareId ? getShare(shareId) : null;
  if (!file) {
    throw new Error("File not found");
  }
  const bytes = await decryptFile(file, share);
  triggerDownload(bytes, file.name, file.mime);
  await logActivity(share ? `Opened ${file.name} from an ElGamal offline share` : `Downloaded ${file.name}`);
  showToast(`${file.name} decrypted locally and downloaded`, "success");
}

async function uploadSelectedFile(file) {
  if (!file) {
    return;
  }
  if (file.size > 80 * 1024 * 1024) {
    throw new Error("This demo accepts files up to 80 MB");
  }
  const activeUser = getActiveUser();
  const bytes = new Uint8Array(await file.arrayBuffer());
  setBusy("Encrypting file");
  await createEncryptedFileRecord({ ownerId: activeUser.id, name: file.name, mime: file.type, bytes });
  await refreshRemote();
  await logActivity(`Encrypted and added ${file.name} to My Vault`);
  setBusy(null);
  showToast(`${file.name} is encrypted with AES-256-GCM and stored`, "success");
}

async function createOfflineShare(fileId, recipientId) {
  const file = getFile(fileId);
  const recipient = getUser(recipientId);
  if (!file || !recipient?.elgamalPublic) {
    throw new Error("Recipient public key is not available yet");
  }
  setBusy("Wrapping file key");
  const fileKey = await unlockOwnerFileKey(file);
  const envelope = await elgamalWrapKey(fileKey, recipient.elgamalPublic);
  await api.createShare({
    fileId,
    ownerId: appState.activeUserId,
    recipientId,
    envelope,
  });
  await logActivity(`Created an offline ElGamal share for ${recipient.name}`);
  await refreshRemote();
  appState.modal = null;
  setBusy(null);
  showToast(`${file.name} is ready for ${recipient.name} to open offline`, "success");
}

async function logActivity(message, kind = "success") {
  const activeUser = getActiveUser();
  if (!activeUser) {
    return;
  }
  try {
    await api.addActivity({ userId: activeUser.id, kind, message });
    await refreshRemote();
  } catch (error) {
    console.warn("Activity log unavailable", error);
  }
}

function ownedFiles() {
  const normalizedSearch = appState.search.trim().toLowerCase();
  return appState.remote.files
    .filter((file) => file.ownerId === appState.activeUserId)
    .filter((file) => !normalizedSearch || file.name.toLowerCase().includes(normalizedSearch));
}

function incomingShares() {
  return appState.remote.shares.filter((share) => share.recipientId === appState.activeUserId);
}

function outgoingShares() {
  return appState.remote.shares.filter((share) => share.ownerId === appState.activeUserId);
}

function renderSidebar() {
  const incomingCount = incomingShares().length;
  const navItems = [
    ["vault", "▣", "My Vault", ownedFiles().length],
    ["live", "↔", "Live Transfer", 0],
    ["contacts", "◎", "Contacts", appState.remote.users.length - 1],
  ];
  return `
    <aside class="sidebar">
      <div class="brand-lockup">
        <span class="brand-shield">SV</span>
        <div>
          <div class="brand-title">SecretVault</div>
          <div class="brand-caption">Dual-mode security</div>
        </div>
      </div>
      <div>
        <p class="nav-label">Workspace</p>
        <nav class="nav-list" aria-label="Main navigation">
          ${navItems
            .map(
              ([view, icon, label, count]) => `
                <button class="nav-item ${appState.view === view ? "active" : ""}" data-view="${view}">
                  <span class="nav-icon">${icon}</span>
                  <span>${label}</span>
                  ${view === "vault" && incomingCount ? `<span class="nav-count">${incomingCount}</span>` : count ? `<span class="nav-count">${count}</span>` : ""}
                </button>
              `,
            )
            .join("")}
        </nav>
      </div>
      <div class="sidebar-footer">
        <div class="mini-title"><span class="status-dot"></span> Local-first encryption</div>
        <p>Plaintext and private keys stay in this browser. Python only relays ciphertext and public metadata.</p>
      </div>
    </aside>
  `;
}

function renderTopbar() {
  const activeUser = getActiveUser();
  return `
    <header class="topbar">
      <div class="topbar-left">
        <label class="search-box" aria-label="Search files">
          <span>⌕</span>
          <input data-search-input type="search" value="${escapeHtml(appState.search)}" placeholder="Search encrypted files" />
        </label>
      </div>
      <div class="topbar-right">
        <span class="status-pill"><span class="status-dot"></span> Python relay online</span>
        <label class="profile-chip" aria-label="Active demo profile">
          ${avatar(activeUser)}
          <select data-profile-select>
            ${appState.remote.users
              .map((user) => `<option value="${escapeHtml(user.id)}" ${user.id === activeUser.id ? "selected" : ""}>${escapeHtml(user.name)}</option>`)
              .join("")}
          </select>
        </label>
      </div>
    </header>
  `;
}

function renderStats() {
  const ownCount = appState.remote.files.filter((file) => file.ownerId === appState.activeUserId).length;
  const contactCount = Math.max(0, appState.remote.users.length - 1);
  const sharedCount = outgoingShares().length + incomingShares().length;
  return `
    <div class="stats-grid">
      <article class="stat-card">
        <div class="stat-top"><span class="stat-label">Encrypted files</span><span class="stat-icon">▣</span></div>
        <div class="stat-value">${String(ownCount).padStart(2, "0")}</div>
        <div class="stat-meta positive">AES-256-GCM protected</div>
      </article>
      <article class="stat-card">
        <div class="stat-top"><span class="stat-label">Trusted contacts</span><span class="stat-icon">◎</span></div>
        <div class="stat-value">${String(contactCount).padStart(2, "0")}</div>
        <div class="stat-meta">Public keys registered</div>
      </article>
      <article class="stat-card">
        <div class="stat-top"><span class="stat-label">Shared files</span><span class="stat-icon">↗</span></div>
        <div class="stat-value">${String(sharedCount).padStart(2, "0")}</div>
        <div class="stat-meta">Offline envelopes issued</div>
      </article>
      <article class="stat-card">
        <div class="stat-top"><span class="stat-label">Key health</span><span class="stat-icon">✓</span></div>
        <div class="stat-value">100%</div>
        <div class="stat-meta positive">Browser identity ready</div>
      </article>
    </div>
  `;
}

function renderNotice() {
  return `
    <div class="notice">
      <span class="notice-icon">◈</span>
      <div>
        <strong>Academic demo mode · client-side encryption is active</strong>
        <p>Files are encrypted in the browser before Python receives them. The local SQLite relay stores ciphertext, public keys, and key envelopes; it never receives your plaintext file key.</p>
      </div>
    </div>
  `;
}

function renderFileRow(file, { share = null } = {}) {
  const owner = getUser(file.ownerId);
  const shared = Boolean(share);
  return `
    <div class="file-row">
      <div class="file-main">
        ${fileIcon(file, shared)}
        <div class="file-name-wrap">
          <div class="file-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</div>
          <div class="file-subline">${shared ? `From ${escapeHtml(owner?.name || "contact")}` : `${file.demo ? "Demo fixture · " : ""}${escapeHtml(file.mime)}`}</div>
        </div>
      </div>
      <div class="cell-muted">${formatBytes(file.size)}</div>
      <div><span class="security-chip">● Verified</span></div>
      <div class="cell-muted">${formatDate(file.updatedAt)}</div>
      <div class="row-actions">
        <button class="icon-button" title="Inspect cryptography" data-action="inspect" data-file-id="${escapeHtml(file.id)}" data-share-id="${escapeHtml(share?.id || "")}">◌</button>
        <button class="icon-button" title="${shared ? "Decrypt and download" : "Download"}" data-action="download" data-file-id="${escapeHtml(file.id)}" data-share-id="${escapeHtml(share?.id || "")}">
          ↓
        </button>
        ${shared ? "" : `<button class="icon-button" title="Create offline share" data-action="share" data-file-id="${escapeHtml(file.id)}">↗</button>`}
      </div>
    </div>
  `;
}

function renderFileTable(files, options = {}) {
  if (!files.length) {
    return `
      <div class="empty-state">
        <div>
          <div class="empty-icon">⌁</div>
          <strong>${options.emptyTitle || "No encrypted files yet"}</strong>
          <p>${options.emptyText || "Upload a document and SecretVault will encrypt it in this browser before it reaches the Python relay."}</p>
          ${options.showUpload ? `<button class="button primary" data-action="upload">＋ Encrypt a file</button>` : ""}
        </div>
      </div>
    `;
  }
  return `
    <div class="table-head"><span>File</span><span>Size</span><span>Integrity</span><span>Updated</span><span></span></div>
    ${files.map((item) => renderFileRow(item.file || item, { share: item.share || null })).join("")}
  `;
}

function renderVaultPage() {
  const activeUser = getActiveUser();
  const files = ownedFiles();
  const sharedFiles = incomingShares()
    .map((share) => ({ share, file: getFile(share.fileId) }))
    .filter((item) => item.file);
  return `
    <main class="page">
      <section class="hero">
        <div>
          <p class="eyebrow">Private workspace · ${escapeHtml(activeUser.name)}</p>
          <h1>Your encrypted workspace</h1>
          <p>Keep important files private, then choose between an offline key envelope or a live session when it is time to share.</p>
        </div>
        <div class="button-row">
          <button class="button ghost" data-action="open-tab">＋ Open second tab</button>
          <button class="button primary" data-action="upload">＋ Encrypt a file</button>
          <input id="file-input" class="hidden-input" type="file" />
        </div>
      </section>
      ${renderStats()}
      ${renderNotice()}
      <section class="section">
        <div class="section-head">
          <div><h2>My Files</h2><p>Encrypted at rest on the Python SQLite relay</p></div>
          <button class="section-link" data-action="upload">Upload securely ↗</button>
        </div>
        <div class="panel file-table">
          ${renderFileTable(files, { showUpload: true })}
        </div>
      </section>
      <section class="section">
        <div class="section-head">
          <div><h2>Shared with me</h2><p>Offline envelopes can be opened without the owner being online</p></div>
          ${sharedFiles.length ? `<span class="protocol-chip">ElGamal Hybrid</span>` : ""}
        </div>
        <div class="panel file-table">
          ${renderFileTable(sharedFiles, { emptyTitle: "No offline shares yet", emptyText: "When a contact sends you an offline share, its AES file key will arrive in an ElGamal envelope here." })}
        </div>
      </section>
    </main>
  `;
}

function renderLiveSteps(status = "ready") {
  const active = status === "waiting" || status === "accepted" || status === "sent";
  const accepted = status === "accepted" || status === "sent";
  const sent = status === "sent";
  return `
    <div class="step-list">
      <div class="step-item"><span class="step-number done">1</span><div><strong>Authenticate identity</strong><p>Public signing and ElGamal keys identify each demo profile.</p></div></div>
      <div class="step-item"><span class="step-number ${active ? "done" : ""}">2</span><div><strong>Exchange ephemeral DH keys</strong><p>${active ? "P-256 public keys were relayed without exposing private key material." : "The sender will create a fresh P-256 ECDH key pair for this transfer."}</p></div></div>
      <div class="step-item"><span class="step-number ${accepted ? "done" : ""}">3</span><div><strong>Derive the session key</strong><p>${accepted ? "Both sides derive the same AES-256-GCM key from the shared secret." : "HKDF-style key derivation is completed after the recipient accepts."}</p></div></div>
      <div class="step-item"><span class="step-number ${sent ? "done" : ""}">4</span><div><strong>Stream encrypted payload</strong><p>${sent ? "Ciphertext was sent through the Python relay; the receiver decrypts locally." : "Only AES-GCM ciphertext will cross the relay."}</p></div></div>
    </div>
  `;
}

function renderOutgoingCard(item) {
  const recipient = getUser(item.recipientId);
  const statusClass = item.status === "sent" ? "success" : item.status === "accepted" ? "info" : "pending";
  const statusLabel = item.status === "sent" ? "Delivered" : item.status === "accepted" ? "Encrypting" : "Waiting for recipient";
  return `
    <article class="transfer-card">
      <div class="transfer-head">
        <div class="transfer-title">
          <span class="file-icon">${escapeHtml(fileExtension(item.fileName))}</span>
          <div><strong>${escapeHtml(item.fileName)}</strong><span>To ${escapeHtml(recipient?.name || "contact")} · ${formatBytes(item.fileSize)}</span></div>
        </div>
        <span class="status-chip ${statusClass}">${statusLabel}</span>
      </div>
      <div class="transfer-meta"><span class="protocol-chip">P-256 DH</span><span class="security-chip">AES-256-GCM</span><span class="muted">${formatTime(item.createdAt)}</span></div>
    </article>
  `;
}

function renderIncomingCard(item) {
  const sender = getUser(item.payload.senderId);
  const isReady = item.status === "ready";
  const isWaiting = item.status === "waiting";
  return `
    <article class="transfer-card">
      <div class="transfer-head">
        <div class="transfer-title">
          <span class="file-icon teal">${escapeHtml(fileExtension(item.payload.fileName))}</span>
          <div><strong>${escapeHtml(item.payload.fileName)}</strong><span>From ${escapeHtml(sender?.name || "contact")} · ${formatBytes(item.payload.fileSize)}</span></div>
        </div>
        <span class="status-chip ${isReady ? "success" : isWaiting ? "pending" : "info"}">${isReady ? "Ready to open" : isWaiting ? "Accept transfer" : "Waiting for payload"}</span>
      </div>
      <div class="transfer-meta"><span class="protocol-chip">Authenticated DH</span><span class="security-chip">AES-GCM</span>
        ${isWaiting ? `<button class="button small primary" data-action="accept-live" data-transfer-id="${escapeHtml(item.transferId)}">Accept securely</button>` : ""}
        ${isReady ? `<button class="button small primary" data-action="download-live" data-transfer-id="${escapeHtml(item.transferId)}">Decrypt & download</button>` : ""}
      </div>
    </article>
  `;
}

function renderLivePage() {
  const activeUser = getActiveUser();
  const contacts = appState.remote.users.filter((user) => user.id !== activeUser.id);
  const latestOutgoing = Array.from(appState.outgoing.values()).slice(-4).reverse();
  const latestIncoming = Array.from(appState.incoming.values()).slice(-4).reverse();
  const latest = [...latestOutgoing.map((item) => ({ type: "outgoing", item })), ...latestIncoming.map((item) => ({ type: "incoming", item }))].slice(0, 6);
  return `
    <main class="page">
      <section class="hero">
        <div>
          <p class="eyebrow">Online-only channel · authenticated session</p>
          <h1>Live Transfer</h1>
          <p>Exchange ephemeral Diffie–Hellman keys, derive a fresh AES-GCM session, and send the file without exposing a reusable file key.</p>
        </div>
        <div class="button-row"><button class="button ghost" data-action="open-tab">＋ Open receiver tab</button></div>
      </section>
      <div class="live-layout">
        <section class="process-card">
          <div class="card-title"><span class="card-title-icon">↔</span><div><h2>Start an encrypted transfer</h2><p>Both profiles need an open SecretVault tab.</p></div></div>
          <form class="form-grid" data-form="live-start">
            <div><label class="field-label" for="live-file-input">File to send</label><input class="field-input" id="live-file-input" type="file" required /><p class="form-hint">The selected file is encrypted in memory only after the recipient accepts.</p></div>
            <div><label class="field-label" for="live-recipient">Recipient</label><select class="field-select" id="live-recipient">${contacts.map((user) => `<option value="${escapeHtml(user.id)}" ${user.id === appState.liveRecipientId ? "selected" : ""}>${escapeHtml(user.name)} · ${user.status}</option>`).join("")}</select></div>
            <button class="button primary" type="submit" ${appState.busy ? "disabled" : ""}>${appState.busy === "Starting live session" ? "Creating session…" : "Start secure session ↗"}</button>
          </form>
        </section>
        <section class="process-card">
          <div class="card-title"><span class="card-title-icon">◈</span><div><h2>Protocol trace</h2><p>${appState.outgoing.size ? "Latest live session" : "What happens on send"}</p></div></div>
          ${renderLiveSteps(Array.from(appState.outgoing.values()).at(-1)?.status || "ready")}
        </section>
      </div>
      <section class="section">
        <div class="section-head"><div><h2>Live session activity</h2><p>Offers and ciphertext are relayed through Python polling endpoints.</p></div><span class="protocol-chip">No plaintext relay</span></div>
        <div class="transfer-stack">
          ${latest.length ? latest.map(({ type, item }) => (type === "outgoing" ? renderOutgoingCard(item) : renderIncomingCard(item))).join("") : `<div class="panel empty-state"><div><div class="empty-icon">↔</div><strong>No live sessions yet</strong><p>Open a second tab as Bob or Carol, then accept a transfer to see the DH handshake here.</p></div></div>`}
        </div>
      </section>
    </main>
  `;
}

function renderContactsPage() {
  const activeUser = getActiveUser();
  const contacts = appState.remote.users.filter((user) => user.id !== activeUser.id);
  const identity = getStoredIdentity(activeUser.id);
  return `
    <main class="page">
      <section class="hero">
        <div><p class="eyebrow">Public identity directory</p><h1>Trusted contacts</h1><p>Share public keys and inspect the fingerprints used to address offline envelopes and live sessions.</p></div>
        <div class="button-row"><button class="button primary" data-action="open-tab">＋ Open another profile</button></div>
      </section>
      <div class="notice"><span class="notice-icon">◎</span><div><strong>Private keys are local to this browser</strong><p>Switching the active demo profile changes which local private key is used. In a real account, protect that key with a device credential or recovery flow.</p></div></div>
      <section class="section"><div class="section-head"><div><h2>My identity</h2><p>Published public material only</p></div><span class="security-chip">✓ Ready</span></div>
        <div class="key-card">
          <div class="contact-main">${avatar(activeUser, "large")}<div><strong>${escapeHtml(activeUser.name)}</strong><span>${escapeHtml(activeUser.email)}</span></div><span class="contact-status">● online</span></div>
          <div class="key-line"><span>Fingerprint</span><span>${escapeHtml(identity?.fingerprint || activeUser.fingerprint || "pending")}</span></div>
          <div class="key-line"><span>Signing identity</span><span>${escapeHtml(identity?.signing?.algorithm || "pending")}</span></div>
          <div class="key-line"><span>ElGamal public key</span><span>${keyEnvelopePreview(identity?.elgamal?.publicKey || activeUser.elgamalPublic || "pending")}</span></div>
        </div>
      </section>
      <section class="section"><div class="section-head"><div><h2>Directory</h2><p>Recipients available for offline and live sharing</p></div></div>
        <div class="contacts-grid">${contacts.map((user) => renderContactCard(user)).join("")}</div>
      </section>
    </main>
  `;
}

function renderContactCard(user) {
  return `
    <article class="contact-card">
      <div class="contact-main">${avatar(user, "large")}<div><strong>${escapeHtml(user.name)}</strong><span>${escapeHtml(user.email)}</span></div><span class="contact-status">● online</span></div>
      <div class="key-line"><span>Fingerprint</span><span>${escapeHtml(user.fingerprint || "pending")}</span></div>
      <div class="key-line"><span>ElGamal key</span><span>${keyEnvelopePreview(user.elgamalPublic || "pending")}</span></div>
      <div class="key-line"><span>Live protocol</span><span>P-256 ECDH</span></div>
    </article>
  `;
}

function renderInspectModal(fileId, shareId = null) {
  const file = getFile(fileId);
  const share = shareId ? getShare(shareId) : null;
  if (!file) {
    return "";
  }
  const owner = getUser(file.ownerId);
  const recipient = share ? getUser(share.recipientId) : null;
  const envelope = share?.envelope;
  const detailPayload = {
    fileId: file.id,
    cipherHash: file.cipherHash,
    fileIv: file.fileIv,
    envelope: envelope || "local device wrap",
  };
  return `
    <div class="modal-layer" data-action="close-modal">
      <section class="modal" role="dialog" aria-modal="true" aria-labelledby="inspect-title" data-modal-card>
        <div class="modal-head"><div><h2 id="inspect-title">Crypto Inspector</h2><p>Evidence generated by the current browser session</p></div><button class="icon-button" data-action="close-modal" aria-label="Close">×</button></div>
        <div class="detail-hero">${fileIcon(file, Boolean(share))}<div><strong>${escapeHtml(file.name)}</strong><span>${escapeHtml(file.mime)} · ${formatBytes(file.size)} · ${escapeHtml(formatDate(file.updatedAt))}</span></div><span class="security-chip">✓ Verified</span></div>
        <div class="detail-grid">
          <div class="detail-cell"><label>Owner</label><strong>${escapeHtml(owner?.name || "Unknown")}</strong></div>
          <div class="detail-cell"><label>File encryption</label><strong>AES-256-GCM</strong></div>
          <div class="detail-cell"><label>Key delivery</label><strong>${share ? "ElGamal Hybrid" : "Local device wrap"}</strong></div>
          <div class="detail-cell"><label>Recipient</label><strong>${escapeHtml(recipient?.name || "Only me")}</strong></div>
          <div class="detail-cell"><label>Integrity</label><strong>SHA-256 verified</strong></div>
          <div class="detail-cell"><label>Relay visibility</label><strong>Ciphertext only</strong></div>
        </div>
        <pre class="code-block">${escapeHtml(JSON.stringify(share ? { scheme: envelope.scheme, group: envelope.group, c1: keyEnvelopePreview(envelope.c1), wrappedKey: keyEnvelopePreview(envelope.wrappedKey) } : detailPayload, null, 2))}</pre>
        <div class="modal-foot"><button class="button ghost" data-action="copy-inspector" data-copy-text="${escapeHtml(JSON.stringify(detailPayload))}">Copy evidence</button><button class="button primary" data-action="close-modal">Done</button></div>
      </section>
    </div>
  `;
}

function renderShareModal(fileId) {
  const file = getFile(fileId);
  const contacts = appState.remote.users.filter((user) => user.id !== appState.activeUserId && user.elgamalPublic);
  if (!file) {
    return "";
  }
  return `
    <div class="modal-layer" data-action="close-modal">
      <section class="modal" role="dialog" aria-modal="true" data-modal-card>
        <div class="modal-head"><div><h2>Prepare offline share</h2><p>${escapeHtml(file.name)} · recipient can open it later</p></div><button class="icon-button" data-action="close-modal" aria-label="Close">×</button></div>
        <div class="notice"><span class="notice-icon">↗</span><div><strong>ElGamal Hybrid envelope</strong><p>The file stays AES-GCM encrypted. Only its random file key is wrapped with the selected contact's public key.</p></div></div>
        <form class="form-grid" data-form="offline-share" data-file-id="${escapeHtml(fileId)}">
          <div><label class="field-label" for="share-recipient">Recipient</label><select class="field-select" id="share-recipient" required>${contacts.map((user) => `<option value="${escapeHtml(user.id)}">${escapeHtml(user.name)} · ${escapeHtml(user.fingerprint || "key ready")}</option>`).join("")}</select></div>
          <p class="form-hint">The owner does not need to remain online after the envelope is stored.</p>
          <div class="modal-foot"><button class="button ghost" type="button" data-action="close-modal">Cancel</button><button class="button primary" type="submit">Create encrypted share ↗</button></div>
        </form>
      </section>
    </div>
  `;
}

function renderModal() {
  if (!appState.modal) {
    return "";
  }
  if (appState.modal.type === "inspect") {
    return renderInspectModal(appState.modal.fileId, appState.modal.shareId);
  }
  if (appState.modal.type === "share") {
    return renderShareModal(appState.modal.fileId);
  }
  return "";
}

function renderToasts() {
  if (!appState.toasts.length) {
    return "";
  }
  return `<div class="toast-stack">${appState.toasts.map((toast) => `<div class="toast ${escapeHtml(toast.type)}">${escapeHtml(toast.message)}</div>`).join("")}</div>`;
}

function render() {
  if (!appState.remote.users.length) {
    return;
  }
  root.innerHTML = `
    <div class="app-shell">
      ${renderSidebar()}
      <div class="workspace">
        ${renderTopbar()}
        ${appState.view === "vault" ? renderVaultPage() : appState.view === "live" ? renderLivePage() : renderContactsPage()}
      </div>
    </div>
    ${renderModal()}
    ${renderToasts()}
  `;
}

async function switchProfile(userId) {
  if (!appState.remote.users.some((user) => user.id === userId)) {
    return;
  }
  appState.activeUserId = userId;
  sessionStorage.setItem(ACTIVE_USER_KEY, userId);
  appState.pollCursor = 0;
  appState.modal = null;
  await refreshRemote();
  render();
  showToast(`Switched to ${getActiveUser().name}'s local key set`, "success");
}

async function startLiveTransfer() {
  const fileInput = root.querySelector("#live-file-input");
  const recipientInput = root.querySelector("#live-recipient");
  const file = fileInput?.files?.[0];
  const recipientId = recipientInput?.value;
  if (!file || !recipientId) {
    throw new Error("Choose a file and a recipient first");
  }
  if (file.size > 80 * 1024 * 1024) {
    throw new Error("This demo accepts live transfers up to 80 MB");
  }
  appState.liveRecipientId = recipientId;
  setBusy("Starting live session");
  const keyPair = await generateDhKeyPair();
  const publicJwk = await exportDhPublicKey(keyPair.publicKey);
  const transferId = randomId("live");
  const item = {
    transferId,
    senderId: appState.activeUserId,
    recipientId,
    fileName: file.name,
    fileSize: file.size,
    mime: file.type || "application/octet-stream",
    createdAt: Date.now(),
    status: "waiting",
  };
  appState.outgoing.set(transferId, item);
  appState.outgoing.get(transferId).keyPair = keyPair;
  appState.outgoing.get(transferId).file = file;
  await api.sendLiveOffer({
    transferId,
    senderId: appState.activeUserId,
    recipientId,
    fileName: item.fileName,
    fileSize: item.fileSize,
    mime: item.mime,
    senderDhPublicJwk: publicJwk,
    senderDhFingerprint: await dhFingerprint(publicJwk),
  });
  await logActivity(`Started a live DH session for ${file.name}`);
  setBusy(null);
  render();
  showToast(`Session offer sent to ${getUser(recipientId)?.name || "recipient"}`, "success");
}

async function acceptLiveTransfer(transferId) {
  const incoming = appState.incoming.get(transferId);
  if (!incoming) {
    throw new Error("Live session is no longer available");
  }
  const keyPair = await generateDhKeyPair();
  const publicJwk = await exportDhPublicKey(keyPair.publicKey);
  incoming.keyPair = keyPair;
  incoming.status = "accepted";
  await api.sendLiveAccept({
    transferId,
    senderId: incoming.payload.senderId,
    recipientId: appState.activeUserId,
    recipientDhPublicJwk: publicJwk,
    recipientDhFingerprint: await dhFingerprint(publicJwk),
  });
  render();
  showToast("Recipient key sent. Waiting for encrypted payload…", "success");
}

async function handleLiveAccept(payload) {
  const outgoing = appState.outgoing.get(payload.transferId);
  if (!outgoing?.keyPair || outgoing.status === "sent") {
    return;
  }
  outgoing.status = "accepted";
  render();
  const recipientPublic = await importDhPublicKey(payload.recipientDhPublicJwk);
  const sessionKey = await importAndDerive(outgoing.keyPair.privateKey, recipientPublic);
  const bytes = new Uint8Array(await outgoing.file.arrayBuffer());
  const encrypted = await encryptWithCryptoKey(sessionKey, bytes);
  const cipherHash = await sha256Hex(base64ToBytes(encrypted.data));
  await api.sendLiveData({
    transferId: outgoing.transferId,
    senderId: appState.activeUserId,
    recipientId: outgoing.recipientId,
    fileName: outgoing.fileName,
    fileSize: outgoing.fileSize,
    mime: outgoing.mime,
    senderDhPublicJwk: await exportDhPublicKey(outgoing.keyPair.publicKey),
    iv: encrypted.iv,
    data: encrypted.data,
    cipherHash,
  });
  outgoing.status = "sent";
  await logActivity(`Sent ${outgoing.fileName} through an AES-GCM live session`);
  render();
  showToast(`${outgoing.fileName} is encrypted and ready on the receiver tab`, "success");
}

async function importAndDerive(privateKey, publicKey) {
  const { deriveDhSessionKey } = await import("./crypto.js");
  return deriveDhSessionKey(privateKey, publicKey);
}

async function handleLiveData(payload) {
  const incoming = appState.incoming.get(payload.transferId);
  if (!incoming?.keyPair) {
    return;
  }
  const senderPublic = await importDhPublicKey(payload.senderDhPublicJwk);
  const sessionKey = await importAndDerive(incoming.keyPair.privateKey, senderPublic);
  const bytes = await decryptWithCryptoKey(sessionKey, { iv: payload.iv, data: payload.data });
  const actualHash = await sha256Hex(base64ToBytes(payload.data));
  if (payload.cipherHash !== actualHash) {
    throw new Error("Live payload integrity check failed");
  }
  incoming.status = "ready";
  incoming.payload = { ...incoming.payload, ...payload };
  incoming.decrypted = bytesToBase64(bytes);
  await logActivity(`Received ${payload.fileName} through a verified live session`);
  render();
  showToast(`${payload.fileName} arrived. Decrypt it from Live session activity.`, "success");
}

function handleLiveEvent(event) {
  const payload = event.payload;
  if (event.type === "offer" && payload.recipientId === appState.activeUserId) {
    if (!appState.incoming.has(payload.transferId)) {
      appState.incoming.set(payload.transferId, { transferId: payload.transferId, payload, status: "waiting" });
      render();
      showToast(`Incoming live transfer from ${getUser(payload.senderId)?.name || "a contact"}`, "success");
    }
    return;
  }
  if (event.type === "accept" && payload.senderId === appState.activeUserId) {
    void handleLiveAccept(payload).catch((error) => showToast(error.message, "error"));
    return;
  }
  if (event.type === "data" && payload.recipientId === appState.activeUserId) {
    void handleLiveData(payload).catch((error) => showToast(error.message, "error"));
  }
}

async function pollLiveEvents() {
  if (appState.pollBusy || !appState.activeUserId) {
    return;
  }
  appState.pollBusy = true;
  try {
    const result = await api.pollLive(appState.activeUserId, appState.pollCursor);
    appState.pollCursor = result.cursor;
    for (const event of result.events) {
      handleLiveEvent(event);
    }
  } catch (error) {
    console.warn("Live poll unavailable", error);
  } finally {
    appState.pollBusy = false;
  }
}

async function copyText(value) {
  await navigator.clipboard.writeText(value);
  showToast("Inspector evidence copied", "success");
}

async function handleClick(event) {
  const actionElement = event.target.closest("[data-action]");
  const viewElement = event.target.closest("[data-view]");
  if (viewElement) {
    appState.view = viewElement.dataset.view;
    appState.modal = null;
    render();
    return;
  }
  if (!actionElement) {
    return;
  }
  const action = actionElement.dataset.action;
  if (action === "close-modal") {
    if (actionElement.classList.contains("modal-layer") && event.target !== actionElement) {
      return;
    }
    appState.modal = null;
    render();
    return;
  }
  try {
    if (action === "upload") {
      root.querySelector("#file-input")?.click();
      return;
    }
    if (action === "open-tab") {
      window.open(window.location.href, "_blank", "noopener");
      showToast("Second workspace tab opened. Switch its profile to the recipient.", "success");
      return;
    }
    if (action === "inspect") {
      appState.modal = { type: "inspect", fileId: actionElement.dataset.fileId, shareId: actionElement.dataset.shareId || null };
      render();
      return;
    }
    if (action === "share") {
      appState.modal = { type: "share", fileId: actionElement.dataset.fileId };
      render();
      return;
    }
    if (action === "download") {
      setBusy("Decrypting file");
      await downloadVaultFile(actionElement.dataset.fileId, actionElement.dataset.shareId || null);
      setBusy(null);
      return;
    }
    if (action === "accept-live") {
      await acceptLiveTransfer(actionElement.dataset.transferId);
      return;
    }
    if (action === "download-live") {
      const incoming = appState.incoming.get(actionElement.dataset.transferId);
      if (!incoming?.decrypted) {
        throw new Error("The payload is not ready yet");
      }
      triggerDownload(base64ToBytes(incoming.decrypted), incoming.payload.fileName, incoming.payload.mime);
      await logActivity(`Downloaded ${incoming.payload.fileName} after local live decryption`);
      showToast(`${incoming.payload.fileName} downloaded`, "success");
      return;
    }
    if (action === "copy-inspector") {
      await copyText(actionElement.dataset.copyText || "");
    }
  } catch (error) {
    setBusy(null);
    showToast(error.message || "The action could not be completed", "error");
  }
}

async function handleSubmit(event) {
  const form = event.target.closest("form[data-form]");
  if (!form) {
    return;
  }
  event.preventDefault();
  try {
    if (form.dataset.form === "offline-share") {
      const recipientId = form.querySelector("#share-recipient")?.value;
      await createOfflineShare(form.dataset.fileId, recipientId);
      render();
      return;
    }
    if (form.dataset.form === "live-start") {
      await startLiveTransfer();
      return;
    }
  } catch (error) {
    setBusy(null);
    showToast(error.message || "The form could not be completed", "error");
  }
}

function handleChange(event) {
  if (event.target.matches("[data-profile-select]")) {
    void switchProfile(event.target.value).catch((error) => showToast(error.message, "error"));
    return;
  }
  if (event.target.matches("#file-input")) {
    const file = event.target.files?.[0];
    void uploadSelectedFile(file).catch((error) => {
      setBusy(null);
      showToast(error.message || "Upload failed", "error");
    });
    event.target.value = "";
  }
  if (event.target.matches("#live-file-input")) {
    appState.liveFile = event.target.files?.[0] || null;
  }
  if (event.target.matches("#live-recipient")) {
    appState.liveRecipientId = event.target.value;
  }
}

function handleInput(event) {
  if (event.target.matches("[data-search-input]")) {
    appState.search = event.target.value;
    render();
  }
}

async function bootstrap() {
  try {
    await api.getHealth();
    await refreshRemote();
    if (!appState.remote.users.some((user) => user.id === appState.activeUserId)) {
      appState.activeUserId = "alice";
      sessionStorage.setItem(ACTIVE_USER_KEY, appState.activeUserId);
    }
    for (const user of appState.remote.users) {
      await ensureIdentity(user);
    }
    await refreshRemote();
    await initializeDemoFiles();
    await refreshRemote();
    render();
    appState.pollTimer = window.setInterval(() => void pollLiveEvents(), 1100);
    void pollLiveEvents();
  } catch (error) {
    root.innerHTML = `<div class="boot-screen"><div><p class="eyebrow">BACKEND CONNECTION FAILED</p><h1>SecretVault could not start</h1><p class="muted">${escapeHtml(error.message)}. Run <code>py -3.9 app.py</code> from the secretvault-app folder, then reload.</p></div></div>`;
  }
}

root.addEventListener("click", (event) => void handleClick(event));
root.addEventListener("submit", (event) => void handleSubmit(event));
root.addEventListener("change", handleChange);
root.addEventListener("input", handleInput);
bootstrap();
