import { compare } from 'bcryptjs';
import { pgQuery } from '@/src/lib/postgres';

/**
 * Sprawdza czy podany PIN (w formie zhashowanej po stronie klienta SHA-256)
 * jest unikalny w bazie danych.
 * 
 * @param pinHash - Hash PIN-u wygenerowany na kliencie (SHA-256)
 * @param excludeEmployeeId - ID pracownika (opcjonalne, przy edycji pomijamy jego własne hasło)
 * @returns true jeśli PIN jest unikalny, false jeśli jest zajęty
 */
export async function isPinUnique(pinHash: string, excludeEmployeeId?: number | null): Promise<boolean> {
  // Pobieramy wszystkie zapisane hasła
  const query = excludeEmployeeId
    ? `SELECT id, password FROM public.employees WHERE password IS NOT NULL AND id != $1`
    : `SELECT id, password FROM public.employees WHERE password IS NOT NULL`;
  
  const params = excludeEmployeeId ? [excludeEmployeeId] : [];
  const result = await pgQuery<{ id: number, password: string }>(query, params);

  // Sprawdzamy hasła jedno po drugim korzystając z bcrypt
  for (const row of result.rows) {
    try {
      // pinHash (SHA-256) pełni tutaj rolę "hasła plaintext" dla bcrypt
      const isMatch = await compare(pinHash, row.password);
      if (isMatch) {
        return false; // Znaleziono pasujący PIN, nie jest unikalny
      }
    } catch (err) {
      // Ignorujemy błędy dla nieprawidłowych hashy w bazie i lecimy dalej
      console.warn(`Błąd bcrypt.compare dla pracownika ID: ${row.id}`);
    }
  }

  return true; // Przeszliśmy wszystkie rekordy, PIN jest unikalny
}
