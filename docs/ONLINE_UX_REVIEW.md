# SecretVault 2.1 — hosting and online UX review

> Historical proposal for LAN version 2.1. It has been superseded by the deployed Online 3.0.1 release: [current deployment](CLOUD_ONLINE.md), [verified status](CLOUD_STATUS.md), and [release changes](CHANGELOG.md). The current normal UI manages keys automatically; users do not manually pin fingerprints.

Reviewed 26 October 2026. This is a local source/browser review and a deployment proposal. No public endpoint was created, no hosting account was changed, and no production performance claim is made.

## Recommendation

Use one HTTPS origin for everyone. For an ongoing small class/group, start with a Linux VPS, Caddy, the Python service, and persistent local storage. Keep one server process against one SQLite data directory. A 1-vCPU, 2-GiB RAM, 50-GiB SSD machine is a starting budget, not a measured concurrency guarantee. Validate on the chosen region/network before release.

For a short supervised demonstration, a PC and an HTTPS tunnel can provide a temporary URL; the PC and tunnel must remain running. The current backend requires its behind-proxy mode and preserved Host/HTTPS forwarding headers. Do not expose the default loopback-only instance without checking those requirements. A tunnel was not tested in this review.

Hugging Face Docker Spaces can run a custom Python service, but require packaging/proxy adaptation for this backend. Default Space disk is ephemeral. Spaces CPU Basic can sleep after inactivity. Persistent database and ciphertext storage must be designed separately. Current HF documentation says creating compute-backed Docker/Gradio Spaces requires a paid plan. Spaces is an available alternative, not a prerequisite for this app.

## Intended everyday flow

1. Open the shared HTTPS URL, or a desktop shortcut configured to that URL.
2. Register/log in on that host. A local-server account does not automatically exist on the online server. Migration must preserve the database and ciphertext together, or users start new accounts on the shared host.
3. Find a recipient and verify/pin their public-key fingerprint once.
4. Choose asynchronous sharing (ElGamal-Hybrid) or a live transfer (DH).
5. Show explicit sending/awaiting acceptance/receiving/verified states.
6. Show storage used, remaining quota, progress, and actionable recovery when interrupted.

The web client is sufficient; recipients do not need Python or an installer. For online use, the desktop launcher should reopen the saved shared host by default, with local hosting as a separate explicit choice. In 2.1 it currently starts and opens the local server on every launch.

## Verified implementation today

- Python supports headless operation, direct TLS, and loopback HTTPS reverse-proxy mode. Caddy and systemd examples already exist in `hosting/`.
- Vault ciphertext is stored in `ciphertext/*.bin`; account, manifest, authorization and sharing metadata are stored in SQLite.
- The hard file limit is 256 MiB; upload/download chunk size is 1 MiB; at most 1,000 non-deleted file records per account.
- There is no aggregate per-user byte quota or server-wide storage reservation/enforcement.
- Sharing an existing stored file adds a recipient envelope/record rather than copying the file ciphertext for each recipient.
- Live ciphertext passes through the server as Base64 JSON and temporarily occupies SQLite space. It is not a direct peer-to-peer transport. Expired live payload rows are removed during bootstrap pruning; SQLite can retain allocated file space afterwards.
- File deletion marks the file deleted; it does not reclaim its ciphertext blocks. There is no abandoned-upload cleanup job.
- Upload and download chunk requests run sequentially. A download assembles plaintext parts into a browser Blob. Raising the file-size constant alone is insufficient for large-file support.
- Authenticated clients refresh the complete bootstrap response every three seconds. This makes invitation and state transitions depend on the polling cycle.
- Live session secrets are memory-only. Reloading during a live session loses its key and requires a new session.

## Browser observations this review

Used the synthetic Alice/Bob design-QA accounts and a 109-byte text fixture on an isolated audit data directory at localhost port 8786. This did not use the user's vault data.

- Alice login/unlock until the vault heading appeared: 2,291 ms in one run, including browser automation overhead.
- Alice offer until Bob's acceptance button appeared: 1,971 ms in one run, including browser automation overhead.
- Both parties completed a new DH transfer. Receiver displayed verified completion and a Blob save link. No browser warning/error log entries were observed in this flow. A native filesystem download was not independently verified.
- Reloading Bob's tab returned to the login screen.
- These single local observations are not p50/p95 results, WAN timings, file-throughput benchmarks, or concurrency tests. No reliable accept-to-payload timing was recorded.
- Screenshot: `audit/online-ux-live-check.png`.

## Work before a polished online release

1. Unify launch behavior around the shared host; retain explicit local-demo mode. Make server/account migration visible to the operator.
2. Deliver state-change events promptly and retain reconnection fallback. Avoid refetching all file/user metadata on every idle tick; paginate larger lists.
3. Add progress percentage, transferred bytes, speed, cancel, retry and clear completion. Resume stored uploads safely; live-key loss requires an explicit new handshake/re-send. Do not silently persist ephemeral DH keys to obtain refresh recovery.
4. Enforce byte quotas server-side, reserve disk space for in-progress uploads, and display used/remaining space. Add a documented trash retention/reclaim policy and cleanup for abandoned uploads.
5. Add a guided first-contact fingerprint check and clearer user labels for asynchronous versus live sharing, while retaining the existing cryptographic methods.
6. Operate persistent storage, scheduled off-host backups, restore checks and restricted registration for the initial group. Before broader Internet access, review/harden the HTTP application server and proxy trust configuration.
7. Rehearse on two physical devices and different networks: authentication, both transfer modes, near-limit files, interruptions, refresh/expiry, restart persistence, disk/quota limits and restored backups. Set latency/throughput acceptance targets only after this test.

Example capacity policy, not implemented: a 20-GiB vault pool and 1-GiB/account for 20 accounts, with separate reserve for OS, temporary live payloads, logs and backups. Quotas do not guarantee every account can fill its allocation unless capacity is reserved. A 100-MB file stored once and shared to ten recipients remains about one ciphertext copy plus envelopes; ten full downloads produce about 1,000 MB of outbound file traffic. Live Base64 adds roughly one-third to payload bytes before JSON/TLS overhead.

If long-lived file volume grows, introduce a private object-store adapter such as R2/S3 and keep authorization on the backend. Object-store integration is not present in 2.1. Do not mount an object-store filesystem as a SQLite database without verifying its locking and durability semantics.

## Primary references checked

- HF Docker support: https://huggingface.co/docs/hub/spaces-sdks-docker
- HF compute creation requirements: https://huggingface.co/docs/hub/spaces-overview
- HF ephemeral disk / attached storage: https://huggingface.co/docs/hub/spaces-storage
- HF sleep behavior: https://huggingface.co/docs/hub/spaces-gpus
- Caddy automatic HTTPS: https://caddyserver.com/docs/automatic-https
- Cloudflare temporary demo tunnels: https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/
- DigitalOcean reference plan: https://www.digitalocean.com/pricing/droplets (2 GiB / 1 vCPU / 50 GiB SSD / 2,000 GiB transfer, $12/month listed; domain, backup and taxes separate).
- R2 reference pricing: https://developers.cloudflare.com/r2/pricing/ (Standard $0.015/GB-month, 10 GB-month free allowance, operation charges and rounding apply; direct R2 egress free).
