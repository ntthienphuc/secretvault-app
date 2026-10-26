const subtle = globalThis.crypto.subtle;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const ELGAMAL_P = BigInt("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F");
export const ELGAMAL_G = 2n;
export const ELGAMAL_GROUP_LABEL = "256-bit finite-field demo group";

export function randomBytes(length) {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

export function randomId(prefix = "id") {
  const suffix = Array.from(randomBytes(8), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${prefix}_${suffix}`;
}

export function bytesToBase64(bytes) {
  const chunkSize = 0x8000;
  let binary = "";
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

export function base64ToBytes(value) {
  const binary = atob(value || "");
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function utf8Bytes(value) {
  return encoder.encode(value);
}

export function bytesToUtf8(bytes) {
  return decoder.decode(bytes);
}

export function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function hexToBytes(value) {
  const normalized = value.replace(/^0x/i, "").padStart(value.length % 2 === 0 ? value.length : value.length + 1, "0");
  const bytes = new Uint8Array(normalized.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(normalized.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function concatBytes(...parts) {
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

export async function sha256Bytes(value) {
  const bytes = value instanceof Uint8Array ? value : utf8Bytes(String(value));
  return new Uint8Array(await subtle.digest("SHA-256", bytes));
}

export async function sha256Hex(value) {
  return bytesToHex(await sha256Bytes(value));
}

async function importAesKey(rawKey, usages = ["encrypt", "decrypt"]) {
  if (rawKey instanceof CryptoKey) {
    return rawKey;
  }
  return subtle.importKey("raw", rawKey, { name: "AES-GCM" }, false, usages);
}

export async function aesEncrypt(rawKey, plaintext, additionalData = null) {
  const iv = randomBytes(12);
  const key = await importAesKey(rawKey);
  const params = { name: "AES-GCM", iv };
  if (additionalData) {
    params.additionalData = additionalData;
  }
  const encrypted = await subtle.encrypt(params, key, plaintext);
  return { iv: bytesToBase64(iv), data: bytesToBase64(new Uint8Array(encrypted)) };
}

export async function aesDecrypt(rawKey, envelope, additionalData = null) {
  const key = await importAesKey(rawKey);
  const params = { name: "AES-GCM", iv: base64ToBytes(envelope.iv) };
  if (additionalData) {
    params.additionalData = additionalData;
  }
  const decrypted = await subtle.decrypt(params, key, base64ToBytes(envelope.data));
  return new Uint8Array(decrypted);
}

function bytesToBigInt(bytes) {
  return BigInt(`0x${bytesToHex(bytes)}`);
}

function bigIntToBytes(value, length = 32) {
  const normalized = value.toString(16).padStart(length * 2, "0");
  return hexToBytes(normalized.slice(-length * 2));
}

function modPow(base, exponent, modulus) {
  let result = 1n;
  let current = base % modulus;
  let remaining = exponent;
  while (remaining > 0n) {
    if (remaining & 1n) {
      result = (result * current) % modulus;
    }
    current = (current * current) % modulus;
    remaining >>= 1n;
  }
  return result;
}

function randomElgamalScalar() {
  return (bytesToBigInt(randomBytes(32)) % (ELGAMAL_P - 3n)) + 2n;
}

async function deriveElgamalWrapKey(sharedSecret) {
  return sha256Bytes(
    concatBytes(bigIntToBytes(sharedSecret), utf8Bytes("SecretVault-ElGamal-Hybrid-v1")),
  );
}

export async function generateElgamalIdentity() {
  const privateValue = randomElgamalScalar();
  const publicValue = modPow(ELGAMAL_G, privateValue, ELGAMAL_P);
  return {
    privateKey: privateValue.toString(16),
    publicKey: publicValue.toString(16).padStart(64, "0"),
  };
}

export async function elgamalWrapKey(fileKey, recipientPublicKey) {
  const recipient = BigInt(`0x${recipientPublicKey}`);
  const ephemeralPrivate = randomElgamalScalar();
  const c1 = modPow(ELGAMAL_G, ephemeralPrivate, ELGAMAL_P);
  const sharedSecret = modPow(recipient, ephemeralPrivate, ELGAMAL_P);
  const wrapKey = await deriveElgamalWrapKey(sharedSecret);
  const wrapped = await aesEncrypt(wrapKey, fileKey);
  return {
    scheme: "ElGamal-Hybrid",
    group: ELGAMAL_GROUP_LABEL,
    c1: c1.toString(16).padStart(64, "0"),
    iv: wrapped.iv,
    wrappedKey: wrapped.data,
  };
}

export async function elgamalUnwrapKey(envelope, privateKey) {
  const c1 = BigInt(`0x${envelope.c1}`);
  const privateValue = BigInt(`0x${privateKey}`);
  const sharedSecret = modPow(c1, privateValue, ELGAMAL_P);
  const wrapKey = await deriveElgamalWrapKey(sharedSecret);
  return aesDecrypt(wrapKey, { iv: envelope.iv, data: envelope.wrappedKey });
}

export async function generateSigningIdentity() {
  try {
    const keyPair = await subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
    return {
      algorithm: "Ed25519",
      publicJwk: await subtle.exportKey("jwk", keyPair.publicKey),
      privateJwk: await subtle.exportKey("jwk", keyPair.privateKey),
    };
  } catch (error) {
    const keyPair = await subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["sign", "verify"],
    );
    return {
      algorithm: "ECDSA-P256-fallback",
      publicJwk: await subtle.exportKey("jwk", keyPair.publicKey),
      privateJwk: await subtle.exportKey("jwk", keyPair.privateKey),
    };
  }
}

export async function generateIdentityMaterial() {
  const elgamal = await generateElgamalIdentity();
  const signing = await generateSigningIdentity();
  const fingerprint = (await sha256Hex(JSON.stringify({ signing: signing.publicJwk, elgamal: elgamal.publicKey }))).slice(0, 24);
  return { elgamal, signing, fingerprint };
}

export async function generateDhKeyPair() {
  return subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey"]);
}

export async function exportDhPublicKey(publicKey) {
  return subtle.exportKey("jwk", publicKey);
}

export async function importDhPublicKey(publicJwk) {
  return subtle.importKey("jwk", publicJwk, { name: "ECDH", namedCurve: "P-256" }, true, []);
}

export async function deriveDhSessionKey(privateKey, publicKey) {
  return subtle.deriveKey(
    { name: "ECDH", public: publicKey },
    privateKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptWithCryptoKey(key, plaintext) {
  return aesEncrypt(key, plaintext);
}

export async function decryptWithCryptoKey(key, envelope) {
  return aesDecrypt(key, envelope);
}

export async function dhFingerprint(publicJwk) {
  return (await sha256Hex(JSON.stringify(publicJwk))).slice(0, 16);
}

export function keyEnvelopePreview(value) {
  const normalized = String(value || "");
  if (normalized.length <= 18) {
    return `0x${normalized}`;
  }
  return `0x${normalized.slice(0, 10)}…${normalized.slice(-8)}`;
}
