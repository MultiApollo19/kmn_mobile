export type EncryptedRequestPayload = {
  alg: 'RSA-OAEP-256/AES-256-GCM';
  key: string;
  iv: string;
  data: string;
};

const normalizePem = (value: string) => value.replace(/\\n/g, '\n').trim();

const pemToArrayBuffer = (pem: string): ArrayBuffer => {
  const normalized = normalizePem(pem);
  const base64 = normalized
    .replace('-----BEGIN PUBLIC KEY-----', '')
    .replace('-----END PUBLIC KEY-----', '')
    .replace(/\s+/g, '');

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
};

const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary);
};

export async function encryptRequestPayload(payload: unknown): Promise<EncryptedRequestPayload> {
  const publicKeyPem = process.env.NEXT_PUBLIC_REQUEST_ENCRYPTION_PUBLIC_KEY;

  if (!publicKeyPem) {
    throw new Error('Brak NEXT_PUBLIC_REQUEST_ENCRYPTION_PUBLIC_KEY');
  }

  if (!globalThis.crypto?.subtle) {
    throw new Error('Web Crypto API jest niedostępne w przeglądarce');
  }

  const aesKey = await globalThis.crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt']
  );

  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const ciphertext = await globalThis.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    plaintext
  );

  const rsaKey = await globalThis.crypto.subtle.importKey(
    'spki',
    pemToArrayBuffer(publicKeyPem),
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt']
  );

  const rawAesKey = await globalThis.crypto.subtle.exportKey('raw', aesKey);
  const encryptedAesKey = await globalThis.crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    rsaKey,
    rawAesKey
  );

  return {
    alg: 'RSA-OAEP-256/AES-256-GCM',
    key: arrayBufferToBase64(encryptedAesKey),
    iv: arrayBufferToBase64(iv.buffer),
    data: arrayBufferToBase64(ciphertext),
  };
}
