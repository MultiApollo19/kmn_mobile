# Copilot / AI agent instructions — kmn_mobile

Krótka, praktyczna instrukcja dla AI agentów pracujących nad tym repozytorium.

1) Cel projektu
- Next.js (App Router) TypeScript app w `src/app` — serwerowe komponenty domyślnie, klientowe oznaczone `'use client'`.
- UI + dashboard dla rejestracji i zarządzania wizytami; autoryzacja oparta o Supabase + lokalne cache w `localStorage`.

2) Główne punkty wejścia i integracje
- Supabase client: `src/lib/supabase.ts` — używa env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Kontekst autoryzacji: `src/context/AuthContext.tsx` i hook `src/hooks/useAuth.ts` — PIN login wywołuje RPC `verify_employee_pin`.
- App layout: `src/app/layout.tsx` — `AuthProvider` otacza całą aplikację.
- API routes: `src/app/api/*` — serwery/route.ts używają Next.js App Router server handlers (np. `src/app/api/revalidate/route.ts`).
- Client components: `src/components/*` często mają sufiks `Client` i zawierają `'use client'` (np. `src/components/AdminDashboardClient.tsx`).

3) Ważne wzorce i dataflow (konkretne przykłady)
- PIN login: `AuthContext.loginWithPin` wykonuje `supabase.rpc('verify_employee_pin', { p_pin: pin })` — wynik jest zapisywany do `localStorage` jako `kmn_auth` i używany jako UI state.
- Sesja Supabase jest sprawdzana, ale projekt polega na `localStorage` jako cache UI; przy wylogowaniu wykonywane jest `supabase.auth.signOut()` i czyszczenie `localStorage`.
- Logowanie zdarzeń: po zalogowaniu próbuje się insert do tabeli `user_logs` (może być ograniczone przez RLS).
- Widżety dashboardu pobierają szczegółowe zapytania przez `supabase.from(...).select(...)` (patrz `AdminDashboardClient.tsx`).

4) Skrypty i uruchamianie
- Development: `npm run dev` (uruchamia `next dev`).
- Build: `npm run build` ; Start produkcja: `npm start`.
- Lint: `npm run lint`.

5) Konwencje projektowe
- TypeScript + Next.js 16 (App Router). Trzymaj logikę serwera w `src/app` route handlers, a interaktywne komponenty jako klient (`'use client'`).
- Nazewnictwo: komponenty klienta często kończą się suffixem `Client`.
- Hooki i konteksty w `src/hooks` i `src/context`.
- Tailwind + global CSS in `src/app/globals.css`.

6) Debugging / uwagi operacyjne
- Jeśli funkcje RPC lub inserty do tabel zwracają błąd, najpierw sprawdź uprawnienia RLS w DB (może być wymagane auth.uid()).
- Do testów UI autoryzacji można manipulować `localStorage.kmn_auth` lub użyć realnej instancji Supabase z poprawnymi env vars.
- Przy zmianach w API routes pamiętaj, że to App Router — eksportuj handler zgodnie z Next 16 (server handlers).

7) Pliki warte szybkiego przejrzenia
- `src/context/AuthContext.tsx` — logika PIN/login oraz `kmn_auth`.
- `src/lib/supabase.ts` — klient Supabase.
- `src/hooks/useAuth.ts` — wygodne re-exporty typów i hooków.
- `src/app/layout.tsx` — miejsce gdzie `AuthProvider` jest montowany.
- `src/components/AdminDashboardClient.tsx` — przykład złożonego klienta pobierającego dane z Supabase.
- `package.json` — dostępne skrypty (`dev`, `build`, `start`, `lint`).

8) Co robić przy typowych zmianach
- Dodając klienta: dodaj `'use client'` i rozważ sufiks `Client`.
- Modyfikując auth: sprawdź `localStorage.kmn_auth`, supabase session i potencjalne RPC w DB.
- Nowy server route: umieść w `src/app/api/<path>/route.ts` i użyj Next App Router handlerów.

9) Merge notes
- Jeżeli plik `.github/copilot-instructions.md` już istniał, zachowaj istniejące instrukcje, ale zastosuj powyższe repo-specyficzne fakty.

Jeśli chcesz, zaktualizuję treść lub dopiszę przykładowe snippety kodu/commandy — powiedz które sekcje rozwinąć.
