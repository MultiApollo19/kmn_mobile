# Copilot / AI agent instructions — kmn_mobile

Krótka, praktyczna instrukcja dla AI agentów pracujących nad tym repozytorium.

## 1) Cel i architektura
- Next.js 16 (App Router) + TypeScript w `src/app` — domyślnie komponenty serwerowe, klientowe oznaczone `'use client'`.
- UI + dashboard do rejestracji i zarządzania wizytami; dane z Supabase i lokalny cache UI w `localStorage`.

## 2) Integracje i punkty wejścia
- Supabase client: `src/lib/supabase.ts` (env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
- Auth kontekst: `src/context/AuthContext.tsx` + hook `src/hooks/useAuth.ts`; PIN login używa RPC `verify_employee_pin`.
- `src/app/layout.tsx` montuje `AuthProvider` na całej aplikacji.
- API routes: `src/app/api/*/route.ts` (App Router handlers). Przykład: `src/app/api/cron/auto-exit/route.ts` z opcjonalnym nagłówkiem `Authorization: Bearer $CRON_SECRET`.
- Klientowe komponenty w `src/components/*` często mają sufiks `Client` (np. `AdminDashboardClient.tsx`).

## 3) Wzorce i dataflow (konkretne przykłady)
- PIN login: `loginWithPin` -> `supabase.rpc('verify_employee_pin', { p_pin: pin })`, zapis do `localStorage` jako `kmn_auth` (format `{ user, expiresAt }`).
- Sesje: Supabase session sprawdzana, ale UI state opiera sie na `localStorage`; przy wylogowaniu `supabase.auth.signOut()` i czyszczenie cache.
- Dashboard: `AdminDashboardClient.tsx` pobiera aktywne wizyty i statystyki przez `supabase.from(...).select(...)`.

## 4) Skrypty
- `npm run dev`, `npm run build`, `npm start`, `npm run lint` (patrz `package.json`).

## 5) Konwencje projektu
- Logika serwera: `src/app/api/<path>/route.ts`. Interaktywne komponenty: `'use client'` + opcjonalny sufiks `Client`.
- Hooki i konteksty w `src/hooks` i `src/context`.
- Tailwind + globalny CSS w `src/app/globals.css`.

## 6) Migracje i RLS (krytyczne)
- Struktura migracji: `migrations/00_schema.sql`, `01_seed.sql`, `02_functions.sql`, `03_policies.sql`, `04_triggers.sql`.
- Polityki RLS i uprawnienia sa w `migrations/03_policies.sql`.

## 7) Szybkie wskazniki do debugowania
- Jesli RPC lub inserty zwracaja blad, najpierw sprawdz RLS i uprawnienia (mozliwy wymagany `auth.uid()`).
- Do testow UI auth mozna ustawic `localStorage.kmn_auth` lub uzyc realnych env Supabase.
