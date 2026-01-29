# Project Overview

`kmn_mobile` is a Next.js web application designed as a mobile-first interface, likely for internal or business use given the directory path (`D:\Automatyka\Firma\Aplikacje\kmn_mobile`). It leverages **Appwrite** for backend services (authentication, database) and **Tailwind CSS** for styling.

## Key Technologies

*   **Framework:** [Next.js](https://nextjs.org/) (App Router, TypeScript)
*   **Language:** TypeScript
*   **Backend as a Service:** [Appwrite](https://appwrite.io/)
*   **Styling:** [Tailwind CSS](https://tailwindcss.com/)
*   **Package Manager:** npm

## Architecture

*   **`src/app/`**: Contains the application routes (App Router).
    *   `page.tsx`: The main landing page.
    *   `login/page.tsx`: The authentication page (Login/Register).
*   **`src/lib/`**: Configuration for external services.
    *   `appwrite.ts`: Initializes the Appwrite client using environment variables.
*   **`src/hooks/`**: Custom React hooks.
    *   `useAuth.ts`: Manages authentication state (login, register, logout, current user) and session persistence.
*   **`src/components/`**: Reusable UI components.
    *   `AuthForm.tsx`: Form component used for both login and registration.

# Building and Running

## Prerequisites

*   Node.js (LTS version recommended)
*   An active Appwrite instance (cloud or self-hosted)

## Environment Setup

Create a `.env.local` file in the root directory and add your Appwrite configuration:

```env
NEXT_PUBLIC_APPWRITE_ENDPOINT=<your-appwrite-endpoint>
NEXT_PUBLIC_APPWRITE_PROJECT_ID=<your-project-id>
```

## Available Scripts

*   **Development Server:**
    ```bash
    npm run dev
    ```
    Starts the application at `http://localhost:3000`.

*   **Production Build:**
    ```bash
    npm run build
    ```
    Compiles the application for production deployment.

*   **Start Production Server:**
    ```bash
    npm run start
    ```
    Runs the built application.

*   **Linting:**
    ```bash
    npm run lint
    ```
    Checks the code for style and potential errors using ESLint.

# Development Conventions

*   **TypeScript:** All new files should be written in TypeScript (`.ts` or `.tsx`).
*   **Styling:** Use Tailwind CSS utility classes for styling components.
*   **Authentication:** interacting with user sessions should be done via the `useAuth` hook.
*   **Appwrite:** Database and Account interactions are centralized through the client exported in `src/lib/appwrite.ts`.
