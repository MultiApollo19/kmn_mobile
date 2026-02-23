import { constants, createDecipheriv, createPrivateKey, privateDecrypt } from 'node:crypto';

type EncryptedRequestPayload = {
  alg: 'RSA-OAEP-256/AES-256-GCM';
  key: string;
  iv: string;
  data: string;
};

const normalizePem = (value: string) => value.replace(/\\n/g, '\n').trim();

const isEncryptedRequestPayload = (value: unknown): value is EncryptedRequestPayload => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const payload = value as Partial<EncryptedRequestPayload>;
  return (
    payload.alg === 'RSA-OAEP-256/AES-256-GCM' &&
    typeof payload.key === 'string' &&
    typeof payload.iv === 'string' &&
    typeof payload.data === 'string'
  );
};

export function decryptRequestPayload<T>(value: unknown): T {
  if (!isEncryptedRequestPayload(value)) {
    throw new Error('Payload musi być zaszyfrowany');
  }

  const privateKeyPem = process.env.REQUEST_ENCRYPTION_PRIVATE_KEY;
  if (!privateKeyPem) {
    throw new Error('Brak REQUEST_ENCRYPTION_PRIVATE_KEY');
  }

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
  return JSON.parse(plaintext.toString('utf8')) as T;
}
