import { sha256 } from 'js-sha256';

const bytesToHex = (bytes: Uint8Array): string =>
  Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

export async function hashPinClient(pin: string): Promise<string> {
  const normalizedPin = pin.trim();

  if (!normalizedPin) {
    throw new Error('PIN nie może być pusty');
  }

  if (!/^\d{4}$/.test(normalizedPin)) {
    throw new Error('PIN musi mieć dokładnie 4 cyfry');
  }

  if (!globalThis.crypto?.subtle) {
    return sha256(normalizedPin);
  }

  const data = new TextEncoder().encode(normalizedPin);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
  return bytesToHex(new Uint8Array(digest));
}
