export interface EncryptionResult {
  encrypted: ArrayBuffer;
  rawKey: Uint8Array;
  iv: Uint8Array;
  keyHash: Uint8Array;
}

export async function encryptModel(fileBuffer: ArrayBuffer): Promise<EncryptionResult> {
  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    fileBuffer
  );
  const rawKey = await crypto.subtle.exportKey("raw", key);
  const keyHash = await crypto.subtle.digest("SHA-256", rawKey);
  return {
    encrypted,
    rawKey: new Uint8Array(rawKey),
    iv,
    keyHash: new Uint8Array(keyHash),
  };
}

export async function decryptModel(
  encryptedBuffer: ArrayBuffer,
  rawKey: Uint8Array,
  iv: Uint8Array
): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey(
    "raw",
    rawKey.buffer as ArrayBuffer,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );
  return crypto.subtle.decrypt({ name: "AES-GCM", iv: iv.buffer as ArrayBuffer }, key, encryptedBuffer);
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function uint8ArrayToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
