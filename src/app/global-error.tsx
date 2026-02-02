'use client';

import { Inter } from 'next/font/google';
import './globals.css';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useEffect } from 'react';

const inter = Inter({ subsets: ['latin'] });

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global Error:', error);
  }, [error]);

  return (
    <html lang="pl">
      <body className={`${inter.className} bg-background text-foreground antialiased min-h-screen flex flex-col items-center justify-center p-4`}>
        <div className="max-w-md w-full bg-card border border-border rounded-xl shadow-lg p-8 text-center space-y-6">
            <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>
            
            <div className="space-y-2">
                <h2 className="text-2xl font-bold tracking-tight">Krytyczny błąd systemu</h2>
                <p className="text-muted-foreground">
                    Wystąpił nieoczekiwany problem, który uniemożliwił załadowanie aplikacji.
                </p>
                {error.digest && (
                    <p className="text-xs text-muted-foreground font-mono bg-muted p-1 rounded">
                        Kod błędu: {error.digest}
                    </p>
                )}
            </div>

            <button
                onClick={() => reset()}
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-3 rounded-lg transition-colors font-medium w-full justify-center"
            >
                <RefreshCw size={18} />
                Spróbuj ponownie
            </button>
        </div>
      </body>
    </html>
  );
}
