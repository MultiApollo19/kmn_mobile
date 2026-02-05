'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Loader2, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

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
    // Zakładamy, że AuthContext udostępnia metodę login(email, password).
    // Jeśli używasz tylko loginWithPin, należy rozszerzyć AuthContext o standardowe logowanie.
    const { login } = useAuth() as any; 
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (login) {
                await login(email, password, redirectPath);
            } else {
                console.error("Metoda login nie została znaleziona w AuthContext");
                setError("Błąd konfiguracji logowania");
            }
        } catch (err) {
            setError('Nieprawidłowy email lub hasło');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full max-w-4xl mx-auto p-6 lg:p-10 bg-card rounded-xl shadow-lg border border-border">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                {/* Mobile / tablet header */}
                <div className="flex flex-col items-center lg:hidden mb-2">
                    <div className="relative w-44 h-20 mb-4">
                        <Image src="/Logo.png" alt="Logo" fill className="object-contain" priority />
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
                    <p className="text-muted-foreground text-sm mt-2 text-center max-w-xs">
                        {description}
                    </p>
                </div>

                {/* Left column for desktop branding/information */}
                <div className="hidden lg:flex flex-col items-center justify-center p-6">
                    <div className="relative w-64 h-36 mb-6">
                        <Image src="/Logo.png" alt="Logo" fill className="object-contain" priority />
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight text-center">{title}</h1>
                    <p className="text-muted-foreground text-base mt-4 text-center max-w-md">
                        {description}
                    </p>
                </div>

                {/* Right column: form */}
                <form onSubmit={handleSubmit} className="space-y-4 w-full">
                {error && (
                    <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md font-medium text-center animate-pulse">
                        {error}
                    </div>
                )}
                
                <div className="space-y-2">
                    <label htmlFor="email" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Email</label>
                    <div className="relative">
                        <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className={cn(
                                "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pl-10 text-sm ring-offset-background",
                                "file:border-0 file:bg-transparent file:text-sm file:font-medium",
                                "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                "disabled:cursor-not-allowed disabled:opacity-50"
                            )}
                            placeholder="admin@example.com"
                            required
                            disabled={loading}
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label htmlFor="password" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Hasło</label>
                    <div className="relative">
                        <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className={cn(
                                "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pl-10 pr-10 text-sm ring-offset-background",
                                "file:border-0 file:bg-transparent file:text-sm file:font-medium",
                                "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                "disabled:cursor-not-allowed disabled:opacity-50"
                            )}
                            placeholder="••••••••"
                            required
                            disabled={loading}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground transition-colors"
                            tabIndex={-1}
                        >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                    </div>
                </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className={cn(
                            "w-full h-12 rounded-md bg-primary text-primary-foreground font-medium flex items-center justify-center gap-2",
                            "hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:pointer-events-none mt-6"
                        )}
                    >
                        {loading ? <Loader2 className="animate-spin h-4 w-4" /> : "Zaloguj się"}
                    </button>
                </form>
            </div>
        </div>
    );
}