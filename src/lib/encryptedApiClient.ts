import { encryptRequestPayload } from '@/src/lib/requestEncryption.client';

export async function encryptedPost<TResponse = unknown>(
  url: string,
  payload: unknown,
  headers?: Record<string, string>
): Promise<TResponse> {
  const encryptedBody = await encryptRequestPayload(payload);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-payload-encrypted': '1',
      ...(headers || {}),
    },
    body: JSON.stringify(encryptedBody),
  });

  const data = await response.json();
  if (!response.ok) {
    const errorMessage =
      typeof data?.error === 'string'
        ? data.error
        : typeof data?.message === 'string'
          ? data.message
          : 'Wystąpił błąd żądania';
    throw new Error(errorMessage);
  }

  return data as TResponse;
}
