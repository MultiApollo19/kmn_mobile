'use client';

import { useState } from 'react';
import { useAuth } from '@/src/hooks/useAuth';
import { Loader2, Delete, ChevronRight } from 'lucide-react';
import { cn } from '@/src/lib/utils';

interface PinLoginFormProps {
  title?: string;
  description?: string;
  redirectPath?: string;
}

export default function PinLoginForm({ 
  title = 'Witaj', 
  description = 'Wprowadź swój kod PIN aby kontynuować',
  redirectPath = '/'
}: PinLoginFormProps) {
    const { loginWithPin } = useAuth();
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleNumberClick = (num: number) => {
        if (pin.length < 4) {
            setPin((prev) => prev + num);
            setError('');
        }
    };

    const handleDelete = () => {
        setPin((prev) => prev.slice(0, -1));
        setError('');
    };

    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (pin.length < 4) return;
        
        setError('');
        setLoading(true);
        try {
            await loginWithPin(pin, redirectPath);
        } catch {
            setError('Błędny PIN');
            setPin('');
        } finally {
            setLoading(false);
        }
    };

    const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9];

    return (
        <div className="w-full max-w-sm mx-auto p-8 flex flex-col items-center justify-center min-h-[500px]">
            <div className="mb-8 text-center space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
                <p className="text-muted-foreground text-sm">{description}</p>
            </div>

            {/* PIN Display */}
            <div className="mb-8 flex gap-4 justify-center">
                {[0, 1, 2, 3].map((i) => (
                    <div
                        key={i}
                        className={cn(
                            "w-4 h-4 rounded-full transition-all duration-300",
                            pin.length > i 
                                ? "bg-primary scale-110" 
                                : "bg-muted scale-100"
                        )}
                    />
                ))}
            </div>

            {error && (
                <div className="mb-6 text-destructive text-sm font-medium animate-pulse">
                    {error}
                </div>
            )}

            {/* Keypad */}
            <div className="grid grid-cols-3 gap-6 w-full max-w-[280px]">
                {numbers.map((num) => (
                    <button
                        key={num}
                        onClick={() => handleNumberClick(num)}
                        disabled={loading}
                        className="h-16 w-16 rounded-full bg-secondary hover:bg-secondary/80 text-2xl font-semibold flex items-center justify-center transition-all active:scale-95 disabled:opacity-50"
                    >
                        {num}
                    </button>
                ))}
                
                <div className="flex items-center justify-center">
                   {/* Empty slot for alignment */}
                </div>

                <button
                    onClick={() => handleNumberClick(0)}
                    disabled={loading}
                    className="h-16 w-16 rounded-full bg-secondary hover:bg-secondary/80 text-2xl font-semibold flex items-center justify-center transition-all active:scale-95 disabled:opacity-50"
                >
                    0
                </button>

                <button
                    onClick={handleDelete}
                    disabled={loading || pin.length === 0}
                    className="h-16 w-16 rounded-full hover:bg-destructive/10 text-destructive flex items-center justify-center transition-all active:scale-95 disabled:opacity-30"
                >
                    <Delete className="w-6 h-6" />
                </button>
            </div>

            <button
                onClick={() => handleSubmit()}
                disabled={loading || pin.length !== 4}
                className={cn(
                    "mt-8 w-full max-w-[280px] h-12 rounded-xl bg-primary text-primary-foreground font-medium flex items-center justify-center gap-2 transition-all",
                    (loading || pin.length !== 4) ? "opacity-0 translate-y-4 pointer-events-none" : "opacity-100 translate-y-0"
                )}
            >
                {loading ? <Loader2 className="animate-spin w-5 h-5" /> : (
                    <>
                        Zaloguj <ChevronRight className="w-4 h-4" />
                    </>
                )}
            </button>
        </div>
    );
}