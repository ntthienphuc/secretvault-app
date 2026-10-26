# SecretVault · Dual-mode secure file sharing

SecretVault is a local academic MVP for the topic **“SecretVault: A Dual-Mode Secure File Storage and Sharing System Using Public-Key Cryptography, Diffie–Hellman and ElGamal.”** The browser encrypts file contents before sending them to the Python relay.

## Run it

Use Python 3.9 or newer from this folder:

```powershell
py -3.9 app.py
```

Then open [http://127.0.0.1:8765](http://127.0.0.1:8765).

The server uses only Python’s standard library. It creates `secretvault.db` on first start and serves the static browser application from `public/`.

## Demonstration flow

1. Start as **Alice Nguyen**. The first run creates three encrypted demo files and browser-local identity material.
2. Open **Crypto Inspector** on a file to see the AES-GCM IV, SHA-256 ciphertext hash, owner, and relay visibility.
3. Use the share button, select Bob, and create an **ElGamal Hybrid** offline envelope. Switch the profile selector to Bob and decrypt the shared file locally.
4. Open a second browser tab. Leave one tab as Alice and switch the other to Bob. In **Live Transfer**, Alice selects a file, Bob accepts the offer, and the two tabs complete an ephemeral P-256 ECDH handshake before the AES-GCM payload is relayed.

## Architecture

- `app.py` — Python `ThreadingHTTPServer`, JSON API, SQLite persistence, and live-transfer event relay by polling.
- `public/src/crypto.js` — Web Crypto AES-GCM, Ed25519 identity with a P-256 signing fallback, P-256 ECDH, and the academic ElGamal hybrid envelope.
- `public/src/app.js` — dashboard, vault, contacts, live session state, browser-local key storage, downloads, and Crypto Inspector.
- `public/styles.css` — responsive dark workspace UI.

Plaintext files and private keys stay in the browser. SQLite stores ciphertext, IVs, hashes, public keys, encrypted local-key wraps, and recipient key envelopes. The Python relay is intentionally unauthenticated because this is a classroom MVP, so it should only be run on the local machine or a controlled lab network.

## Scope and security boundary

The file payload uses AES-256-GCM. Offline sharing uses an ElGamal-inspired finite-field hybrid: the file key is wrapped with an ElGamal shared secret and AES-GCM. This demonstrates the course algorithm boundary; it is not a replacement for HPKE or a production cryptographic library. Live transfer uses browser P-256 ECDH and AES-GCM over Python polling endpoints instead of a production WebSocket/WebRTC transport.

The MVP deliberately leaves account authentication, recovery, revocation, resumable chunk uploads, multi-device key rotation, and production authorization for a later phase. The UI labels these limits so the demo is safe to present as an academic prototype.
