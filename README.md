This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

## Environment

Wymagane zmienne środowiskowe:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_URL` (opcjonalnie, ale zalecane na serwerze; fallback dla problemów DNS po stronie backendu)
- `SUPABASE_ANON_KEY` (opcjonalnie, ale zalecane na serwerze)
- `NEXT_PUBLIC_REQUEST_ENCRYPTION_PUBLIC_KEY` (PEM klucza publicznego RSA, może być w jednej linii z `\\n`)
- `REQUEST_ENCRYPTION_PRIVATE_KEY` (PEM klucza prywatnego RSA, tylko po stronie serwera)
- `REVALIDATION_TOKEN` (zalecany sekret serwerowy dla `/api/revalidate`; fallback: `NEXT_PUBLIC_REVALIDATION_TOKEN`)
- `CRON_SECRET` (sekret do `/api/cron/auto-exit`, przekazywany w zaszyfrowanym payloadzie `POST`)

Przykładowe generowanie pary kluczy RSA 2048:

```bash
openssl genpkey -algorithm RSA -out request_private.pem -pkeyopt rsa_keygen_bits:2048
openssl rsa -pubout -in request_private.pem -out request_public.pem
```

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
