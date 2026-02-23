import { NextRequest, NextResponse } from 'next/server';
import { decryptSimple, SimpleEncryptedPayload } from '@/src/lib/simpleEncryption';

export const runtime = 'nodejs';

/**
 * Template middleware dla deszyfrowania payloadu
 * Użycie:
 *   const body = await decryptPayload<MyPayloadType>(request);
 */
export async function decryptPayload<T = unknown>(request: NextRequest): Promise<T> {
  try {
    const payload = (await request.json()) as SimpleEncryptedPayload;

    // Pobierz klucz z env (w produkcji: baza danych sesji)
    const keyBase64 = process.env.ENCRYPTION_KEY || '';
    if (!keyBase64) {
      throw new Error('ENCRYPTION_KEY not configured on server');
    }

    const decrypted = decryptSimple(keyBase64, payload);
    return decrypted as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Decryption failed';
    throw new Error(message);
  }
}

/**
 * Wrapper do obsługi błędów deszyfrowania w route handler
 */
export function createDecryptedHandler<TPayload, TResponse = unknown>(
  handler: (payload: TPayload, request: NextRequest) => Promise<TResponse>
) {
  return async (request: NextRequest) => {
    try {
      const payload = await decryptPayload<TPayload>(request);
      const result = await handler(payload, request);
      return NextResponse.json(result);
    } catch (error) {
      console.error('Decryption error:', error);
      const message = error instanceof Error ? error.message : 'Request processing failed';
      return NextResponse.json({ error: message }, { status: 400 });
    }
  };
}
