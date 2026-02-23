import { encryptSimple } from '@/src/lib/simpleEncryption';

/**
 * Helper do wysłania zaszyfrowanego POST requesta z kiosku
 * Proste szyfrowanie AES-256-GCM
 */
export async function encryptedPost<TResponse = unknown>(
  url: string,
  payload: unknown,
  headers?: Record<string, string>
): Promise<TResponse> {
  const encrypted = await encryptSimple(payload);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Encrypted': '1',
      'X-Encryption-Version': '1',
      ...(headers || {}),
    },
    body: JSON.stringify(encrypted),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorMessage =
      typeof data?.error === 'string'
        ? data.error
        : typeof data?.message === 'string'
          ? data.message
          : 'Request failed';
    throw new Error(errorMessage);
  }

  return data as TResponse;
}
