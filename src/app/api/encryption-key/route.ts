import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

// Uwaga: Cache kluczy szyfrowania w pamięci jest disabled
// W produkcji: Redis lub baza danych z TTL
// const keyCache = new Map<string, { key: string; expiresAt: number }>();

/**
 * Generuj/zwróć klucz AES-256 dla sesji
 * W tym prostym podejściu: zwróć statyczny klucz z env
 * W produkcji: per-session keys w Redis
 */
function getEncryptionKey() {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY not configured');
  }
  const expiresAt = Date.now() + 60 * 60 * 1000; // 1 godzinna
  return { key, expiresAt };
}

/**
 * GET /api/encryption-key
 * Zwraca nowy klucz AES-256 dla klienta
 */
export async function GET() {
  try {
    const { key, expiresAt } = getEncryptionKey();

    return NextResponse.json(
      {
        key,
        keyId: 'aes-256-simple-v1',
        expiresAt,
      },
      {
        headers: {
          // Cache-Control dla HTTP caching (ale klucz ma TTL w payload)
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    );
  } catch (error) {
    console.error('GET /api/encryption-key error:', error);
    return NextResponse.json(
      { error: 'Failed to generate encryption key' },
      { status: 500 }
    );
  }
}

export async function POST() {
  return NextResponse.json(
    { message: 'Use GET to fetch encryption key' },
    { status: 405 }
  );
}
