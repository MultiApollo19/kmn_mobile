import { constants, createDecipheriv, createPrivateKey, privateDecrypt } from 'node:crypto';

type EncryptedRequestPayload = {
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

type DecryptedEnvelope = {
  payload: unknown;
};

const MAX_REQUEST_AGE_MS = 300000;
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;

const normalizePem = (value: string) => value.replace(/\\n/g, '\n').trim();

const normalizePath = (path: string): string => {
  const trimmed = path.trim();
  if (!trimmed.startsWith('/')) {
    return `/${trimmed}`;
  }
  return trimmed;
};

const getReplayWindowMs = () => {
  const configured = Number.parseInt(process.env.REQUEST_ENCRYPTION_REPLAY_WINDOW_MS || '', 10);
  if (Number.isNaN(configured) || configured <= 0) {
    return MAX_REQUEST_AGE_MS;
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

const isBase64 = (value: string): boolean => {
  return BASE64_PATTERN.test(value);
};

const isEncryptedRequestPayload = (value: unknown): value is EncryptedRequestPayload => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const payload = value as Partial<EncryptedRequestPayload>;
  return (
    payload.v === 2 &&
    payload.alg === 'RSA-OAEP-256/AES-256-GCM' &&
    typeof payload.kid === 'string' &&
    typeof payload.ts === 'number' &&
    Number.isFinite(payload.ts) &&
    typeof payload.requestId === 'string' &&
    BASE64URL_PATTERN.test(payload.requestId) &&
    !!payload.context &&
    typeof payload.context === 'object' &&
    payload.context.method === 'POST' &&
    typeof payload.context.path === 'string' &&
    payload.context.path.length > 0 &&
    typeof payload.wrappedKey === 'string' &&
    isBase64(payload.wrappedKey) &&
    typeof payload.iv === 'string' &&
    isBase64(payload.iv) &&
    typeof payload.ciphertext === 'string' &&
    isBase64(payload.ciphertext)
  );
};

const isDecryptedEnvelope = (value: unknown): value is DecryptedEnvelope => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  return 'payload' in value;
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

const assertFreshPayload = (payload: EncryptedRequestPayload) => {
  const now = Date.now();
  const replayWindowMs = getReplayWindowMs();

  if (Math.abs(now - payload.ts) > replayWindowMs) {
    throw new Error('Payload wygasł lub ma nieprawidłowy znacznik czasu');
  }

  const cache = getReplayCache();
  const cacheKey = `${payload.kid}:${payload.requestId}`;
  const existing = cache.get(cacheKey);
  if (typeof existing === 'number' && existing > now) {
    throw new Error('Wykryto powtórzone żądanie (replay)');
  }

  cache.set(cacheKey, now + replayWindowMs);
};

const assertRequestContext = (request: Request, payload: EncryptedRequestPayload) => {
  const actualMethod = request.method.toUpperCase();
  if (actualMethod !== payload.context.method) {
    throw new Error('Niezgodna metoda HTTP w kontekście szyfrowania');
  }

  const actualPath = normalizePath(new URL(request.url).pathname);
  const expectedPath = normalizePath(payload.context.path);
  if (actualPath !== expectedPath) {
    throw new Error('Niezgodna ścieżka żądania w kontekście szyfrowania');
  }
};

const buildAad = (
  payload: Pick<EncryptedRequestPayload, 'v' | 'alg' | 'kid' | 'ts' | 'requestId' | 'context'>
): Buffer => {
  return Buffer.from(
    JSON.stringify({
      v: payload.v,
      alg: payload.alg,
      kid: payload.kid,
      ts: payload.ts,
      requestId: payload.requestId,
      context: payload.context,
    }),
    'utf8'
  );
};

export function decryptRequestPayload<T>(request: Request, value: unknown): T {
  if (!isEncryptedRequestPayload(value)) {
    throw new Error('Payload musi być zaszyfrowany i zgodny z protokołem v2');
  }

  assertRequestContext(request, value);
  assertFreshPayload(value);

  const privateKeyPem = getPrivateKeyPem(value.kid);
  const privateKey = createPrivateKey(normalizePem(privateKeyPem));

  const wrappedKey = Buffer.from(value.wrappedKey, 'base64');
  const key = privateDecrypt(
    {
      key: privateKey,
      padding: constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    wrappedKey
  );

  if (key.length !== 32) {
    throw new Error('Nieprawidłowa długość klucza symetrycznego');
  }

  const iv = Buffer.from(value.iv, 'base64');
  if (iv.length !== 12) {
    throw new Error('Nieprawidłowy IV');
  }

  const fullCiphertext = Buffer.from(value.ciphertext, 'base64');
  if (fullCiphertext.length <= 16) {
    throw new Error('Nieprawidłowy szyfrogram');
  }

  const authTag = fullCiphertext.subarray(fullCiphertext.length - 16);
  const ciphertext = fullCiphertext.subarray(0, fullCiphertext.length - 16);

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAAD(buildAad(value));
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  const decrypted = JSON.parse(plaintext.toString('utf8')) as unknown;
  if (!isDecryptedEnvelope(decrypted)) {
    throw new Error('Nieprawidłowa struktura odszyfrowanego payloadu');
  }

  return decrypted.payload as T;
}
