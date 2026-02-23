# Request Encryption v2

## Cel

Nowy moduł szyfrowania żądań API (klient → serwer) z naciskiem na:

- poufność i integralność payloadu,
- anty-replay,
- powiązanie szyfrogramu z kontekstem żądania (metoda + ścieżka),
- rotację kluczy po `kid`.

## Zastosowany protokół

- Hybrydowe szyfrowanie: `RSA-OAEP-256` (owijanie klucza) + `AES-256-GCM` (szyfrowanie danych).
- Format payloadu v2:
  - `v`, `alg`, `kid`, `ts`, `requestId`, `context`, `wrappedKey`, `iv`, `ciphertext`.
- Dodatkowe dane uwierzytelnione (AAD):
  - `v`, `alg`, `kid`, `ts`, `requestId`, `context`.

## Główne mechanizmy bezpieczeństwa

- Wymuszony `secure context` i WebCrypto po stronie klienta.
- Losowy IV 96-bit (`AES-GCM`) na żądanie.
- Losowy `requestId` (anty-replay) + znacznik czasu `ts`.
- Ochrona anty-replay po stronie serwera:
  - okno czasowe (`REQUEST_ENCRYPTION_REPLAY_WINDOW_MS`),
  - cache jednorazowego użycia `kid:requestId`.
- Wiązanie kontekstu żądania:
  - serwer porównuje `context.method` i `context.path` z faktycznym `Request`.
- Rotacja kluczy:
  - obsługa `REQUEST_ENCRYPTION_PRIVATE_KEYS` + `REQUEST_ENCRYPTION_ACTIVE_KID`.

## Środowisko

- Klient:
  - `NEXT_PUBLIC_REQUEST_ENCRYPTION_PUBLIC_KEY`
  - `NEXT_PUBLIC_REQUEST_ENCRYPTION_KEY_ID`
- Serwer:
  - `REQUEST_ENCRYPTION_PRIVATE_KEY` lub
  - `REQUEST_ENCRYPTION_PRIVATE_KEYS` (+ opcjonalnie `REQUEST_ENCRYPTION_ACTIVE_KID`)
  - `REQUEST_ENCRYPTION_REPLAY_WINDOW_MS`

## Źródła (10)

1. OWASP Cryptographic Storage Cheat Sheet
2. OWASP Key Management Cheat Sheet
3. NIST SP 800-38D (GCM)
4. NIST SP 800-132
5. RFC 5116 (AEAD)
6. RFC 5869 (HKDF)
7. RFC 8446 (TLS 1.3)
8. Google Tink AEAD guidance
9. Node.js `crypto` documentation
10. Libsodium AEAD guidance

## Uwaga operacyjna

Po zmianach zalecana jest rotacja kluczy szyfrowania i sekretów środowiskowych, jeżeli były wcześniej ujawnione poza zaufanym zakresem.
