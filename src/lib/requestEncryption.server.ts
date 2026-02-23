import { constants, createDecipheriv, createPrivateKey, privateDecrypt } from 'node:crypto';

type EncryptedRequestPayload = {
  alg: 'RSA-OAEP-256/AES-256-GCM';
  kid: string;
  key: string;
  iv: string;
  data: string;
};

type DecryptedEnvelope = {
  v: 1;
  ts: number;
  nonce: string;
  payload: unknown;
};

const normalizePem = (value: string) => value.replace(/\\n/g, '\n').trim();

const getReplayWindowMs = () => {
  const configured = Number.parseInt(process.env.REQUEST_ENCRYPTION_REPLAY_WINDOW_MS || '', 10);
  if (Number.isNaN(configured) || configured <= 0) {
    return 300000;
  }
  return configured;
};

const getPrivateKeyMap = (): Record<string, string> | null => {
  const raw = process.env.REQUEST_ENCRYPTION_PRIVATE_KEYS;
  if (!raw) {
    return null;
  }

  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('REQUEST_ENCRYPTION_PRIVATE_KEYS ma nieprawidłowy format');
  }

  const map = parsed as Record<string, unknown>;
  const result: Record<string, string> = {};
  for (const [kid, pem] of Object.entries(map)) {
    if (typeof pem === 'string' && pem.trim().length > 0) {
      result[kid] = pem;
    }
  }

  if (!Object.keys(result).length) {
    throw new Error('REQUEST_ENCRYPTION_PRIVATE_KEYS nie zawiera poprawnych kluczy');
  }

  return result;
};

const getPrivateKeyPem = (kid: string): string => {
  const keyMap = getPrivateKeyMap();
  if (keyMap) {
    const byKid = keyMap[kid];
    if (byKid) {
      return byKid;
    }

    const activeKid = process.env.REQUEST_ENCRYPTION_ACTIVE_KID;
    if (activeKid && keyMap[activeKid]) {
      return keyMap[activeKid];
    }

    throw new Error('Brak klucza prywatnego dla podanego kid');
  }

  const single = process.env.REQUEST_ENCRYPTION_PRIVATE_KEY;
  if (!single) {
    throw new Error('Brak REQUEST_ENCRYPTION_PRIVATE_KEY');
  }

  return single;
};

const isNonceValid = (value: string): boolean => {
  return /^[A-Za-z0-9+/]+={0,2}$/.test(value) && value.length >= 20;
};

const isDecryptedEnvelope = (value: unknown): value is DecryptedEnvelope => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const payload = value as Partial<DecryptedEnvelope>;
  return (
    payload.v === 1 &&
    typeof payload.ts === 'number' &&
    Number.isFinite(payload.ts) &&
    typeof payload.nonce === 'string' &&
    isNonceValid(payload.nonce) &&
    'payload' in payload
  );
};

const getReplayCache = (): Map<string, number> => {
  const state = globalThis as typeof globalThis & {
    __kmnReplayCache?: Map<string, number>;
    __kmnReplayCleanupAt?: number;
  };

  if (!state.__kmnReplayCache) {
    state.__kmnReplayCache = new Map<string, number>();
  }

  const now = Date.now();
  const cleanupAt = state.__kmnReplayCleanupAt || 0;
  if (now >= cleanupAt) {
    for (const [cacheKey, expiresAt] of state.__kmnReplayCache) {
      if (expiresAt <= now) {
        state.__kmnReplayCache.delete(cacheKey);
      }
    }
    state.__kmnReplayCleanupAt = now + 60000;
  }

  return state.__kmnReplayCache;
};

const assertFreshEnvelope = (envelope: DecryptedEnvelope, kid: string) => {
  const now = Date.now();
  const replayWindowMs = getReplayWindowMs();
  const tsDiff = Math.abs(now - envelope.ts);
  if (tsDiff > replayWindowMs) {
    throw new Error('Payload wygasł lub ma nieprawidłowy znacznik czasu');
  }

  const cache = getReplayCache();
  const cacheKey = `${kid}:${envelope.nonce}`;
  const existing = cache.get(cacheKey);
  if (typeof existing === 'number' && existing > now) {
    throw new Error('Wykryto powtórzone żądanie (replay)');
  }

  cache.set(cacheKey, now + replayWindowMs);
};

const isEncryptedRequestPayload = (value: unknown): value is EncryptedRequestPayload => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const payload = value as Partial<EncryptedRequestPayload>;
  return (
    payload.alg === 'RSA-OAEP-256/AES-256-GCM' &&
    typeof payload.kid === 'string' &&
    typeof payload.key === 'string' &&
    typeof payload.iv === 'string' &&
    typeof payload.data === 'string'
  );
};

export function decryptRequestPayload<T>(value: unknown): T {
  if (!isEncryptedRequestPayload(value)) {
    throw new Error('Payload musi być zaszyfrowany');
  }

  const privateKeyPem = getPrivateKeyPem(value.kid);

  const privateKey = createPrivateKey(normalizePem(privateKeyPem));

  const encryptedAesKey = Buffer.from(value.key, 'base64');
  const aesKey = privateDecrypt(
    {
      key: privateKey,
      padding: constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    encryptedAesKey
  );

  const iv = Buffer.from(value.iv, 'base64');
  const fullCiphertext = Buffer.from(value.data, 'base64');

  if (iv.length !== 12) {
    throw new Error('Nieprawidłowy IV');
  }

  if (fullCiphertext.length <= 16) {
    throw new Error('Nieprawidłowy szyfrogram');
  }

  const authTag = fullCiphertext.subarray(fullCiphertext.length - 16);
  const ciphertext = fullCiphertext.subarray(0, fullCiphertext.length - 16);

  const decipher = createDecipheriv('aes-256-gcm', aesKey, iv);
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  const decrypted = JSON.parse(plaintext.toString('utf8')) as unknown;
  if (!isDecryptedEnvelope(decrypted)) {
    throw new Error('Nieprawidłowa struktura odszyfrowanego payloadu');
  }

  assertFreshEnvelope(decrypted, value.kid);
  return decrypted.payload as T;
}
