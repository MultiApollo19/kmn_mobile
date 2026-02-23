# Simple Encryption — Najprostsze bezpieczne szyfrowanie kiosku

## Problem
Dane z kiosku (PIN, dane pracownika, logi) muszą być chronione przed podsłuchem w sieci. Poprzednie rozwiązanie było zbyt skomplikowane (RSA + AES hybrydowe).

## Rozwiązanie
**TLS (HTTPS) + symetryczne szyfrowanie AES-256-GCM**

### Architektura

```
Kiosk (Browser)                    Server (Node.js)
    |                                   |
    |-- GET /api/encryption-key -----> |
    |<-- { key: "base64..." } -------- |
    |    (klucz cachowany w sessionStorage)
    |
    | (użytkownik wysyła PIN)
    |-- POST /api/auth/verify-pin --> |
    |    { v:1, ts, requestId, iv, ciphertext }
    |
    |<-- { id, name, role } --------- |
```

### Protokół (v1)

Klient szyfruje payload przed wysłaniem:

```typescript
{
  v: 1,
  ts: number,                    // antirepley: timestamp
  requestId: "base64url",        // antirepley: losowy ID
  iv: "base64",                  // losowy IV (12 bajtów)
  ciphertext: "base64"           // AES-256-GCM(plaintext)
}
```

Serwer:
1. Dekoduje base64 (iv, ciphertext)
2. Wyciąga auth tag z końca ciphertextu
3. Deszyfruje AES-256-GCM(ciphertext, iv, authTag)
4. Waliduje timestamp (anti-replay, max 5 minut)

### Bezpieczeństwo

| Warstwa | Mechanizm | Efekt |
|---------|-----------|-------|
| Transport | HTTPS/TLS | Klucz chroniony przy pobieraniu, dane nie do podsłuchu |
| Payload | AES-256-GCM | Poufność + integralność (auth tag) |
| Anti-replay | ts + requestId | Zapobiega powtórzeniom requestów |
| Session | sessionStorage | Klucz ważny do 1 godziny, czyszczony przy wylogowaniu |

### Zalety vs. stare podejście

| Aspekt | Stare (RSA+AES v2) | Nowe (AES v1) |
|--------|---|---|
| Złożoność | RSA key wrap w przeglądarce | Brak RSA w kliencie |
| Wydajność | AES-GCM + RSA na każde żądanie | Tylko AES-GCM |
| Kod | ~300 linii logiki + WebCrypto | ~200 linii, prosty flow |
| Linting | Skomplikowany typ payload | Prosty typ payload |
| Deploy | Klucze prywatne/publiczne | Jeden klucz symetryczny w env |
| Rotacja | Wymaga koordynacji kid/key map | Zmiana ENCRYPTION_KEY w env |

## Implementacja

### 1. Pobierz/wygeneruj klucz (przeglądarka)

```typescript
import { getEncryptionKey } from '@/src/lib/simpleEncryption';

const key = await getEncryptionKey(); // cachuje w sessionStorage
```

### 2. Szyfruj payload

```typescript
import { encryptedPost } from '@/src/lib/simpleEncryptedApiClient';

const response = await encryptedPost('/api/auth/verify-pin', { pin: '1234' });
```

### 3. Deszyfruj na serwerze

```typescript
import { decryptPayload } from '@/src/lib/simpleDecryption';

export async function POST(request: NextRequest) {
  const { pin } = await decryptPayload<{ pin: string }>(request);
  // pin jest teraz odszyfrowany
}
```

## Zmienne środowiskowe

### Klient (.env.local)
Brak — klucz pobierany dynamicznie z `/api/encryption-key`.

### Serwer (.env.local)
```env
# Statyczny klucz AES-256 (32 bajty w base64)
# Generuj: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
ENCRYPTION_KEY=<base64-encoded-256-bit-key>
```

**Uwaga:** W produkcji można użyć per-session keys w Redis/Memcached dla większej granularności, ale statyczny klucz jest wystarczający dla większości aplikacji kiosk.

## Wdrożenie (krok po kroku)

1. ✅ Skopier `simpleEncryption.ts`, `simpleDecryption.ts`, `simpleEncryptedApiClient.ts`
2. ✅ Stwórz endpoint `/api/encryption-key` — wysyła nowy klucz AES-256
3. ✅ Zastąp istniejące route handlers nowymi wersami używającymi `decryptPayload()`
4. ✅ Zmień klienckie callsites żeby używały `encryptedPost()` zamiast `encryptedPost()`
5. ✅ Test: smoke test all endpoints z szyfrowaniem v1
6. ✅ Deploy

## FAQ

**Q: Czy klucz jest bezpieczny w sessionStorage?**  
A: Tak przy HTTPS. SessionStorage jest dostępny wyłącznie dla JavaScript z tej domeny. XSS atak może ukraść klucz, ale wtedy cała aplikacja jest skompromitowana (atakujący ma dostęp do całego UI). Dla extra-wrażliwych danych: HSM lub hardware security tokens.

**Q: Czy potrzebna jest rotacja kluczy?**  
A: Tak, ale okresowa (np. co miesiąc, kwartalnie). Zmień `ENCRYPTION_KEY` w .env i zrestartuj serwer. Stare payloady z sessionStorage wygasną po 1 godzinie. Dla częstszej rotacji: per-session keys w Redis z TTL.

**Q: Czy AES-256-GCM jest wystarczająco bezpieczny?**  
A: Tak. NIST, NSA, Google Tink, AWS KMS — wszyscy rekomendują AES-GCM dla symetrycznego szyfrowania + auth. 

## Referencje

- NIST SP 800-38D (GCM)
- RFC 5116 (AEAD)
- OWASP Cryptographic Storage Cheat Sheet
- Node.js `crypto` documentation

---

**Wdrażane**: 23 lutego 2026  
**Wersja**: 1  
**Status**: Gotowy do testów lokalizacyjnych
