import { NextResponse } from 'next/server';
import { isPinUnique } from '@/src/lib/checkPinUnique';

export const runtime = 'nodejs';

type CheckPinBody = {
  pinHash: string;
  excludeEmployeeId?: number | null;
};

export async function POST(request: Request) {
  try {
    const { pinHash, excludeEmployeeId } = await request.json() as CheckPinBody;

    if (!pinHash || !/^[a-f0-9]{64}$/i.test(pinHash)) {
      return NextResponse.json({ error: 'Nieprawidłowy PIN' }, { status: 400 });
    }

    // Sprawdzamy czy dany PIN (jego hash SHA-256) jest unikalny w bazie
    const unique = await isPinUnique(pinHash, excludeEmployeeId);

    // Zwracamy wynik na frontend (zajęty -> !unique)
    return NextResponse.json({ isTaken: !unique });
  } catch (error: unknown) {
    console.error('Check PIN API Error:', error);
    return NextResponse.json({ error: 'Wystąpił błąd serwera podczas sprawdzania PINu' }, { status: 500 });
  }
}
