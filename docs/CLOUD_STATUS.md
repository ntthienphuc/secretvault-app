# SecretVault Online 3.0 — verified release

Verified on 27 October 2026, Asia/Ho_Chi_Minh.

## Live services

- Web and mobile browser: **https://secretvault-online.vercel.app**.
- Administrator dashboard: **https://secretvault-online.vercel.app/admin**.
- Python API: **https://secretvault-api-thienphuc.onrender.com**.
- Health: **https://secretvault-api-thienphuc.onrender.com/api/health**.
- Source: **https://github.com/ntthienphuc/secretvault-app**.
- Render Free service: secretvault-api-thienphuc, ID srv-dbfoqgt9fdbs739uuq1g, Singapore, Python 3.12.12, one instance. Auto-deploy is off.
- Runtime code was deployed from commit cce9f743c9e570f4ea616b72bb71959052d14162. Later commits contain web, test and documentation updates; the deployed backend source matches the current backend source.
- Private persistent storage: HF bucket thienphuc12339/secretvault-api-storage. Its fine-grained token is restricted to that bucket and stored only in Render's HF_TOKEN configuration. The owner explicitly approved token creation and this storage destination. No credentials were committed.
- The earlier CPU prototype Space on HF is paused. Its private bucket remains available to Render. Free HF ZeroGPU could not host the CPU-only API, so the owner approved Render Free instead.

## Windows and owner setup

Installer: release/SecretVault-Online-Setup-3.0.0-x64.exe. A copy is on the Desktop in the SecretVault Online folder. The native client loads the same Vercel workspace through Edge WebView2, without requiring Python or a LAN certificate on other PCs.

Only first-time owner onboarding remains: open the private .local/Kich-hoat-quan-tri.url shortcut, create or sign into the owner's own SecretVault account, and click activation. The code is prefilled and removed from the URL before normal use. It is not part of the distributed installer or public source. Normal account registration never grants administrator privileges.

The online deployment starts a separate vault. The previous LAN host and its two real accounts were preserved; no private local account data was migrated or uploaded.

## Verification

- **41 live API/cryptographic checks passed**, including registration/login, encrypted multi-chunk upload and download, signed DH live transfer, offline ElGamal sharing with the sender logged out, revocation, invalid identities and tampered data. Evidence: audit/cloud-production-integration-results.json.
- **5 live restart recovery checks passed** after Render recorded a real service restart at 00:47. The same account unlocked its identity; stored metadata and ciphertext were recovered; the downloaded file decrypted to the exact pre-restart plaintext hash; user/admin separation and revoked access remained intact. Evidence: audit/cloud-production-restart-results.json.
- **12 local admin/CORS/quota checks passed**. Evidence: audit/cloud-policy-results.json.
- **5 storage snapshot recovery checks, 5 remote-adapter checks, and 5 atomicity/liveness checks passed**. The availability test verifies health responses during a blocked durable write and verifies that a failed admin-role save returns 503 without granting the role. Evidence: audit/cloud-persistence-results.json, audit/cloud-bucket-results.json, audit/cloud-availability-results.json.
- Public access checks: unauthenticated bootstrap/admin requests return 401; private filesystem paths return 404; CORS allows the exact Vercel production origin.
- Browser UI: local upload/share-by-email/recipient inbox and local admin data were observed. The public web signed in after a live restart and uploaded a real QA text file. The normal UI displayed no raw cryptographic keys or protocol inspector.
- Windows: final installer completed successfully, the native WebView2 application was responsive and loaded the web page, and the installed executable's endpoint diagnostics returned web 200 / API 200.
- Responsive layout was observed at 390 × 844 with no document overflow. This was browser emulation, not a physical phone test.
- Browser automation created the decrypted download link but did not observe a completed native save; cryptographic plaintext equality was independently verified through the live API and after restart.

## Operational bounds

The application enforces 25 MiB/file, default 100 MiB/account, 512 MiB total and 50 accounts. Trash still counts toward storage. These are application limits rather than the provider's free storage allowance.

Render Free can sleep on inactivity and may need around a minute to wake. Remote persistence adds several seconds to writes. This is a functional academic demo with improved product UI; it has no external cryptographic audit, email verification, password recovery or always-on SLA. The Windows installer is unsigned. The production owner must complete the private first-time activation themselves.
