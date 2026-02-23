/**
 * Simple Symmetric Encryption Module
 *
 * Strategia:
 * 1. Serwer wysyła nowy klucz AES-256 w response do `/api/encryption-key` (HTTPS zapora transportu)
 * 2. Klient cachuje klucz w sessionStorage (podatny tylko przy XSS, ale wtedy serwer też sie sypie)
 * 3. Klient szyfruje payload AES-256-GCM + losowy IV (12 bajt)
 * 4. Serwer deszyfruje tym samym kluczem
 *
 * Zalety:
 * - Brak RSA w przeglądarce (brak WebCrypto complexity)
 * - Szyfrowanie symetryczne (szybkie)
 * - TLS chroni klucz w transporcie
 * - Anti-replay via timestapm + requestId
 *
 * Struktura payload:
 * {
 *   v: 1,
 *   ts: timestamp,
 *   requestId: random-16-bytes-base64url,
 *   iv: random-12-bytes-base64,
 *   ciphertext: AES-256-GCM-with-authTag-base64
 * }
 */

export type SimpleEncryptedPayload = {
  v: 1;
  ts: number;
  requestId: string;
  iv: string;
  ciphertext: string;
};

export type EncryptionKeyResponse = {
  key: string;
  keyId: string;
  expiresAt: number;
};

/**
 * Client: pobiera nowy klucz szyfrowania z serwera
 * Klucz jest cachowany w sessionStorage i ważny przez określony czas.
 */
export async function getEncryptionKey(): Promise<string> {
  const cached = sessionStorage.getItem('encryption_key_cache');
  if (cached) {
    try {
      const parsed = JSON.parse(cached) as EncryptionKeyResponse;
      if (parsed.expiresAt > Date.now()) {
        return parsed.key;
      }
    } catch {
      // cache is corrupted, fetch new key
    }
  }

  const response = await fetch('/api/encryption-key', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch encryption key: ${response.statusText}`);
  }

  const data = (await response.json()) as EncryptionKeyResponse;
  sessionStorage.setItem('encryption_key_cache', JSON.stringify(data));
  return data.key;
}

/**
 * Konwertuj base64 -> Uint8Array
 */
function base64ToBuffer(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Konwertuj Uint8Array -> base64
 */
function bufferToBase64(buf: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < buf.length; i++) {
    binary += String.fromCharCode(buf[i]);
  }
  return btoa(binary);
}

/**
 * Konwertuj Uint8Array -> base64url (bez padding, dla requestId)
 */
function bufferToBase64Url(buf: Uint8Array): string {
  return bufferToBase64(buf)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

/**
 * Client: Szyfruj payload za pomocą klucza AES-256
 */
export async function encryptSimple(payload: unknown): Promise<SimpleEncryptedPayload> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Web Crypto API is not available');
  }

  const keyBase64 = await getEncryptionKey();
  const keyBuffer = base64ToBuffer(keyBase64);

  // Importuj klucz AES-256
  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  // Generuj losowy IV (12 bajtów dla GCM)
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));

  // Szyfruj payload
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const ciphertext = await globalThis.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
      tagLength: 128,
    },
    key,
    plaintext
  );

  return {
    v: 1,
    ts: Date.now(),
    requestId: bufferToBase64Url(globalThis.crypto.getRandomValues(new Uint8Array(16))),
    iv: bufferToBase64(iv),
    ciphertext: bufferToBase64(new Uint8Array(ciphertext)),
  };
}

/**
 * Server: Deszyfruj payload
 */
export function decryptSimple(keyBase64: string, payload: SimpleEncryptedPayload): unknown {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const crypto = require('crypto') as typeof import('crypto');

  // Walidacja payload
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid payload structure');
  }

  if (payload.v !== 1) {
    throw new Error('Invalid payload version');
  }

  if (typeof payload.ts !== 'number' || !Number.isFinite(payload.ts)) {
    throw new Error('Invalid timestamp');
  }

  // Anti-replay: sprawdź czy payload nie jest stary
  const now = Date.now();
  const maxAge = 5 * 60 * 1000; // 5 minut
  if (Math.abs(now - payload.ts) > maxAge) {
    throw new Error('Payload expired or has invalid timestamp');
  }

  if (!payload.requestId || typeof payload.requestId !== 'string') {
    throw new Error('Missing requestId');
  }

  // Zamiana base64 -> buffer
  const keyBuffer = Buffer.from(keyBase64, 'base64');
  if (keyBuffer.length !== 32) {
    throw new Error('Invalid key length (expected 32 bytes for AES-256)');
  }

  const iv = Buffer.from(payload.iv, 'base64');
  if (iv.length !== 12) {
    throw new Error('Invalid IV length');
  }

  const ciphertextBuffer = Buffer.from(payload.ciphertext, 'base64');
  if (ciphertextBuffer.length <= 16) {
    throw new Error('Invalid ciphertext length');
  }

  // GCM auth tag jest ostatnie 16 bajtów
  const authTag = ciphertextBuffer.subarray(ciphertextBuffer.length - 16);
  const ciphertext = ciphertextBuffer.subarray(0, ciphertextBuffer.length - 16);

  // Deszyfruj
  const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, iv);
  decipher.setAuthTag(authTag);

  try {
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return JSON.parse(plaintext.toString('utf8'));
  } catch (err) {
    throw new Error(`Decryption failed: ${err instanceof Error ? err.message : 'unknown error'}`);
  }
}
