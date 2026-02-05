'use client';

import React, { useRef, useState } from 'react';
import { useAuth } from '@/src/hooks/useAuth';
import { Loader2 } from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/src/lib/utils';

interface AdminLoginFormProps {
    title?: string;
    description?: string;
    redirectPath?: string;
}

export default function AdminLoginForm({ 
    title = 'Panel Administratora', 
    description = 'Zaloguj się, aby zarządzać systemem', 
    redirectPath = '/admin' 
}: AdminLoginFormProps) {
    const { loginWithPin } = useAuth();
    const [pin, setPin] = useState('');
    const inputRef = useRef<HTMLInputElement | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        const trimmed = pin.trim();
        if (!/^\d{4}$/.test(trimmed)) return setError('Wpisz 4-cyfrowy PIN');
        setError('');
        setLoading(true);
        try {
            await loginWithPin(trimmed, redirectPath);
        } catch {
            setError('Błędny PIN');
            setPin('');
            inputRef.current?.focus();
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleSubmit();
        }
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        const pasted = e.clipboardData.getData('text').trim();
        const onlyDigits = pasted.replace(/\D/g, '');
        if (/^\d{4}$/.test(onlyDigits)) {
            setPin(onlyDigits);
            setTimeout(() => handleSubmit(), 0);
        } else if (onlyDigits.length > 0) {
            setPin(onlyDigits.slice(0, 4));
        }
        e.preventDefault();
    };

    return (
        <div className="w-full max-w-4xl mx-auto p-6 lg:p-10 bg-card rounded-xl shadow-lg border border-border">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                <div className="flex flex-col items-center lg:hidden mb-2">
                    <div className="relative w-44 h-20 mb-4">
                        <Image src="/Logo.png" alt="Logo" fill className="object-contain" priority />
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
                    <p className="text-muted-foreground text-sm mt-2 text-center max-w-xs">
                        {description}
                    </p>
                </div>

                <div className="hidden lg:flex flex-col items-center justify-center p-6">
                    <div className="relative w-64 h-36 mb-6">
                        <Image src="/Logo.png" alt="Logo" fill className="object-contain" priority />
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight text-center">{title}</h1>
                    <p className="text-muted-foreground text-base mt-4 text-center max-w-md">
                        {description}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4 w-full">
                {error && (
                    <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md font-medium text-center animate-pulse">
                        {error}
                    </div>
                )}

                <div className="space-y-2">
                    <label htmlFor="admin-pin" className="text-sm font-medium leading-none">PIN</label>
                    <div className="flex items-center gap-3">
                        <input
                            id="admin-pin"
                            ref={inputRef}
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={4}
                            value={pin}
                            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                            onKeyDown={handleKeyDown}
                            onPaste={handlePaste}
                            className={cn(
                                "w-full lg:w-64 h-14 text-center text-2xl rounded-md border border-input bg-background focus:outline-none",
                                "focus:ring-2 focus:ring-ring"
                            )}
                            disabled={loading}
                            autoFocus
                            aria-label="PIN administratora"
                        />
                    </div>
                    <p className="text-muted-foreground text-sm mt-2">Wpisz 4-cyfrowy PIN i naciśnij Enter</p>
                </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className={cn(
                            "w-full h-12 rounded-md bg-primary text-primary-foreground font-medium flex items-center justify-center gap-2",
                            "hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:pointer-events-none mt-6"
                        )}
                    >
                        {loading ? <Loader2 className="animate-spin h-4 w-4" /> : "Zaloguj"}
                    </button>
                </form>
            </div>
        </div>
    );
}
