# SecretVault Online 3.0.1

Web: **https://secretvault-online.vercel.app** (Vercel).  
Python API: **https://secretvault-api-thienphuc.onrender.com** (Render Free).  
Administrator: **https://secretvault-online.vercel.app/admin**.

The web and Windows client use the same accounts and backend. A shared Wi-Fi network is no longer required. The previous LAN host and its accounts are separate and preserved.

## User workflow

1. Create an account or sign in using email and password.
2. Upload a file to **Tệp của tôi**. The browser encrypts it before upload.
3. Choose **Chia sẻ**, enter the recipient account email, or select a contact. They can open it later in **Được chia sẻ**.
4. For a temporary transfer, both users open **Gửi trực tiếp**. The receiver accepts the invitation and downloads the file. Keep both tabs open; reloading or restarting the service requires a new invitation.
5. Sign in with the same account on another device to access stored files. No manual key or certificate step is required.

## Windows client

Install SecretVault-Online-Setup-3.0.1-x64.exe from the current release or delivery folder. The application opens the web workspace in a native Edge WebView2 window. Other PCs need no Python, local server, LAN profile or certificate installation. If WebView2 cannot start, the app offers to open the same workspace in the default browser. The installer is not code-signed.

The application clears its local sign-in state when its window closes. File downloads use the native save dialog. The --diagnose option writes endpoint status to the current user's LocalAppData/SecretVaultOnline folder without account data or credentials.

Version 3.0.1 exposes Trash directly in navigation, adds password visibility and clearer filtered-empty states, and handles keyboard focus in dialogs. Decrypted download links are revoked when replaced, dismissed, after two minutes or on logout. Pending requests from an earlier session cannot restore that session after logout. Native Save As and byte-for-byte readback were verified on the existing Windows machine on 30 October 2026; see CLOUD_STATUS.md for the full validation boundary.

## Owner activation

The production activation code is generated locally in .local/cloud-owner.json and is never committed, uploaded, or included in the normal client. Only its SHA-256 hash is configured as the service secret SV_ADMIN_CLAIM_HASH.

The owner opens the private **.local/Kich-hoat-quan-tri.url** shortcut, creates their own account or signs in, and clicks the activation button. The code is prefilled and removed from the address bar. Alternatively, visit /setup and enter the separately stored activation code. Then open /admin. This shortcut is for the owner only.

The first successful claim consumes the global activation opportunity. Registration alone never grants administrator privileges. All admin API calls independently check the role on the server.

The admin dashboard shows account status, usage, quota, recent uploads and transfer events. It does not return authentication credentials, private identity bundles, encryption keys or decrypted file content. Admins can pause/re-enable accounts and adjust quotas. Pausing an account invalidates its sessions.

## Storage and limits

- Private HF Storage Bucket: thienphuc12339/secretvault-api-storage. Only the Render backend has its scoped HF_TOKEN secret, with read/write access limited to this bucket.
- Ciphertext is stored in the bucket; SQLite/WAL remains on local disk. Each API operation commits one combined immutable, checksum-verified metadata snapshot before replying successfully. A fresh runtime restores from the private bucket. Keep the latest three snapshots. Health probes never wait for the storage transaction lock.
- Sessions and ephemeral direct-transfer payloads are temporary. Account identities, stored ciphertext, contacts, sharing permissions, quotas and admin role persist.
- 25 MiB/file; default 100 MiB/account; 512 MiB total; 50 accounts; one service replica. Quotas are enforced server-side and include trash. These are application limits, not provider free-tier allowances.
- Trash is reversible and still counts toward storage. Restoring a file also restores previous sharing permissions. Revocation prevents subsequent downloads; it cannot remove copies a recipient already saved.
- Render Free sleeps after inactivity and a cold start can take around a minute. The UI checks the connection before sign-in. Remote storage writes can add several seconds. This is a small demo deployment without an always-on SLA.

## Deployment and operations

Render: build with **pip install -r hosting/render-requirements.txt**, start **python -m cloudserver.main**, choose Free/Singapore/one instance, health path /api/health, and Python 3.12.12. The source configuration is render.yaml. Auto-deploy is off; use Manual Deploy after a reviewed code change.

Set SV_ALLOWED_ORIGINS and SV_FRONTEND_URL to https://secretvault-online.vercel.app; set SV_BUCKET_ID to thienphuc12339/secretvault-api-storage. Store HF_TOKEN and SV_ADMIN_CLAIM_HASH only in private service configuration. Never put them in web/ or use a wildcard Vercel origin. A missing, public, unavailable or corrupt storage backend fails closed instead of silently initializing an empty account database.

Vercel: node hosting/build-web.mjs validates static output in web/. vercel.json rewrites /admin and /setup to the SPA. Files upload directly to Render in 1 MiB chunks rather than passing through Vercel Functions. Authentication uses per-session bearer tokens rather than cross-site cookies. web/service.json supplies the public API address to desktop diagnostics.

The earlier HF Gradio prototype could not run this CPU service on the account's Free ZeroGPU plan. The active API therefore runs on Render; HF provides private storage. Keep the unused prototype Space paused so only one service writes the bucket. hosting/prepare_hf.py remains a source-only packaging utility for that earlier prototype.

For local development, install hosting/cloud-requirements.txt into a separate environment and run python -m cloudserver.main with SV_LOCAL_WEB=1, PORT=8787 and disposable storage paths. The local, remote-adapter and live-service checks are in tests/. Never use the real LAN database as a test fixture or upload it to the public source repo.

The normal UI hides implementation details. Public-key identity, DH for direct transfer, and ElGamal hybrid for asynchronous sharing still run in the existing client cryptographic module. Automatic contact binding uses authenticated HTTPS directory lookup plus cached identity checks (TOFU), not an independent identity verification channel. The implementation has no external cryptographic audit. Email verification and password recovery are not implemented in this demo.
