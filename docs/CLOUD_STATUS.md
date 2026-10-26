# Deployment handoff — 27 October 2026

This file records verified deployment state; it does not claim the backend is live.

- Web is deployed on **https://secretvault-online.vercel.app** (Vercel project `secretvault-online`, team `thien-phucs-projects-52ea96ac`). Production static assets and security headers return HTTP 200.
- The Windows client loads the same web application in a native Edge WebView2 window. Installer: `release/SecretVault-Online-Setup-3.0.0-x64.exe`. It installs per-user without Python or a LAN certificate. A source-built installed executable was responsive and emitted a successful page-loaded readiness record.
- The HF Space `thienphuc12339/secretvault-api` and **private** bucket `thienphuc12339/secretvault-api-storage` were created. Its code was uploaded, but Free ZeroGPU rejects this CPU service with `No @spaces.GPU function detected during startup`; CPU Basic is blocked without PRO. The API endpoint currently returns 503.
- The owner explicitly chose a different free Python host. **Render Free** is the prepared target. Its persistent storage adapter uses the private HF bucket; no SQLite database is placed on an ephemeral host disk without a remote snapshot.
- `render.yaml` and `hosting/render-requirements.txt` are ready. The private owner activation code is in `.local/cloud-owner.json`; only its hash goes into service configuration. No token, private certificate or real local account database was published.

## Waiting on the owner

1. The Chrome Render tab is at Google sign-in consent (name, profile picture and email). Complete the sign-in/account setup personally, including any account terms.
2. The Chrome Hugging Face tab is at **Confirm your identity**. Enter the existing password there; do not paste passwords into chat.
3. After identity confirmation, prepare a fine-grained token with only the private bucket permissions required by the backend. Review the exact scope before creating the token. Store it only in Render's `HF_TOKEN` secret.

These are current account authentication/authorization gates, not a request to reconfirm the deployment already authorized by the owner.

## Remaining deployment work

Create the Render Free Python service using the public repo `ntthienphuc/secretvault-app`, build `pip install -r hosting/render-requirements.txt`, start `python -m cloudserver.main`, health `/api/health`, one instance. Configure exact Vercel origin, private bucket ID, `HF_TOKEN`, and `SV_ADMIN_CLAIM_HASH`. Do not add a payment method or upgrade a plan.

After Render assigns the real HTTPS domain, update `web/src/config.js`, `web/service.json`, and Vercel's CSP `connect-src`. Redeploy web, run the crypto/API checks on the live service, verify a real remote-bucket write/read, restart the live service, and verify persisted accounts/files. Finally activate the owner's administrator account through `/setup` and deliver the final live URLs. The user chooses their own password.

## Validation evidence and boundaries

- `audit/cloud-integration-results.json` and `audit/cloud-gradio-integration-results.json`: 40 API/cryptographic checks passed against isolated local servers, including DH live transfer, ElGamal asynchronous sharing, authenticated access and tamper detection.
- `audit/cloud-policy-results.json`: 12 local permission/CORS/quota checks passed.
- `audit/cloud-persistence-results.json`: 5 disk snapshot/recovery/error checks passed.
- `audit/cloud-bucket-results.json`: 5 remote-object adapter checks passed with a simulated bucket; the real HF bucket is not yet integration-tested from Render.
- Browser UI: upload, share by recipient email without manual key actions, recipient inbox, admin data, and account/data recovery after a local restart were observed. The decrypted download link was created, but browser automation did not observe a completed native download.
- Responsive layout was observed at 390 × 844 with no document overflow. This is browser emulation, not a physical phone test.
- Native Windows installer completed successfully and the WebView2 application loaded the web page; a full native send/download flow has not been verified.
- Public online API registration/sharing/restart tests remain pending; do not describe the full online service as working until they pass.

The previous LAN host and its two real accounts are separate and preserved. No local account migration has been performed.
