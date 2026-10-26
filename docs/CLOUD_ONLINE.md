# SecretVault Online 3.0

Python API: Hugging Face Space `thienphuc12339/secretvault-api`.
Web: static `web/` on Vercel. The web and Windows client use the same accounts and backend. A shared Wi-Fi network is no longer required.

## User workflow

1. Create an account or sign in using email and password.
2. Upload a file to **Tệp của tôi**. The browser encrypts it before upload.
3. Choose **Chia sẻ**, enter the recipient account email, or select a contact. They can open it later in **Được chia sẻ**.
4. For a temporary transfer, both users open **Gửi trực tiếp**. The receiver accepts the invitation and downloads the file. Keep both tabs open; reloading or restarting the service requires a new invitation.
5. Sign in with the same account on another device to access stored files. No manual key or certificate step is required.

## Owner activation

The production activation code is generated locally in `.local/cloud-owner.json` and is never committed, uploaded, or shown in the application UI. Only its SHA-256 hash is configured as the HF secret `SV_ADMIN_CLAIM_HASH`.

The owner creates their own account, visits `/setup`, enters this one-time code, and opens `/admin`. The first successful claim consumes the global activation opportunity. Registration alone never grants administrator privileges. All admin API calls independently check the role on the server.

The admin dashboard shows account status, usage, quota, recent uploads and transfer events. It does not return authentication credentials, private identity bundles, encryption keys or decrypted file content. Admins can pause/re-enable accounts and adjust quotas. Pausing an account invalidates its sessions.

## Storage and limits

- Private HF Storage Bucket `secretvault-api-storage`, read/write mount `/data`.
- Ciphertext is stored in the bucket; SQLite/WAL remains on local disk. Immutable JSON metadata snapshots are checksum-verified and restored on a fresh runtime. Keep the last three snapshots.
- Sessions and ephemeral direct-transfer payloads are temporary. Account identities, stored ciphertext, contacts, sharing permissions, quotas and admin role persist.
- 25 MiB/file; default 100 MiB/account; 512 MiB total; 50 accounts; one service replica. Quotas are enforced server-side and include trash. They are application limits, not a claim about provider free-tier allowance.
- Trash is reversible. Restoring a file also restores its previous sharing permissions. Revocation prevents subsequent downloads; it cannot remove copies a recipient already saved.
- Free HF hardware may sleep and initial requests can take time. This configuration is suitable for a small demo, not an always-on SLA.

## Deployment and operations

`node hosting/build-web.mjs` validates static web output. Vercel uses `vercel.json` and `web/`; `/admin` and `/setup` rewrite to the same SPA. Uploads go directly to HF in 1 MiB chunks and never pass through Vercel Functions. No cross-site authentication cookies are used.

`py -3.11 hosting/prepare_hf.py` prepares **only** `app.py`, `requirements.txt`, `README.md` and a source-only `server.zip`. Upload these four files to the Space using the authenticated browser. The public source contains no real user data or credentials. The API exposes `/api/health`, `/api/register`, `/api/login`, `/api/bootstrap`, `/api/files`, `/api/shares`, `/api/live`, and protected `/api/admin/*`.

Set `SV_ALLOWED_ORIGINS` to the exact Vercel production origin and `SV_FRONTEND_URL` to the same URL. Never use a wildcard Vercel origin. Attach the private bucket before running the service. A missing or corrupt persistent store fails closed instead of silently starting an empty account database.

For local development, install `hosting/cloud-requirements.txt` into a separate environment and run `python -m cloudserver.main` with `SV_LOCAL_WEB=1`, `PORT=8787`, and development storage paths. Run `tests/integration.mjs`, `tests/cloud-policy.mjs` and `python -m tests.cloud-persistence` against disposable local data.

The normal UI hides implementation details. Public-key identity, DH for direct transfer, and ElGamal hybrid for asynchronous sharing still run in the client, using the existing cryptographic module. Automatic contact binding uses authenticated HTTPS directory lookup plus cached identity checks (TOFU); this is not an independent identity verification channel. The implementation has no external cryptographic audit. Email verification and password recovery are not implemented in this demo.
