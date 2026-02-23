export type EncryptedRequestPayload = {
  v: 2;
  alg: 'RSA-OAEP-256/AES-256-GCM';
  kid: string;
  ts: number;
  requestId: string;
  context: {
    method: 'POST';
    path: string;
  };
  wrappedKey: string;
  iv: string;
  ciphertext: string;
};

type RequestEncryptionContext = {
  method: 'POST';
  path: string;
};

type EncryptedEnvelope = {
  payload: unknown;
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

const toBase64Url = (bytes: Uint8Array): string => {
  const base64 = arrayBufferToBase64(bytes.buffer);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const normalizePath = (path: string): string => {
  const trimmed = path.trim();
  if (!trimmed.startsWith('/')) {
    return `/${trimmed}`;
  }
  return trimmed;
};

const buildAad = (
  payload: Pick<EncryptedRequestPayload, 'v' | 'alg' | 'kid' | 'ts' | 'requestId' | 'context'>
): Uint8Array => {
  return new TextEncoder().encode(
    JSON.stringify({
      v: payload.v,
      alg: payload.alg,
      kid: payload.kid,
      ts: payload.ts,
      requestId: payload.requestId,
      context: payload.context,
    })
  );
};

export async function encryptRequestPayload(
  payload: unknown,
  context: RequestEncryptionContext
): Promise<EncryptedRequestPayload> {
  const publicKeyPem = process.env.NEXT_PUBLIC_REQUEST_ENCRYPTION_PUBLIC_KEY;
  const keyId = process.env.NEXT_PUBLIC_REQUEST_ENCRYPTION_KEY_ID || 'v1';

  if (!publicKeyPem) {
    throw new Error('Brak NEXT_PUBLIC_REQUEST_ENCRYPTION_PUBLIC_KEY');
  }

  if (!globalThis.isSecureContext) {
    const origin = globalThis.location?.origin || 'unknown-origin';
    throw new Error(
      `Web Crypto API wymaga secure context (HTTPS lub localhost). Aktualny origin: ${origin}`
    );
  }

  if (!globalThis.crypto) {
    throw new Error('Przeglądarka nie udostępnia window.crypto');
  }

  if (!globalThis.crypto?.subtle) {
    throw new Error('Przeglądarka nie udostępnia SubtleCrypto (window.crypto.subtle)');
  }

  const normalizedContext: RequestEncryptionContext = {
    method: 'POST',
    path: normalizePath(context.path),
  };

  const metadata: Pick<EncryptedRequestPayload, 'v' | 'alg' | 'kid' | 'ts' | 'requestId' | 'context'> = {
    v: 2,
    alg: 'RSA-OAEP-256/AES-256-GCM',
    kid: keyId,
    ts: Date.now(),
    requestId: toBase64Url(globalThis.crypto.getRandomValues(new Uint8Array(16))),
    context: normalizedContext,
  };

  const aesKey = await globalThis.crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt']
  );

  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(
    JSON.stringify({ payload } satisfies EncryptedEnvelope)
  );

  const ciphertext = await globalThis.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
      additionalData: buildAad(metadata),
      tagLength: 128,
    },
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
  const wrappedKey = await globalThis.crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    rsaKey,
    rawAesKey
  );

  return {
    ...metadata,
    wrappedKey: arrayBufferToBase64(wrappedKey),
    iv: arrayBufferToBase64(iv.buffer),
    ciphertext: arrayBufferToBase64(ciphertext),
  };
}
