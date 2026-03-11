import { hash } from 'bcryptjs';
import { NextResponse } from 'next/server';
import { pgQuery } from '@/src/lib/postgres';
import { isPinUnique } from '@/src/lib/checkPinUnique';

export const runtime = 'nodejs';

type ManageEmployeeBody = {
  id: number | null;
  name: string;
  department_id: number | null;
  role: 'user' | 'admin' | 'department_admin';
  pinHash: string | null;
};

export async function POST(request: Request) {
  try {
    const body = await request.json() as ManageEmployeeBody;
    const { id, name, department_id, role, pinHash } = body;

    let targetId = id;

    if (id) {
      await pgQuery(
        `UPDATE public.employees SET name = $1, department_id = $2, role = $3 WHERE id = $4`,
        [name, department_id || null, role, id]
      );
    } else {
      const insertResult = await pgQuery<{ id: number }>(
        `INSERT INTO public.employees (name, department_id, role) VALUES ($1, $2, $3) RETURNING id`,
        [name, department_id || null, role]
      );
      targetId = insertResult.rows[0]?.id ?? null;
    }

    if (pinHash) {
      if (!/^[a-f0-9]{64}$/i.test(pinHash)) {
        return NextResponse.json({ error: 'Nieprawidłowy format PIN hash' }, { status: 400 });
      }

      const isUnique = await isPinUnique(pinHash, targetId);
      if (!isUnique) {
        return NextResponse.json({ error: 'Ten PIN jest już przypisany do innego pracownika.' }, { status: 409 });
      }

      const hashedPin = await hash(pinHash, 12);
      await pgQuery(
        `UPDATE public.employees SET password = $1 WHERE id = $2`,
        [hashedPin, targetId]
      );
    }

    return NextResponse.json({ success: true, id: targetId });
  } catch (error: unknown) {
    console.error('API Error:', error);
    const err = error as { message?: string; code?: string; details?: string | null; hint?: string | null };
    return NextResponse.json(
      { error: err?.message || 'Wystąpił błąd serwera', code: err?.code ?? null },
      { status: 500 }
    );
  }
}
